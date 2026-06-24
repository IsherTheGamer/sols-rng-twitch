import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getChannelState, setChannelState } from "@/lib/state";
import { findDevBiome, biomeMap } from "@/lib/data";
import devEventsData from "../../../data/dev-events.json";
import { text, error, parseQuery } from "@/lib/api-helpers";

const DEV_DURATION = (devEventsData.durationSeconds as number) ?? 3600;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName, isMod } = getChannelContext(req);
  if (!isMod) return error(res, "Mod only.");

  const query = parseQuery(req).toLowerCase();
  const state = await getChannelState(channelId, channelName);

  if (query === "off" || query === "clear" || query === "none") {
    state.activeDevBiome = null;
    state.devExpiresAt = 0;
    await setChannelState(state);
    return text(res, "Dev event cleared.");
  }

  const dev = findDevBiome(query);
  if (!dev) return error(res, `Unknown dev biome: ${query}`);

  state.activeDevBiome = dev.id;
  state.devExpiresAt = Date.now() + DEV_DURATION * 1000;
  state.biomeId = dev.id;
state.biomeExpiresAt = Date.now() + 3600 * 1000;
  await setChannelState(state);

  const b = biomeMap.get(dev.id);
  return text(
    res,
    `Dev event ${b?.name ?? dev.id} active for 1 hour. Luck mult: 1.2x on potions.`
  );
}
