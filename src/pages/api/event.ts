import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatChannelEventV2 } from "@/lib/half2-mega-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user, isMod } = getChannelContext(req);
  return text(res, await formatChannelEventV2(channelId, user, parseQuery(req), isMod));
}
