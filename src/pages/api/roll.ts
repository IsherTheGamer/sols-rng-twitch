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
import { recordViewerRolls } from "@/lib/profile";
import { announceAuraResults } from "@/lib/global-announcements";

function parseAmount(rawArgs: string | undefined): number {
  const raw = (rawArgs ?? "").trim();

  if (!raw) return 1;

  const first = raw.split(/\s+/)[0];
  const amount = parseInt(first, 10);

  if (!Number.isFinite(amount) || amount < 1) return 1;

  return amount;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, channelName, user, isMod } = getChannelContext(req);

  const amount = parseAmount(req.query.args as string | undefined);

  if (amount > 1 && !isMod) {
    return error(res, "Multi-roll is mod-only. Use !roll");
  }

  const achievementBonuses = await getAchievementBonuses();

  const cooldownMs = Math.max(
    1000,
    ROLL_COOLDOWN_MS -
      achievementBonuses.cooldownReductionSeconds * 1000
  );

  if (!isMod && amount <= 1) {
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

  const baseRollCount = amount > 1 ? Math.min(amount, 5) * 4 : 1;
  const bonusRolls = Math.floor(achievementBonuses.extraRolls);
  const rollCount = baseRollCount + bonusRolls;
  const displayCount = amount > 1 ? Math.min(amount, 5) : 1;

  const globalRolls = await addGlobalRolls(rollCount);
  const baseLuck = getGlobalLuck(globalRolls);

  const luck =
    (baseLuck + achievementBonuses.flatLuck) *
    achievementBonuses.finalLuckMultiplier;

  return withTick(channelId, channelName, async (state) => {
    const ctx = { state, luck };
    const name = user?.displayName ?? user?.name ?? "Player";

    const results = rollMultiple(ctx, rollCount);
    const top = topRarest(results, displayCount);

    await recordViewerRolls(channelId, user, results, "roll");

    const unlocked = await recordAuraRolls(results);

    await announceAuraResults({
      channelId,
      displayName: name,
      results,
      source: "roll",
    });

    const unlockText = formatAchievementUnlocks(unlocked);
    const suffix = unlockText ? ` | ${unlockText}` : "";

    if (displayCount === 1) {
      const best = top[0];
      const rollNote = rollCount > 1 ? ` (${rollCount}x)` : "";

      return text(
        res,
        `${formatRollResult(
          name,
          best.aura.name,
          best.effectiveRarity
        )}${rollNote}${suffix}`
      );
    }

    const msg =
      `${name} rolled ${rollCount}x — top ${displayCount}: ` +
      formatMultiRoll(
        top.map((r) => ({
          name: r.aura.name,
          rarity: r.effectiveRarity,
        }))
      );

    return text(res, `${msg}${suffix}`);
  });
}
