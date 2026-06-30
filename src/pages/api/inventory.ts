import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getViewerInventory, formatInventory } from "@/lib/inventory";
import { text, error } from "@/lib/api-helpers";
import { truncate } from "@/lib/format";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, user } = getChannelContext(req);

  if (!user) {
    return error(res, "Inventory only works from Twitch chat.");
  }

  const inventory = await getViewerInventory(channelId, user);

  return text(res, truncate(formatInventory(inventory), 390));
}
