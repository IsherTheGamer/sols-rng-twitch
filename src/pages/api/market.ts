import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { buyMarketItem, formatMarket } from "@/lib/activity-of-knowledge-system";
import { resolveAlias } from "@/lib/fuzzy-alias";

const ACTIONS = [
  { id: "buy", label: "buy", aliases: ["purchase", "get", "open"], value: "buy" as const },
  { id: "status", label: "status", aliases: ["list", "show", "shop", "market"], value: "status" as const },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelLoginName, user } = getChannelContext(req);
  const parts = parseQuery(req).trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0 || /^\d+$/.test(parts[0])) {
    return text(res, await formatMarket(channelId, channelLoginName, user, parts[0] ?? "1"));
  }

  const action = resolveAlias(parts[0], ACTIONS, { maxScore: 0.3, ambiguityGap: 0.08 });
  if (action.status === "matched" && action.match.value === "buy") {
    return text(res, await buyMarketItem(channelId, channelLoginName, user, parts.slice(1).join(" ")));
  }

  const page = parts.find((part) => /^\d+$/.test(part)) ?? "1";
  return text(res, await formatMarket(channelId, channelLoginName, user, page));
}
