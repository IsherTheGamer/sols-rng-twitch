import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatMerchant } from "@/lib/social-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user, isMod } = getChannelContext(req);
  const query = parseQuery(req);

  if (query.trim().split(/\s+/)[0]?.toLowerCase() === "spawn" && !isMod) {
    return text(res, "Merchant spawn is mod/broadcaster only.");
  }

  return text(res, await formatMerchant(channelId, user, query));
}
