import type { Redis } from "@upstash/redis";
import { getCoalescedRedis } from "./redis-coalescer";
import type { ChannelState } from "../types/data";

function getRedis(): Redis | null {
  return getCoalescedRedis();
}

const DEFAULT_STATE = (
  channelId: string,
  channelName: string
): ChannelState => ({
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

export async function setChannelState(
  state: ChannelState
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(`channel:${state.channelId}:state`, state);
}

export async function getCooldown(key: string): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  const value = await r.get<number>(key);
  return value ?? 0;
}

export async function setCooldown(
  key: string,
  until: number
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const ttl = Math.max(1, Math.ceil((until - Date.now()) / 1000));
  await r.set(key, until, { ex: ttl });
}

/**
 * Acquires a cooldown atomically.
 *
 * Successful requests use one Redis command. A blocked request performs one
 * extra read only so the user can see the remaining time.
 */
export async function acquireCooldown(
  key: string,
  cooldownMs: number
): Promise<{ allowed: boolean; remainingMs: number }> {
  const r = getRedis();
  if (!r) return { allowed: true, remainingMs: 0 };

  const safeMs = Math.max(1, Math.floor(cooldownMs));
  const now = Date.now();
  const until = now + safeMs;

  const acquired = await r.set(key, until, {
    nx: true,
    px: safeMs,
  });

  if (acquired) {
    return { allowed: true, remainingMs: 0 };
  }

  const existing = (await r.get<number>(key)) ?? 0;

  if (existing <= Date.now()) {
    const retryNow = Date.now();
    const retryUntil = retryNow + safeMs;
    const retried = await r.set(key, retryUntil, {
      nx: true,
      px: safeMs,
    });

    if (retried) {
      return { allowed: true, remainingMs: 0 };
    }
  }

  return {
    allowed: false,
    remainingMs: Math.max(1, existing - Date.now()),
  };
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
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
