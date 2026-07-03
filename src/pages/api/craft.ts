import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { craftByIdAmount, formatCraftRecipe } from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);

  if (args.length === 0) {
    return text(res, "Use !craft <component> [amount], !craft chassis, !craft frame, or !craft recipe <item>.");
  }

  const action = args[0].toLowerCase();

  if (action === "recipe") {
    const item = args.slice(1).join(" ");
    if (!item) return text(res, "Use !craft recipe <item>.");
    return text(res, await formatCraftRecipe(channelId, user, item));
  }

  let amount = 1;
  const last = args[args.length - 1];

  if (/^\d{1,6}$/.test(last)) {
    amount = Math.max(1, Math.min(10000, parseInt(last, 10)));
    args.pop();
  }

  const item = args.join(" ");

  if (!item) {
    return text(res, "Use !craft <component> [amount]. Example: !craft basic wire 100");
  }

  return text(res, await craftByIdAmount(channelId, user, item, amount));
}
