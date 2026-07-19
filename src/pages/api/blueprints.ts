import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatBlueprints } from "@/lib/activity-of-knowledge-system";
import { resolveBlueprintInput } from "@/lib/activity-aliases";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const resolved = resolveBlueprintInput(parseQuery(req));
  if (!resolved.query && resolved.error) return text(res, resolved.error);
  return text(res, await formatBlueprints(channelId, user, resolved.query ?? ""));
}
