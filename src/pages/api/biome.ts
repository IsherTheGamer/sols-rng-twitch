import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getChannelState, setChannelState } from "@/lib/state";
import { processBiomeTick, getBiomeStatus } from "@/lib/biome-engine";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { findBiome } from "@/lib/data";
import { recordBiomeVisit } from "@/lib/global-stats";
import { formatAchievementUnlocks } from "@/lib/achievements";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, channelName, isMod } = getChannelContext(req);
  const action = req.query.action;

  let state = await getChannelState(channelId, channelName);

  const now = Date.now();

  if (!state.lastTickAt || state.lastTickAt > now + 60000) {
    state.lastTickAt = now;
  }

  const elapsed = Math.max(1, now - state.lastTickAt);

  // Silent tick for normal commands, so !biome / !changebiome do not steal
  // Nightbot's chat-send cooldown from !roll.
  const tick = await processBiomeTick(state, elapsed, null, false);

  state = tick.state;
  state.lastTickAt = now;

  await setChannelState(state);

  if (state.biomeExpiresAt <= now) {
    const fallback = await processBiomeTick(state, 1, null, false);

    state = fallback.state;
    state.lastTickAt = now;

    await setChannelState(state);
  }

  if (action === "change") {
    if (!isMod) return error(res, "Mod only.");

    const query = parseQuery(req);
    const biome = findBiome(query);

    if (!biome) {
      return error(res, `Unknown biome: ${query}`);
    }

    state.biomeId = biome.id;
    state.biomeExpiresAt =
      Date.now() + (biome.durationSeconds ?? 120) * 1000;

    await setChannelState(state);

    const unlocked = await recordBiomeVisit(
      state.biomeId,
      state.biomeExpiresAt
    );

    const unlockText = formatAchievementUnlocks(unlocked);
    const suffix = unlockText ? ` | ${unlockText}` : "";

    return text(
      res,
      `Biome forced to ${biome.name}. ${getBiomeStatus(state)}${suffix}`
    );
  }

  const unlocked = await recordBiomeVisit(
    state.biomeId,
    state.biomeExpiresAt
  );

  const unlockText = formatAchievementUnlocks(unlocked);
  const suffix = unlockText ? ` | ${unlockText}` : "";

  return text(res, `${getBiomeStatus(state)}${suffix}`);
}
