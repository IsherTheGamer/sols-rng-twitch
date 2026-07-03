import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { attemptSubCoreCraft, formatSubCoreStatus } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "").toLowerCase();

  if (action === "craft") {
    return text(res, await attemptSubCoreCraft(channelId, user));
  }

  return text(res, await formatSubCoreStatus(channelId, user));
}
