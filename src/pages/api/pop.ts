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
import { isPopopAllowlisted } from "@/lib/popop-access";
import { runAfterCommandReply } from "@/lib/delayed-announcement";

export const config = {
  maxDuration: 30,
};

const MAX_POPOP = 10000;
const POPOP_TOP_RESULTS = 3;

function isDevActive(state: {
  activeDevBiome: string | null;
  devExpiresAt: number;
}): boolean {
  return Boolean(state.activeDevBiome && state.devExpiresAt > Date.now());
}

function parsePopAmount(raw: string): number {
  const clean = raw.trim().toLowerCase();

  const match = clean.match(/^(\d+)(k|m)?$/);

  if (!match) return 1;

  const base = parseInt(match[1], 10);

  if (!Number.isFinite(base) || base < 1) return 1;

  const suffix = match[2];

  if (suffix === "k") return base * 1000;
  if (suffix === "m") return base * 1000000;

  return base;
}

function formatMissedHits(missed: RollHitResult[]): string {
  if (missed.length === 0) return "";

  const shown = missed.slice(0, 3);

  const body = shown
    .map((hit) => `${hit.aura.name} ${formatRarity(hit.effectiveRarity)}`)
    .join(", ");

  const extra =
    missed.length > shown.length
      ? `, +${missed.length - shown.length} more`
      : "";

  return ` | Missed: ${body}${extra}`;
}

function formatTopPotionResults(
  results: RollHitResult[],
  maxShown: number
): string {
  const top = [...results]
    .sort((a, b) => {
      if (b.effectiveRarity !== a.effectiveRarity) {
        return b.effectiveRarity - a.effectiveRarity;
      }

      return b.aura.rarity - a.aura.rarity;
    })
    .slice(0, maxShown);

  return top
    .map(
      (hit, index) =>
        `${index + 1}) ${hit.aura.name} ${formatRarity(hit.effectiveRarity)}`
    )
    .join(" | ");
}

async function handlePop(
  req: NextApiRequest,
  res: NextApiResponse,
  maxPops: number,
  options?: {
    bypassRequirements?: boolean;
    summarizeBestCount?: number;
  }
) {
  const {
    channel,
    channelId,
    channelName,
    channelLoginName,
    user,
    isMod,
  } = getChannelContext(req);

  const bypassRequirements = options?.bypassRequirements ?? false;
  const summarizeBestCount = options?.summarizeBestCount ?? 0;

  const query = parseQuery(req);
  const parts = query.split(/\s+/).filter(Boolean);

  let popCount = 1;
  let potionQuery = query;

  if (maxPops > 1 && parts.length >= 2) {
    const maybeCount = parsePopAmount(parts[parts.length - 1]);

    if (maybeCount > 1) {
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
    !bypassRequirements &&
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

  if (!broadcaster && !bypassRequirements) {
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
  const shouldSummarize = summarizeBestCount > 0 && popCount > 1;

  for (let i = 0; i < popCount; i++) {
    const ctx = {
      state,
      luck: effectiveLuck,
      potionId: potion.id,
    };

    const result = rollOnceDetailed(ctx);

    const hit = {
      aura: result.aura,
      effectiveRarity: result.effectiveRarity,
    };

    results.push(hit);

    if (!shouldSummarize) {
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
  }

  await recordViewerRolls(channelId, user, results, "potion");

  if (shouldSummarize) {
    const topText = formatTopPotionResults(results, summarizeBestCount);

    text(
      res,
      truncate(
        `${displayName} popped ${potion.name} ${popCount}x — top ${summarizeBestCount}: ${topText}`,
        390
      )
    );
  } else {
    text(res, truncate(messages.join(" | "), 390));
  }

  await runAfterCommandReply(() =>
    announceAuraResults({
      channelId,
      channelName: channelLoginName,
      displayName,
      results,
      source: "potion",
      potionId: potion.id,
      potionName: potion.name,
    })
  );

  return;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const isOp = req.url?.includes("popop") || req.query.op === "1";

  if (isOp) {
    const { channel, channelLoginName, user } = getChannelContext(req);

    const broadcaster = isBroadcasterUser(user, channel);
    const allowlisted = isPopopAllowlisted(user, channelLoginName);

    if (!broadcaster && !allowlisted) {
      return error(res, "Popop is trusted-user only.");
    }

    return handlePop(req, res, MAX_POPOP, {
      bypassRequirements: true,
      summarizeBestCount: POPOP_TOP_RESULTS,
    });
  }

  return handlePop(req, res, 1);
}
