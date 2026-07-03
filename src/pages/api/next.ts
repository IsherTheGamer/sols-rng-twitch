import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { getViewerProfile } from "@/lib/profile";
import { formatNextStep } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const profile = await getViewerProfile(channelId, user);
  return text(res, await formatNextStep(channelId, user, profile.rolls + profile.tokenRolls));
}
