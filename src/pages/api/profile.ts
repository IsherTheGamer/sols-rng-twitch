import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getViewerProfile, formatViewerProfile } from "@/lib/profile";
import { text, error } from "@/lib/api-helpers";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, user } = getChannelContext(req);

  if (!user) {
    return error(res, "Profile only works from Twitch chat.");
  }

  const profile = await getViewerProfile(channelId, user);

  return text(res, formatViewerProfile(profile));
}
