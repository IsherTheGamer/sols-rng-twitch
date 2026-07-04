import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { setDiscordWebhookFromAdmin } from "@/lib/mega-feature-system";

function cleanChannel(raw: unknown, fallback: string): string {
  return String(typeof raw === "string" ? raw : fallback).trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "") || fallback;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId } = getChannelContext(req);
  const target = cleanChannel(req.query.channel, channelId);
  return text(res, await setDiscordWebhookFromAdmin(req, target));
}
