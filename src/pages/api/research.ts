import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatResearch, unlockResearch } from "@/lib/activity-of-knowledge-system";
import { resolveResearchInput } from "@/lib/activity-aliases";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const resolved = resolveResearchInput(parseQuery(req));
  if (!resolved.query && resolved.error) return text(res, resolved.error);

  const query = resolved.query ?? "";
  const [action, ...rest] = query.split(/\s+/).filter(Boolean);

  if (action === "unlock") {
    return text(res, await unlockResearch(channelId, user, rest.join(" ")));
  }

  return text(res, await formatResearch(channelId, user, query));
}
