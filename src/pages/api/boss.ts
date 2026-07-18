import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatBoss, startBoss, startBossWithBeacon } from "@/lib/activity-of-knowledge-system";

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const {channelId,channelLoginName,isMod,user}=getChannelContext(req);
  const action=parseQuery(req).trim().toLowerCase().split(/\s+/)[0]??"";
  if(action==="start"){
    if(!isMod)return text(res,"Only mods/broadcaster can use !boss start. Players with Boss Beacon can use !boss beacon.");
    return text(res,await startBoss(channelId,channelLoginName));
  }
  if(action==="beacon")return text(res,await startBossWithBeacon(channelId,channelLoginName,user));
  return text(res,await formatBoss(channelId,channelLoginName));
}
