import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatBoss, startBoss } from "@/lib/activity-of-knowledge-system";
export default async function handler(req:NextApiRequest,res:NextApiResponse){const {channelId,channelLoginName,isMod}=getChannelContext(req);const a=parseQuery(req).trim().toLowerCase().split(/\s+/)[0]??"";if(a==="start"){if(!isMod)return text(res,"Only mods/broadcaster can start bosses.");return text(res,await startBoss(channelId,channelLoginName));}return text(res,await formatBoss(channelId,channelLoginName));}
