import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatComponentsStatus } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);

  return text(res, await formatComponentsStatus(channelId, user));
}
