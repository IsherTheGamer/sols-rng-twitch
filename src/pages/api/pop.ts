import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import {
  getChannelState,
  cooldownKey,
  formatRemaining,
} from "@/lib/state";
import {
  rollOnceDetailed,
  type RollHitResult,
} from "@/lib/roll-engine";
import {
  findPotion,
  DEV_LUCK_MULTIPLIER,
  potions,
} from "@/lib/data";
import {
  applyCooldown,
  checkCooldown,
  getPotionCooldownSeconds,
} from "@/lib/cooldowns";
import { text, error, parseQuery } from "@/lib/api-helpers";
import {
  formatPopResult,
  formatRarity,
  truncate,
} from "@/lib/format";
import {
  getViewerProfile,
  isBroadcasterUser,
  recordViewerRolls,
} from "@/lib/profile";
import {
  getPotionRestriction,
  validatePotionRestriction,
} from "@/lib/potion-restrictions";
import { announceAuraResults } from "@/lib/global-announcements";

function isDevActive(state: {
  activeDevBiome: string | null;
  devExpiresAt: number;
}) {
  return state.activeDevBiome && state.devExpiresAt > Date.now();
}

function formatMissedHits(missed: RollHitResult[]): string {
  if (missed.length === 0) return "";

  const shown = missed.slice(0, 3);

  const body = shown
    .map((hit) => `${hit.aura.name} ${formatRarity(hit.effectiveRarity)}`)
    .join(", ");

  const extra = missed.length > shown.length
    ? `, +${missed.length - shown.length} more`
    : "";

  return ` | Missed: ${body}${extra}`;
}

async function handlePop(
  req: NextApiRequest,
  res: NextApiResponse,
  maxPops: number
) {
  const {
    channel,
    channelId,
    channelName,
    user,
    isMod,
  } = getChannelContext(req);

  const query = parseQuery(req);
  const parts = query.split(/\s+/).filter(Boolean);

  let popCount = 1;
  let potionQuery = query;

  if (maxPops > 1 && parts.length >= 2) {
    const maybeCount = parseInt(parts[parts.length - 1], 10);

    if (!isNaN(maybeCount) && maybeCount > 0) {
      popCount = Math.min(maybeCount, maxPops);
      potionQuery = parts.slice(0, -1).join(" ");
    }
  }

  const potion = findPotion(potionQuery);

  if (!potion) {
    const list = potions.map((p) => p.name).join(", ");
    return error(res, `Unknown potion. Try: ${list}`);
  }

  const state = await getChannelState(channelId, channelName);
  const broadcaster = isBroadcasterUser(user, channel);

  if (
    potion.requiresEvent &&
    !broadcaster &&
    !state.activeEvents.includes(potion.requiresEvent)
  ) {
    return error(
      res,
      `${potion.name} only works during ${potion.requiresEvent} event.`
    );
  }

  const profile = await getViewerProfile(channelId, user);
  const fallbackCooldown = getPotionCooldownSeconds(potion.luck);
  const restriction = getPotionRestriction(potion, fallbackCooldown);

  if (!broadcaster) {
    const restrictionError = validatePotionRestriction({
      potion,
      profile,
      restriction,
      isMod,
    });

    if (restrictionError) {
      return error(res, restrictionError);
    }

    const key = cooldownKey(
      `pop:${potion.id}`,
      channelId,
      user?.providerId ?? "anon"
    );

    const cd = await checkCooldown(
      key,
      restriction.cooldownSeconds * 1000
    );

    if (!cd.allowed) {
      return text(
        res,
        `${potion.name} cooldown: ${formatRemaining(
          Date.now() + cd.remainingMs
        )}`
      );
    }

    await applyCooldown(key, restriction.cooldownSeconds * 1000);
  }

  const luckMult = isDevActive(state) ? DEV_LUCK_MULTIPLIER : 1;
  const effectiveLuck = Math.floor(potion.luck * luckMult);
  const displayName = user?.displayName ?? user?.name ?? "Player";

  const results: RollHitResult[] = [];
  const messages: string[] = [];

  for (let i = 0; i < popCount; i++) {
    const ctx = {
      state,
      luck: effectiveLuck,
      potionId: potion.id,
    };

    const result = rollOnceDetailed(ctx);

    results.push({
      aura: result.aura,
      effectiveRarity: result.effectiveRarity,
    });

    const baseMsg = formatPopResult(
      displayName,
      potion.name,
      result.aura.name,
      result.effectiveRarity
    );

    const missedText =
      maxPops === 1 ? formatMissedHits(result.missed) : "";

    messages.push(`${baseMsg}${missedText}`);
  }

  await recordViewerRolls(channelId, user, results, "potion");

  await announceAuraResults({
    channelId,
    displayName,
    results,
    source: "potion",
    potionId: potion.id,
    potionName: potion.name,
  });

  return text(res, truncate(messages.join(" | "), 390));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const isOp = req.url?.includes("popop") || req.query.op === "1";

  if (isOp) {
    const { isMod } = getChannelContext(req);

    if (!isMod) return error(res, "Mod only.");

    return handlePop(req, res, 4);
  }

  return handlePop(req, res, 1);
}
