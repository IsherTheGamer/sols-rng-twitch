import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import {
  claimViewerLevelRewards,
  formatLevelClaimResult,
  formatViewerLevel,
  formatViewerLevelRewards,
  getViewerProfile,
} from "@/lib/profile";
import { parseQuery, text, error } from "@/lib/api-helpers";
import { truncate } from "@/lib/format";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, user } = getChannelContext(req);

  if (!user) {
    return error(res, "Level only works from Twitch chat.");
  }

  const query = parseQuery(req).toLowerCase().trim();

  if (
    query === "claim" ||
    query === "collect" ||
    query === "redeem"
  ) {
    const result = await claimViewerLevelRewards(channelId, user);

    return text(res, truncate(formatLevelClaimResult(result), 390));
  }

  const profile = await getViewerProfile(channelId, user);

  if (
    query === "rewards" ||
    query === "reward" ||
    query === "next" ||
    query === "pass"
  ) {
    return text(res, truncate(formatViewerLevelRewards(profile), 390));
  }

  return text(res, truncate(formatViewerLevel(profile), 390));
}
