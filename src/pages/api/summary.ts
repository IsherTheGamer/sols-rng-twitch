import type { NextApiRequest, NextApiResponse } from "next";
import { text, verifyCron } from "@/lib/api-helpers";
import { postDiscordSummary, type QuestPeriod } from "@/lib/mega-feature-system";
function clean(raw: unknown, fallback: string): string { return String(typeof raw === "string" ? raw : fallback).trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "") || fallback; }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyCron(req)) return res.status(401).send("Unauthorized");
  const channel = clean(req.query.channel, process.env.DEFAULT_CHANNEL_NAME ?? process.env.DEFAULT_CHANNEL_ID ?? "default");
  const period = (["daily", "weekly", "monthly", "yearly"].includes(String(req.query.period)) ? String(req.query.period) : "daily") as QuestPeriod;
  return text(res, await postDiscordSummary(channel, channel, period));
}
