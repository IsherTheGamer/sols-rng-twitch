import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelState } from "@/lib/state";
import { getChannelContext } from "@/lib/nightbot";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName } = getChannelContext(req);
  const state = await getChannelState(channelId, channelName);

  // ultra short format
  const msg = `${state.biomeId}:${state.timeOfDay[0]}:${Math.ceil(
    (state.biomeExpiresAt - Date.now()) / 1000
  )}`;

  // ALWAYS < 50 chars
  res.status(200).send(msg);
}
