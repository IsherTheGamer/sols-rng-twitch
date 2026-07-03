import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { claimQuest, formatQuestStatus } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "daily").toLowerCase();

  if (action === "claim") return text(res, await claimQuest(channelId, user, args[1] ?? ""));

  const kind = action === "weekly" || action === "story" || action === "daily" ? action : "daily";
  return text(res, await formatQuestStatus(channelId, user, kind));
}
