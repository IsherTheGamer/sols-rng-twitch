import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getViewerProfile, isBroadcasterUser } from "@/lib/profile";
import { isPopopAllowlisted } from "@/lib/popop-access";
import {
  findPotionForToken,
  formatTokenList,
  getAllTokenDefinitions,
  grantTokensToUsername,
  refundActiveTokenBuffs,
  useToken,
} from "@/lib/inventory";
import { getChannelState } from "@/lib/state";
import { getPotionCooldownSeconds } from "@/lib/cooldowns";
import { getPotionRestriction, validatePotionRestriction } from "@/lib/potion-restrictions";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { truncate } from "@/lib/format";
import { TOKEN_ACTIONS, resolveTextAlias } from "@/lib/command-aliases";
import { aliasSuggestionText, resolveAlias } from "@/lib/fuzzy-alias";

function parseAmount(parts: string[]): { amount: number; remaining: string[] } {
  if (parts.length === 0) return { amount: 1, remaining: parts };
  const last = parts[parts.length - 1].toLowerCase();
  const match = last.match(/^(\d+)(k)?$/);
  if (!match) return { amount: 1, remaining: parts };
  const base = parseInt(match[1], 10);
  return {
    amount: Math.max(1, match[2] === "k" ? base * 1000 : base),
    remaining: parts.slice(0, -1),
  };
}

function usage(): string {
  return [
    "🎟️ Token help:",
    "!token boosts",
    "!token special",
    "!token potions",
    "!token use <token> [amount]",
    "!token refund",
    "!token give <user> <token> [amount]",
  ].join(" | ");
}

function resolveRollToken(raw: string): { value?: string; error?: string } {
  const definitions = getAllTokenDefinitions();
  const result = resolveAlias(
    raw,
    definitions.map((token) => ({
      id: token.id,
      label: token.name,
      aliases: [token.id.replace(/_/g, " "), ...(token.aliases ?? [])],
      value: token.id,
    })),
    { maxScore: 0.28, ambiguityGap: 0.08 }
  );

  if (result.status === "matched") return { value: result.match.value };
  return { error: aliasSuggestionText(result, "roll token") };
}

function resolveListMode(raw: string): string | null {
  const mode = resolveTextAlias(raw, TOKEN_ACTIONS, "token list mode");
  if (!mode.value) return null;
  if (["boosts", "special", "potions"].includes(mode.value)) return mode.value;
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channel, channelId, channelName, channelLoginName, user, isMod } = getChannelContext(req);
  if (!user) return error(res, "Token only works from Twitch chat.");

  const parts = parseQuery(req).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return text(res, truncate(usage(), 390));

  const actionResult = resolveTextAlias(parts[0], TOKEN_ACTIONS, "token action");
  if (!actionResult.value) return error(res, actionResult.error ?? truncate(usage(), 390));
  const action = actionResult.value;

  if (action === "help") return text(res, truncate(usage(), 390));

  if (action === "list") {
    const mode = resolveListMode(parts[1] ?? "");
    if (!mode) return text(res, truncate(usage(), 390));
    return text(res, truncate(formatTokenList(mode), 390));
  }

  if (["boosts", "special", "potions"].includes(action)) {
    return text(res, truncate(formatTokenList(action), 390));
  }

  if (action === "refund") {
    const result = await refundActiveTokenBuffs({ channelId, user });
    if (result.refunded.length === 0) return text(res, "You have no active token buffs to refund.");
    const count = result.refunded.reduce((sum, buff) => sum + buff.amount, 0);
    return text(res, `Refunded ${count} active token(s) back into inventory.`);
  }

  if (action === "use") {
    const parsed = parseAmount(parts.slice(1));
    const rawToken = parsed.remaining.join(" ");
    if (!rawToken) return error(res, "Use what token? Example: !token use clover");

    const token = resolveRollToken(rawToken);
    if (!token.value) return error(res, token.error ?? "Unknown roll token.");

    const broadcaster = isBroadcasterUser(user, channel);
    const potion = findPotionForToken(token.value);

    if (potion && !broadcaster) {
      const state = await getChannelState(channelId, channelName);
      if (potion.requiresEvent && !state.activeEvents.includes(potion.requiresEvent)) {
        return error(res, `${potion.name} only works during ${potion.requiresEvent} event.`);
      }

      const profile = await getViewerProfile(channelId, user);
      const restriction = getPotionRestriction(potion, getPotionCooldownSeconds(potion.luck));
      const restrictionError = validatePotionRestriction({ potion, profile, restriction, isMod });
      if (restrictionError) return error(res, restrictionError);
    }

    const result = await useToken({ channelId, user, tokenQuery: token.value, amount: parsed.amount });
    return result.ok ? text(res, truncate(result.message, 390)) : error(res, result.message);
  }

  if (action === "give") {
    const broadcaster = isBroadcasterUser(user, channel);
    const allowlisted = isPopopAllowlisted(user, channelLoginName);
    if (!broadcaster && !allowlisted) return error(res, "Token give is trusted-user only.");

    const target = parts[1];
    if (!target) return error(res, "Give to who? Example: !token give viewer clover 1");

    const parsed = parseAmount(parts.slice(2));
    const rawToken = parsed.remaining.join(" ");
    if (!rawToken) return error(res, "Give what token? Example: !token give viewer bound 2");

    const token = resolveRollToken(rawToken);
    if (!token.value) return error(res, token.error ?? "Unknown roll token.");

    const result = await grantTokensToUsername({
      channelId,
      username: target,
      tokenQuery: token.value,
      amount: parsed.amount,
    });

    return result.ok ? text(res, truncate(result.message, 390)) : error(res, result.message);
  }

  return error(res, truncate(usage(), 390));
}
