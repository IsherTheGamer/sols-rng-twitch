import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatChannelEvent } from "@/lib/mega-feature-system";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user, isMod } = getChannelContext(req);
  return text(res, await formatChannelEvent(channelId, user, parseQuery(req), isMod));
}
