import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelState } from "@/lib/state";
import { getChannelContext } from "@/lib/nightbot";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName } = getChannelContext(req);
  const state = await getChannelState(channelId, channelName);

  res.status(200).send(state.biomeId);
}
