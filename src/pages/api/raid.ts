import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { activateRaidBoost } from "@/lib/social-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user, isMod } = getChannelContext(req);

  if (!isMod) {
    return text(res, "Raid boost is mod/broadcaster only.");
  }

  return text(res, await activateRaidBoost(channelId, user, parseQuery(req)));
}
