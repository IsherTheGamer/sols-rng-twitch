import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const ctx = getChannelContext(req);

  res.json({
    channelId: ctx.channelId,
    channelName: ctx.channelName,
    user: ctx.user,
    isMod: ctx.isMod
  });
}
