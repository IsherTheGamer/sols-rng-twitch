import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelState } from "@/lib/state";
import { getChannelContext } from "@/lib/nightbot";
import { getBiomeStatus } from "@/lib/biome-engine";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName } = getChannelContext(req);

  const state = await getChannelState(channelId, channelName);

  const biome = state.biomeId.toUpperCase();
  const time = state.timeOfDay === "daytime" ? "DAY" : "NIGHT";

  const remainingSec = Math.max(
    0,
    Math.ceil((state.biomeExpiresAt - Date.now()) / 1000)
  );

  // SUPER SHORT BOT FORMAT (safe for Twitch/MixItUp/Nightbot)
  const output = `${biome} | ${time} | ${remainingSec}s`;

  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(output);
}
