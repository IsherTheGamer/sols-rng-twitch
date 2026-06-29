import { runAfterCommandReply } from "@/lib/delayed-announcement";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  addGlobalRolls,
  getGlobalLuck,
  getAchievementBonuses,
  recordAuraRolls,
} from "@/lib/global-stats";
import { formatAchievementUnlocks } from "@/lib/achievements";
import { getChannelContext } from "@/lib/nightbot";
import {
  cooldownKey,
  formatRemaining,
} from "@/lib/state";
import { rollMultiple, topRarest } from "@/lib/roll-engine";
import {
  applyCooldown,
  checkCooldown,
  ROLL_COOLDOWN_MS,
} from "@/lib/cooldowns";
import { text, error } from "@/lib/api-helpers";
import { formatRollResult, formatMultiRoll } from "@/lib/format";
import { withTick } from "@/lib/run-with-tick";
import { isBroadcasterUser, recordViewerRolls } from "@/lib/profile";
import { announceAuraResults } from "@/lib/global-announcements";
import { isRollMultiAllowlisted } from "@/lib/roll-access";
import { consumeActiveTokenBuffs, formatLuckAmount } from "@/lib/inventory";

const NORMAL_MULTIROLL_LIMIT = 20;
const TRUSTED_MULTIROLL_LIMIT = 10000;
const MAX_DISPLAY_RESULTS = 5;

export const config = {
  maxDuration: 30,
};

function parseAmount(rawArgs: string | undefined): number {
  const raw = (rawArgs ?? "").trim().toLowerCase();

  if (!raw) return 1;

  const first = raw.split(/\s+/)[0];
  const match = first.match(/^(\d+)(k|m)?$/);

  if (!match) return 1;

  const base = parseInt(match[1], 10);

  if (!Number.isFinite(base) || base < 1) return 1;

  const suffix = match[2];

  if (suffix === "k") return base * 1000;
  if (suffix === "m") return base * 1000000;

  return base;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    channel,
    channelId,
    channelName,
    channelLoginName,
    user,
    isMod,
  } = getChannelContext(req);

  const amount = parseAmount(req.query.args as string | undefined);

  const broadcaster = isBroadcasterUser(user, channel);
  const allowlisted = isRollMultiAllowlisted(user, channelLoginName);
  const trustedMultiroll = broadcaster || allowlisted;

  const maxAllowed = trustedMultiroll
    ? TRUSTED_MULTIROLL_LIMIT
    : NORMAL_MULTIROLL_LIMIT;

  if (amount > 1 && !isMod && !trustedMultiroll) {
    return error(res, "Multi-roll is mod/trusted-user only. Use !roll");
  }

  if (amount > maxAllowed) {
    return error(
      res,
      trustedMultiroll
        ? `Max trusted multi-roll is ${TRUSTED_MULTIROLL_LIMIT}.`
        : `Max mod multi-roll is ${NORMAL_MULTIROLL_LIMIT}.`
    );
  }

  const achievementBonuses = await getAchievementBonuses();

  const cooldownMs = Math.max(
    1000,
    ROLL_COOLDOWN_MS -
      achievementBonuses.cooldownReductionSeconds * 1000
  );

  if (!isMod && !trustedMultiroll && amount <= 1) {
    const key = cooldownKey("roll", channelId, user?.providerId ?? "anon");
    const cd = await checkCooldown(key, cooldownMs);

    if (!cd.allowed) {
      return text(
        res,
        `Roll cooldown: ${formatRemaining(Date.now() + cd.remainingMs)}`
      );
    }

    await applyCooldown(key, cooldownMs);
  }

  const baseRollCount = amount > 1 ? Math.min(amount, maxAllowed) : 1;
  const bonusRolls = Math.floor(achievementBonuses.extraRolls);
  const rollCount = baseRollCount + bonusRolls;
  const displayCount =
    amount > 1 ? Math.min(baseRollCount, MAX_DISPLAY_RESULTS) : 1;

    const consumedBuffs = await consumeActiveTokenBuffs({
    channelId,
    user,
  });

  const tokenLuck = consumedBuffs.totalLuck;

  const globalRolls = await addGlobalRolls(rollCount);
  const baseLuck = getGlobalLuck(globalRolls);

  const luck =
    (baseLuck + tokenLuck + achievementBonuses.flatLuck) *
    achievementBonuses.finalLuckMultiplier;
  

  return withTick(channelId, channelName, async (state) => {
    const ctx = { state, luck };
    const name = user?.displayName ?? user?.name ?? "Player";

    const results = rollMultiple(ctx, rollCount);
    const top = topRarest(results, displayCount);

    await recordViewerRolls(channelId, user, results, "roll");

    const unlocked = await recordAuraRolls(results);

        const unlockText = formatAchievementUnlocks(unlocked);
    const tokenText =
      tokenLuck > 0 ? ` | Tokens used: +${formatLuckAmount(tokenLuck)} luck` : "";

    const suffix = `${unlockText ? ` | ${unlockText}` : ""}${tokenText}`;
    

    if (displayCount === 1) {
      const best = top[0];
      const rollNote = rollCount > 1 ? ` (${rollCount}x)` : "";

      text(
        res,
        `${formatRollResult(
          name,
          best.aura.name,
          best.effectiveRarity
        )}${rollNote}${suffix}`
      );

      await runAfterCommandReply(() =>
        announceAuraResults({
          channelId,
          channelName: channelLoginName,
          displayName: name,
          results,
          source: "roll",
        })
      );

      return;
    }

    const msg =
      `${name} rolled ${rollCount}x — top ${displayCount}: ` +
      formatMultiRoll(
        top.map((r) => ({
          name: r.aura.name,
          rarity: r.effectiveRarity,
        }))
      );

    text(res, `${msg}${suffix}`);

    await runAfterCommandReply(() =>
      announceAuraResults({
        channelId,
        channelName: channelLoginName,
        displayName: name,
        results,
        source: "roll",
      })
    );

    return;
  });
}
