import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

const KEY = "global:rolls";

export async function addGlobalRolls(amount = 1): Promise<number> {
  const r = getRedis();
  if (!r) return 0;

  const newValue = await r.incrby(KEY, amount);
  return newValue;
}

export async function getGlobalRolls(): Promise<number> {
  const r = getRedis();
  if (!r) return 0;

  const v = await r.get<number>(KEY);
  return v ?? 0;
}

export function getGlobalLuck(globalRolls: number): number {
  if (globalRolls >= 10000) return 4;
  if (globalRolls >= 1000) return 3;
  if (globalRolls >= 100) return 2;
  return 1;
}
