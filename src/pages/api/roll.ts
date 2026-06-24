import type { NextApiRequest, NextApiResponse } from "next";
import { addGlobalRolls, getGlobalLuck } from "@/lib/global-stats";
import { getChannelContext } from "@/lib/nightbot";
import {
  cooldownKey,
  formatRemaining,
} from "@/lib/state";
import { rollOnce, rollMultiple, topRarest } from "@/lib/roll-engine";
import {
  applyCooldown,
  checkCooldown,
  ROLL_COOLDOWN_MS,
} from "@/lib/cooldowns";
import { text, error } from "@/lib/api-helpers";
import { formatRollResult, formatMultiRoll } from "@/lib/format";
import { withTick } from "@/lib/run-with-tick";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName, user, isMod } = getChannelContext(req);

  const parts = (req.query.args as string)?.split(" ") ?? [];
  const amount = parts.length ? parseInt(parts[0], 10) : 1;

  if (amount > 1 && !isMod) {
    return error(res, "Multi-roll is mod-only. Use !roll");
  }

  if (!isMod && amount <= 1) {
    const key = cooldownKey("roll", channelId, user?.providerId ?? "anon");
    const cd = await checkCooldown(key, ROLL_COOLDOWN_MS);

    if (!cd.allowed) {
      return text(res, `Roll cooldown: ${formatRemaining(Date.now() + cd.remainingMs)}`);
    }

    await applyCooldown(key, ROLL_COOLDOWN_MS);
  }

  const rollCount = amount > 1 ? Math.min(amount, 5) * 4 : 1;
  const displayCount = amount > 1 ? Math.min(amount, 5) : 1;

  // ✅ increase global counter properly
  const globalRolls = await addGlobalRolls(rollCount);
  const luck = getGlobalLuck(globalRolls);

  return withTick(channelId, channelName, async (state) => {
    const ctx = { state, luck };
    const name = user?.displayName ?? user?.name ?? "Player";

    if (rollCount === 1) {
      const result = rollOnce(ctx);

      return text(
        res,
        formatRollResult(name, result.aura.name, result.effectiveRarity)
      );
    }

    const results = rollMultiple(ctx, rollCount);
    const top = topRarest(results, displayCount);

    const msg =
      `${name} rolled ${rollCount}x — top ${displayCount}: ` +
      formatMultiRoll(
        top.map((r) => ({
          name: r.aura.name,
          rarity: r.effectiveRarity,
        }))
      );

    return text(res, msg);
  });
}
