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

  // 1. LOAD STATE
  let state = await getChannelState(channelId, channelName);

  // 2. ALWAYS FORCE REAL-TIME TICK UPDATE (KEY FIX)
  const now = Date.now();
  const elapsed = Math.max(1, now - state.lastTickAt);

  const tick = await processBiomeTick(state, elapsed);
  state = tick.state;

  await setChannelState(state);

  // 3. FORCE BIOME RECOVERY CHECK (IMPORTANT FIX)
  // If biome is "stuck expired", force re-roll
  if (state.biomeExpiresAt <= now) {
    const fallback = await processBiomeTick(state, 1);

    state = fallback.state;
    await setChannelState(state);
  }

  // 4. ADMIN FORCE CHANGE
  if (action === "change") {
    if (!isMod) return error(res, "Mod only.");

    const query = parseQuery(req);
    const biome = findBiome(query);

    if (!biome) {
      return error(res, `Unknown biome: ${query}`);
    }

    state.biomeId = biome.id;
    state.biomeExpiresAt = Date.now() + 120000;

    await setChannelState(state);

    return text(
      res,
      `Biome forced to ${biome.name}. ${getBiomeStatus(state)}`
    );
  }

  // 5. RETURN FRESH STATUS EVERY TIME
  return text(res, getBiomeStatus(state));
}
