import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatRelics } from "@/lib/activity-of-knowledge-system";
import { resolveRelicInput } from "@/lib/activity-aliases";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const resolved = await resolveRelicInput(channelId, user, parseQuery(req));
  if (!resolved.query && resolved.error) return text(res, resolved.error);
  return text(res, await formatRelics(channelId, user, resolved.query ?? ""));
}
