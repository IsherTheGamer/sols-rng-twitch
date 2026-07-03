import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { craftById, formatCraftRecipe } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);

  if (args.length === 0) {
    return text(res, "Use !craft <component>, !craft chassis, !craft frame, or !craft recipe <item>.");
  }

  const action = args[0].toLowerCase();

  if (action === "recipe") {
    const item = args.slice(1).join(" ");
    if (!item) return text(res, "Use !craft recipe <item>.");
    return text(res, await formatCraftRecipe(channelId, user, item));
  }

  return text(res, await craftById(channelId, user, args.join(" ")));
}
