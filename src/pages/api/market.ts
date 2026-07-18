import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { buyMarketItem, formatMarket } from "@/lib/activity-of-knowledge-system";

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const {channelId,channelLoginName,user}=getChannelContext(req);
  const parts=parseQuery(req).trim().split(/\s+/).filter(Boolean);
  if((parts[0]??"").toLowerCase()==="buy")return text(res,await buyMarketItem(channelId,channelLoginName,user,parts.slice(1).join(" ")));
  return text(res,await formatMarket(channelId,channelLoginName,user));
}
