import type { NextApiRequest } from "next";

export interface NightbotUser {
  name: string;
  displayName: string;
  provider: string;
  providerId: string;
  userLevel: string;
}

export interface NightbotChannel {
  name: string;
  displayName: string;
  provider: string;
  providerId: string;
}

function parseKv(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split("&")) {
    const [k, v] = part.split("=");
    if (k) out[k] = decodeURIComponent(v ?? "");
  }
  return out;
}

export function parseNightbotUser(req: NextApiRequest): NightbotUser | null {
  const raw = req.headers["nightbot-user"];
  if (!raw || typeof raw !== "string") return null;
  const kv = parseKv(raw);
  if (!kv.providerId) return null;
  return {
    name: kv.name ?? "unknown",
    displayName: kv.displayName ?? kv.name ?? "unknown",
    provider: kv.provider ?? "twitch",
    providerId: kv.providerId,
    userLevel: kv.userLevel ?? "everyone",
  };
}

export function parseNightbotChannel(req: NextApiRequest): NightbotChannel | null {
  const raw = req.headers["nightbot-channel"];
  if (!raw || typeof raw !== "string") return null;
  const kv = parseKv(raw);
  if (!kv.providerId) return null;
  return {
    name: kv.name ?? "default",
    displayName: kv.displayName ?? kv.name ?? "default",
    provider: kv.provider ?? "twitch",
    providerId: kv.providerId,
  };
}

export function isMod(user: NightbotUser | null): boolean {
  if (!user) return false;
  const level = user.userLevel.toLowerCase();
  return ["owner", "moderator", "host", "editor", "admin"].includes(level);
}

export function getChannelContext(req: NextApiRequest) {
  const channel = parseNightbotChannel(req);
  const user = parseNightbotUser(req);
  const channelId =
    channel?.providerId ??
    process.env.DEFAULT_CHANNEL_ID ??
    "default";
  const channelName = channel?.displayName ?? channel?.name ?? "default";
  return { channel, user, channelId, channelName, isMod: isMod(user) };
}

export async function sendNightbotMessage(message: string): Promise<boolean> {
  const token = process.env.NIGHTBOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch("https://api.nightbot.tv/1/channel/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
