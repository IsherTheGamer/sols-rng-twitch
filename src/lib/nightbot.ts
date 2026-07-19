import type { Redis } from "@upstash/redis";
import { getCoalescedRedis } from "./redis-coalescer";
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

interface StoredNightbotToken {
  channel: string;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: number;
  updatedAt?: number;
}

interface NightbotTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

function parseKv(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split("&")) {
    const [k, v] = part.split("=");
    if (k) out[k] = decodeURIComponent(v ?? "");
  }
  return out;
}

function getRedis(): Redis | null {
  return getCoalescedRedis();
}

function normalizeChannelName(input: string | undefined | null): string {
  return (input ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function tokenKey(channelName: string): string {
  return `nightbot:channel:${normalizeChannelName(channelName)}`;
}

async function getStoredNightbotToken(
  channelName: string | undefined | null
): Promise<StoredNightbotToken | null> {
  const cleanChannel = normalizeChannelName(channelName);

  if (!cleanChannel) return null;

  const r = getRedis();

  if (!r) return null;

  return r.get<StoredNightbotToken>(tokenKey(cleanChannel));
}

async function saveStoredNightbotToken(token: StoredNightbotToken): Promise<void> {
  const cleanChannel = normalizeChannelName(token.channel);
  const r = getRedis();

  if (!cleanChannel || !r) return;

  await r.set(tokenKey(cleanChannel), {
    ...token,
    channel: cleanChannel,
    updatedAt: Date.now(),
  });
}

async function refreshStoredNightbotToken(
  stored: StoredNightbotToken
): Promise<StoredNightbotToken | null> {
  const clientId = process.env.NIGHTBOT_CLIENT_ID;
  const clientSecret = process.env.NIGHTBOT_CLIENT_SECRET;
  const redirectUri = process.env.NIGHTBOT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri || !stored.refreshToken) {
    return stored;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    redirect_uri: redirectUri,
    refresh_token: stored.refreshToken,
  });

  try {
    const response = await fetch("https://api.nightbot.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) return stored;

    const refreshed = (await response.json()) as NightbotTokenResponse;

    const next: StoredNightbotToken = {
      channel: normalizeChannelName(stored.channel),
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      tokenType: refreshed.token_type,
      scope: refreshed.scope,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      updatedAt: Date.now(),
    };

    await saveStoredNightbotToken(next);

    return next;
  } catch {
    return stored;
  }
}

async function getValidStoredNightbotToken(
  channelName: string | undefined | null
): Promise<StoredNightbotToken | null> {
  const stored = await getStoredNightbotToken(channelName);

  if (!stored?.accessToken) return null;

  const refreshSoonMs = 5 * 60 * 1000;

  if (!stored.expiresAt || stored.expiresAt > Date.now() + refreshSoonMs) {
    return stored;
  }

  return refreshStoredNightbotToken(stored);
}

async function sendWithToken(token: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.nightbot.tv/1/channel/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: message.slice(0, 400) }),
    });

    return res.ok;
  } catch {
    return false;
  }
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
  const channelLoginName = normalizeChannelName(
    channel?.name ?? channel?.displayName ?? channelName
  );

  return {
    channel,
    user,
    channelId,
    channelName,
    channelLoginName,
    isMod: isMod(user),
  };
}

export async function sendNightbotMessage(
  message: string,
  channelName?: string | null
): Promise<boolean> {
  const stored = await getValidStoredNightbotToken(channelName);

  if (stored?.accessToken && (await sendWithToken(stored.accessToken, message))) {
    return true;
  }

  const fallbackToken = process.env.NIGHTBOT_TOKEN;

  if (!fallbackToken) return false;

  return sendWithToken(fallbackToken, message);
}
