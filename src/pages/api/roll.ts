import type { NextApiRequest, NextApiResponse } from "next";
import { processBiomeTick } from "@/lib/biome-engine";
import { getChannelContext } from "@/lib/nightbot";
import {
  getChannelState,
  setChannelState,
  cooldownKey,
  formatRemaining,
} from "@/lib/state";
import { rollOnce, rollMultiple, topRarest } from "@/lib/roll-engine";
import {
  applyCooldown,
  checkCooldown,
  ROLL_COOLDOWN_MS,
} from "@/lib/cooldowns";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { formatRollResult, formatMultiRoll } from "@/lib/format";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
const { channelId, channelName, user, isMod } = getChannelContext(req);

const state = await getChannelState(channelId, channelName);

const now = Date.now();
const elapsed = now - state.lastTickAt;

const tick = await processBiomeTick(state, elapsed);
await setChannelState(tick.state);

const updatedState = tick.state;
  const amount = parts.length ? parseInt(parts[0], 10) : 1;

  if (amount > 1 && !isMod) {
    return error(res, "Multi-roll is mod-only. Use !roll");
  }

  const rollCount = amount > 1 ? Math.min(amount, 5) * 4 : 1;
  const displayCount = amount > 1 ? Math.min(amount, 5) : 1;

  if (!isMod && amount <= 1) {
    const key = cooldownKey("roll", channelId, user?.providerId ?? "anon");
    const cd = await checkCooldown(key, ROLL_COOLDOWN_MS);
    if (!cd.allowed) {
      return text(res, `Roll cooldown: ${formatRemaining(Date.now() + cd.remainingMs)}`);
    }
    await applyCooldown(key, ROLL_COOLDOWN_MS);
  }

  const state = await getChannelState(channelId, channelName);
  const ctx = { state, luck: 1 };

  if (rollCount === 1) {
    const result = rollOnce(ctx);
    const name = user?.displayName ?? user?.name ?? "Player";
    return text(res, formatRollResult(name, result.aura.name, result.effectiveRarity));
  }

  const results = rollMultiple(ctx, rollCount);
  const top = topRarest(results, displayCount);
  const name = user?.displayName ?? user?.name ?? "Player";
  const msg = `${name} rolled ${rollCount}x — top ${displayCount}: ${formatMultiRoll(
    top.map((r) => ({ name: r.aura.name, rarity: r.effectiveRarity }))
  )}`;
  return text(res, msg);
}
