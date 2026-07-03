import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { debugCoreSystem } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  return text(res, await debugCoreSystem(channelId, user, parseQuery(req), token));
}
