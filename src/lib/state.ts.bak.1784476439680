import { Redis } from "@upstash/redis";
import type { ChannelState } from "../types/data";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const DEFAULT_STATE = (channelId: string, channelName: string): ChannelState => ({
  channelId,
  channelName,
  biomeId: "normal",
  biomeExpiresAt: 0,
  timeOfDay: "daytime",
  timeExpiresAt: Date.now() + 150000,
  activeEvents: [],
  activeDevBiome: null,
  devExpiresAt: 0,
  bloodRainExpiresAt: 0,
  lastStatusAt: 0,
  lastTickAt: Date.now(),
  deviceServerCooldownUntil: 0,
  strangeControllerCooldownUntil: 0,
  biomeRandomizerCooldownUntil: 0,
});

export async function getChannelState(
  channelId: string,
  channelName = "default"
): Promise<ChannelState> {
  const r = getRedis();
  if (!r) return DEFAULT_STATE(channelId, channelName);
  const key = `channel:${channelId}:state`;
  const data = await r.get<ChannelState>(key);
  if (!data) return DEFAULT_STATE(channelId, channelName);
  return data;
}

export async function setChannelState(state: ChannelState): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(`channel:${state.channelId}:state`, state);
}

export async function getCooldown(key: string): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  const v = await r.get<number>(key);
  return v ?? 0;
}

export async function setCooldown(key: string, until: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const ttl = Math.max(1, Math.ceil((until - Date.now()) / 1000));
  await r.set(key, until, { ex: ttl });
}

export function cooldownKey(
  type: string,
  channelId: string,
  userId?: string
): string {
  if (userId) return `cd:${type}:${channelId}:${userId}`;
  return `cd:${type}:${channelId}`;
}

export function formatRemaining(until: number): string {
  const sec = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
