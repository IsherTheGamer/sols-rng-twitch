import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { claimQuest, formatQuestStatus } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);
  if ((args[0] ?? "").toLowerCase() === "claim") return text(res, await claimQuest(channelId, user, "daily"));
  return text(res, await formatQuestStatus(channelId, user, "daily"));
}
