import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatWorldEvent } from "@/lib/activity-of-knowledge-system";
export default async function handler(req:NextApiRequest,res:NextApiResponse){const {channelId,channelLoginName}=getChannelContext(req);return text(res,await formatWorldEvent(channelId,channelLoginName));}
