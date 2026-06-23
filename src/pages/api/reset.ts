import type { NextApiRequest, NextApiResponse } from "next";
import { setChannelState } from "@/lib/state";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const state = {
    channelId: process.env.DEFAULT_CHANNEL_ID ?? "default",
    channelName: "default",

    biomeId: "normal",
    biomeExpiresAt: Date.now() + 120000,

    timeOfDay: "daytime",
    timeExpiresAt: Date.now() + 150000,

    activeEvents: [],
    activeDevBiome: null,
    devExpiresAt: 0,
    bloodRainExpiresAt: 0,

    lastStatusAt: 0,
    lastTickAt: Date.now(),

    deviceServerCooldownUntil: 0,
    strangeControllerCooldownUntil: 0,
    biomeRandomizerCooldownUntil: 0,
  };

  await setChannelState(state as any);

  res.status(200).send("reset ok");
}
