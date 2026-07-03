import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import {
  attemptCoreUpgrade,
  chooseCorePath,
  formatCoreRecipe,
  formatCoreStatus,
  setCoreFocus,
  switchCorePath,
} from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "").toLowerCase();

  if (action === "upgrade") return text(res, await attemptCoreUpgrade(channelId, user));
  if (action === "recipe") return text(res, await formatCoreRecipe(channelId, user));
  if (action === "focus") return text(res, await setCoreFocus(channelId, user, args[1] ?? ""));
  if (action === "choose") return text(res, await chooseCorePath(channelId, user, args[1] ?? ""));
  if (action === "switch") return text(res, await switchCorePath(channelId, user, args[1] ?? ""));

  return text(res, await formatCoreStatus(channelId, user));
}
