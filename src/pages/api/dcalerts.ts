import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatDcAlerts } from "@/lib/mega-feature-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelLoginName, channelName, isMod } = getChannelContext(req);
  return text(res, await formatDcAlerts(channelId, channelLoginName ?? channelName, parseQuery(req), isMod));
}
