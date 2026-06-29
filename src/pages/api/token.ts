import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { refundActiveTokenBuffs } from "@/lib/inventory";
import { text, error } from "@/lib/api-helpers";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, user } = getChannelContext(req);

  if (!user) {
    return error(res, "Token only works from Twitch chat.");
  }

  const result = await refundActiveTokenBuffs({
    channelId,
    user,
  });

  if (result.refunded.length === 0) {
    return text(res, "You have no active token buffs to refund.");
  }

  const count = result.refunded.reduce((sum, buff) => sum + buff.amount, 0);

  return text(
    res,
    `Refunded ${count} active token(s) back into your inventory.`
  );
}
