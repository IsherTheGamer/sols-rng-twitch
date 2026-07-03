import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName, user } = getChannelContext(req);

  return text(
    res,
    `Channel=${channelName} | channelId=${channelId} | User=${user?.displayName ?? user?.name ?? "Player"} | userId=${user?.providerId ?? "anon"}`
  );
}
