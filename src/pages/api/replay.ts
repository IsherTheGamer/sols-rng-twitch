import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatReplay } from "@/lib/mega-feature-system";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId } = getChannelContext(req);
  return text(res, await formatReplay(channelId, parseQuery(req)));
}
