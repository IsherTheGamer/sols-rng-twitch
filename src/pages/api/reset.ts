import type { NextApiRequest, NextApiResponse } from "next";
import { Redis } from "@upstash/redis";
import { createDefaultAchievementState } from "@/lib/achievements";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

function getResetKey(): string | null {
  return process.env.RESET_SECRET ?? process.env.CRON_SECRET ?? null;
}

function verifyReset(req: NextApiRequest): boolean {
  const requiredKey = getResetKey();

  if (!requiredKey) return false;

  const providedKey = req.query.key;

  return providedKey === requiredKey;
}

async function scanKeys(pattern: string): Promise<string[]> {
  const r = getRedis();

  if (!r) return [];

  const keys: string[] = [];
  let cursor = 0;

  do {
    const result = (await r.scan(cursor, {
      match: pattern,
      count: 100,
    })) as [number | string, string[]];

    cursor = Number(result[0]);
    keys.push(...result[1]);
  } while (cursor !== 0);

  return keys;
}

async function deleteKeys(keys: string[]): Promise<number> {
  const r = getRedis();

  if (!r || keys.length === 0) return 0;

  let deleted = 0;

  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    deleted += await r.del(...chunk);
  }

  return deleted;
}

async function resetGameData(): Promise<{
  deleted: number;
  resetGlobals: boolean;
}> {
  const r = getRedis();

  if (!r) {
    return {
      deleted: 0,
      resetGlobals: false,
    };
  }

  const patterns = [
    // Channel/server state
    "channel:*:state",
    "channel:*:announcement-settings",

    // Viewer profiles
    "profile:*",
    "profiles:*:keys",

    // Cooldowns
    "cd:*",
  ];

  const keys = (
    await Promise.all(patterns.map((pattern) => scanKeys(pattern)))
  ).flat();

  const deleted = await deleteKeys([...new Set(keys)]);

  await r.set("global:rolls", 0);
  await r.set("global:achievement-state", createDefaultAchievementState());

  return {
    deleted,
    resetGlobals: true,
  };
}

async function wipeOAuthTokens(): Promise<number> {
  const keys = await scanKeys("nightbot:channel:*");
  keys.push("nightbot:channels");

  return deleteKeys([...new Set(keys)]);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyReset(req)) {
    return res.status(401).send("Unauthorized reset.");
  }

  const type = String(req.query.type ?? "game").toLowerCase().trim();

  if (type === "game" || type === "full" || type === "all") {
    const result = await resetGameData();

    return res
      .status(200)
      .send(
        `reset game ok | deleted ${result.deleted} keys | globals reset: ${result.resetGlobals}`
      );
  }

  if (type === "oauth" || type === "nightbot") {
    const deleted = await wipeOAuthTokens();

    return res
      .status(200)
      .send(
        `reset oauth ok | deleted ${deleted} keys | streamers must reconnect Nightbot`
      );
  }

  if (type === "everything" || type === "danger") {
    const game = await resetGameData();
    const oauthDeleted = await wipeOAuthTokens();

    return res
      .status(200)
      .send(
        `reset everything ok | game deleted ${game.deleted} keys | oauth deleted ${oauthDeleted} keys`
      );
  }

  return res
    .status(400)
    .send("Unknown reset type. Use: game, oauth, or everything");
}
