import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getChannelState, setChannelState } from "@/lib/state";
import { processBiomeTick, getBiomeStatus } from "@/lib/biome-engine";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { findBiome } from "@/lib/data";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, channelName, isMod } = getChannelContext(req);
  const action = req.query.action;

  // 1. Load state
  const state = await getChannelState(channelId, channelName);

  // 2. Always advance time FIRST (fixes desync + stuck 0s)
  const now = Date.now();
  const elapsed = Math.max(1, now - state.lastTickAt);

  const tick = await processBiomeTick(state, elapsed);
  await setChannelState(tick.state);

  const updated = tick.state;

  // 3. Admin force change
  if (action === "change") {
    if (!isMod) return error(res, "Mod only.");

    const query = parseQuery(req);
    const biome = findBiome(query);

    if (!biome) {
      return error(res, `Unknown biome: ${query}`);
    }

    updated.biomeId = biome.id;
    updated.biomeExpiresAt = Date.now() + 120000;
    await setChannelState(updated);

    return text(
      res,
      `Biome forced to ${biome.name}. ${getBiomeStatus(updated)}`
    );
  }

  // 4. Always return fresh computed status
  return text(res, getBiomeStatus(updated));
}
