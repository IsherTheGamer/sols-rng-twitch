import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getChannelState, setChannelState } from "@/lib/state";
import {
  applyBiomeChange,
  getBiomeStatus,
} from "@/lib/biome-engine";
import { findBiome } from "@/lib/data";
import { text, error, parseQuery } from "@/lib/api-helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName, isMod } = getChannelContext(req);
const action = req.query.action;

const state = await getChannelState(channelId, channelName);

if (action === "change") {
  if (!isMod) return error(res, "Mod only.");
  const query = parseQuery(req);
  const biome = findBiome(query);
  if (!biome) return error(res, `Unknown biome: ${query}`);

  applyBiomeChange(state, biome.id);
  await setChannelState(state);

  return text(res, `Biome forced to ${biome.name}. ${getBiomeStatus(state)}`);
}

/* 🔥 FIX: let engine handle time properly */
const result = await processBiomeTick(state, Date.now() - state.lastTickAt);

await setChannelState(result.state);

return text(res, getBiomeStatus(result.state));

  const now = Date.now();
const elapsed = now - state.lastTickAt;

const result = await processBiomeTick(state, elapsed);
await setChannelState(result.state);

return text(res, getBiomeStatus(result.state));
}
