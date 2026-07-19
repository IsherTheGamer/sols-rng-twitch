import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatFirstsV2 } from "@/lib/half2-mega-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId } = getChannelContext(req);
  return text(res, await formatFirstsV2(channelId, parseQuery(req)));
}
