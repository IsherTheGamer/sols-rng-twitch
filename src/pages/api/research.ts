import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatResearch, unlockResearch } from "@/lib/activity-of-knowledge-system";
export default async function handler(req:NextApiRequest,res:NextApiResponse){const {channelId,user}=getChannelContext(req);const q=parseQuery(req).trim();const [a,...r]=q.split(/\s+/).filter(Boolean);if((a??"").toLowerCase()==="unlock")return text(res,await unlockResearch(channelId,user,r.join(" ")));return text(res,await formatResearch(channelId,user,q));}
