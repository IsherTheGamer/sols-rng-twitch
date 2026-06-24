import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { applyBiomeChange } from "@/lib/biome-engine";
import { findBiome } from "@/lib/data";
import { error, parseQuery } from "@/lib/api-helpers";
import { withTick } from "@/lib/run-with-tick";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName, isMod } = getChannelContext(req);
  const action = req.query.action;

  return withTick(channelId, channelName, async (state) => {

    // ❗ ONLY CHANGE ACTION
    if (action === "change") {
      if (!isMod) return error(res, "Mod only.");

      const query = parseQuery(req);
      const biome = findBiome(query);

      if (!biome) return error(res, `Unknown biome: ${query}`);

      applyBiomeChange(state, biome.id);
    }

    // ✅ ALWAYS RETURN CLEAN JSON (for Mix It Up / bot use)
    return res.json({
      biome: state.biomeId,
      time: state.timeOfDay,
      remaining: Math.max(
        0,
        Math.ceil((state.biomeExpiresAt - Date.now()) / 1000)
      ),
    });
  });
}
