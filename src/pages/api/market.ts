import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { buyMarketItem, formatMarket } from "@/lib/activity-of-knowledge-system";
export default async function handler(req:NextApiRequest,res:NextApiResponse){const {channelId,channelLoginName,user}=getChannelContext(req);const q=parseQuery(req).trim();const [a,...r]=q.split(/\s+/).filter(Boolean);if((a??"").toLowerCase()==="buy")return text(res,await buyMarketItem(channelId,channelLoginName,user,r.join(" ")));return text(res,await formatMarket(channelId,channelLoginName));}
