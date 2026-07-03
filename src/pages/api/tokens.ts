import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatTokensStatus } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const page = parseQuery(req).trim().split(/\s+/).filter(Boolean)[0] ?? "1";
  return text(res, await formatTokensStatus(channelId, user, page));
}
