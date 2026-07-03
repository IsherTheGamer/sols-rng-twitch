import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { claimAchievements, formatAchievementsStatus } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const action = (parseQuery(req).trim().split(/\s+/)[0] ?? "").toLowerCase();

  if (action === "claim") return text(res, await claimAchievements(channelId, user));
  return text(res, await formatAchievementsStatus(channelId, user));
}
