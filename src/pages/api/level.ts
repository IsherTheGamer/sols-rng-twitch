import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import {
  formatViewerLevel,
  formatViewerLevelRewards,
  getViewerProfile,
} from "@/lib/profile";
import { parseQuery, text, error } from "@/lib/api-helpers";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, user } = getChannelContext(req);

  if (!user) {
    return error(res, "Level only works from Twitch chat.");
  }

  const query = parseQuery(req).toLowerCase().trim();
  const profile = await getViewerProfile(channelId, user);

  if (
    query === "rewards" ||
    query === "reward" ||
    query === "next" ||
    query === "pass"
  ) {
    return text(res, formatViewerLevelRewards(profile));
  }

  return text(res, formatViewerLevel(profile));
}
