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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, channelName, user, isMod } = getChannelContext(req);

  const parts = (req.query.args as string)?.split(" ") ?? [];
  const amount = parts.length ? parseInt(parts[0], 10) : 1;

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
    const unlocked = await recordAuraRolls(results);

    const unlockText = formatAchievementUnlocks(unlocked);
    const achievementSuffix = unlockText ? ` | ${unlockText}` : "";

    if (displayCount === 1) {
      const best = top[0];
      const rollNote = rollCount > 1 ? ` (${rollCount}x)` : "";

      return text(
        res,
        `${formatRollResult(
          name,
          best.aura.name,
          best.effectiveRarity
        )}${rollNote}${achievementSuffix}`
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

    return text(res, `${msg}${achievementSuffix}`);
  });
}
