import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { getViewerProfile } from "@/lib/profile";
import {
  attemptShdCraft,
  attemptShdUpgrade,
  formatShdStatus,
} from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "").toLowerCase();
  const profile = await getViewerProfile(channelId, user);
  const totalRolls = profile.rolls + profile.tokenRolls;

  if (action === "craft") {
    return text(res, await attemptShdCraft(channelId, user, totalRolls));
  }

  if (action === "upgrade") {
    return text(res, await attemptShdUpgrade(channelId, user));
  }

  return text(res, await formatShdStatus(channelId, user, totalRolls));
}
