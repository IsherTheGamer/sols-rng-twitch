import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatBoss, startBoss, startBossWithBeacon } from "@/lib/activity-of-knowledge-system";
import { resolveBossInput } from "@/lib/activity-aliases";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelLoginName, isMod, user } = getChannelContext(req);
  const resolved = resolveBossInput(parseQuery(req));
  if (!resolved.action) return text(res, resolved.error ?? "Unknown boss action.");

  if (resolved.action === "start") {
    if (!isMod) return text(res, "Only mods/broadcaster can use !boss start. Players with Boss Beacon can use !boss beacon.");
    return text(res, await startBoss(channelId, channelLoginName));
  }

  if (resolved.action === "beacon") {
    return text(res, await startBossWithBeacon(channelId, channelLoginName, user));
  }

  return text(res, await formatBoss(channelId, channelLoginName));
}
