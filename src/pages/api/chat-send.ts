import type { NextApiRequest, NextApiResponse } from "next";
import { text, verifyCron } from "@/lib/api-helpers";
import { sendNightbotMessage } from "@/lib/nightbot";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeChannel(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function readBodyField(req: NextApiRequest, key: "msg" | "message"): string {
  if (!req.body || typeof req.body !== "object") return "";
  const value = (req.body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function readMessage(req: NextApiRequest): string {
  const raw =
    readBodyField(req, "msg") ||
    readBodyField(req, "message") ||
    first(req.query.msg) ||
    first(req.query.message) ||
    first(req.query.query) ||
    first(req.query.text);

  return raw.replace(/\s+/g, " ").trim().slice(0, 390);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyCron(req)) {
    return res.status(401).send("Unauthorized");
  }

  const channel =
    normalizeChannel(
      first(req.query.channel) ||
        first(req.query.channelName) ||
        process.env.DEFAULT_CHANNEL_NAME ||
        process.env.DEFAULT_CHANNEL ||
        ""
    ) || undefined;

  const msg = readMessage(req);

  if (!msg) {
    return text(res, "Use /api/chat-send?token=CRON_SECRET&channel=zipittt&msg=your message");
  }

  const ok = await sendNightbotMessage(msg, channel);

  if (!ok) {
    return text(res, "❌ Nightbot send failed. Check NIGHTBOT_TOKEN or connected Nightbot OAuth.");
  }

  return text(res, `✅ Sent to ${channel ?? "default channel"}: ${msg}`);
}
