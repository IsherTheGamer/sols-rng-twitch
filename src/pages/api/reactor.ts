import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import {
  formatReactorRecipe,
  formatReactorStatus,
  reactorClaim,
  reactorDeposit,
  reactorUpgrade,
} from "@/lib/core-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "").toLowerCase();

  if (action === "deposit") return text(res, await reactorDeposit(channelId, user, args[1] ?? ""));
  if (action === "claim") return text(res, await reactorClaim(channelId, user));
  if (action === "upgrade") return text(res, await reactorUpgrade(channelId, user));
  if (action === "recipe") return text(res, await formatReactorRecipe(channelId, user));

  return text(res, await formatReactorStatus(channelId, user));
}
