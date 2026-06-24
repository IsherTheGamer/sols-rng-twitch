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

export function getNextLuckMilestone(globalRolls: number): {
  target: number;
  remaining: number;
  nextLuck: number;
} {
  if (globalRolls < 100) {
    return {
      target: 100,
      remaining: 100 - globalRolls,
      nextLuck: 2,
    };
  }

  if (globalRolls < 1000) {
    return {
      target: 1000,
      remaining: 1000 - globalRolls,
      nextLuck: 3,
    };
  }

  if (globalRolls < 10000) {
    return {
      target: 10000,
      remaining: 10000 - globalRolls,
      nextLuck: 4,
    };
  }

  return {
    target: 10000,
    remaining: 0,
    nextLuck: 4,
  };
}
