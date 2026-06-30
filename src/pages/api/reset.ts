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

async function deletePatterns(patterns: string[]): Promise<number> {
  const keys = (
    await Promise.all(patterns.map((pattern) => scanKeys(pattern)))
  ).flat();

  return deleteKeys([...new Set(keys)]);
}

async function resetGlobals(): Promise<void> {
  const r = getRedis();

  if (!r) return;

  await r.set("global:rolls", 0);
  await r.set("global:achievement-state", createDefaultAchievementState());
}

async function resetGameData(): Promise<{
  deleted: number;
  resetGlobals: boolean;
}> {
  const deleted = await deletePatterns([
    // Channel/server state
    "channel:*:state",
    "channel:*:announcement-settings",

    // Viewer profiles / progression
    "profile:*",
    "profiles:*:keys",

    // Inventories / tokens / items / pending token gifts
    "inventory:*",
    "inventory-grants:*",
    "item:*",
    "items:*",

    // Cooldowns
    "cd:*",

    // Personal quests
    "quest:*",
    "quests:*",
    "viewer-quest:*",
    "viewer-quests:*",

    // Global quests
    "global-quest:*",
    "global-quests:*",
    "weekly-quest:*",
    "monthly-quest:*",
    "yearly-quest:*",

    // Future currency systems
    "currency:*",
    "wallet:*",
    "wallets:*",
    "economy:*",
    "coins:*",
    "coin:*",
  ]);

  await resetGlobals();

  return {
    deleted,
    resetGlobals: true,
  };
}

async function resetProfiles(): Promise<number> {
  return deletePatterns([
    "profile:*",
    "profiles:*:keys",
  ]);
}

async function resetInventories(): Promise<number> {
  return deletePatterns([
    "inventory:*",
    "inventory-grants:*",
    "item:*",
    "items:*",
  ]);
}

async function resetTokensOnly(): Promise<number> {
  return deletePatterns([
    "inventory:*",
    "inventory-grants:*",
  ]);
}

async function resetProgression(): Promise<number> {
  const deleted = await deletePatterns([
    "profile:*",
    "profiles:*:keys",
    "inventory:*",
    "inventory-grants:*",
    "quest:*",
    "quests:*",
    "viewer-quest:*",
    "viewer-quests:*",
  ]);

  await resetGlobals();

  return deleted;
}

async function resetCooldowns(): Promise<number> {
  return deletePatterns(["cd:*"]);
}

async function resetQuests(): Promise<number> {
  return deletePatterns([
    "quest:*",
    "quests:*",
    "viewer-quest:*",
    "viewer-quests:*",
    "global-quest:*",
    "global-quests:*",
    "weekly-quest:*",
    "monthly-quest:*",
    "yearly-quest:*",
  ]);
}

async function resetGlobalQuests(): Promise<number> {
  return deletePatterns([
    "global-quest:*",
    "global-quests:*",
    "weekly-quest:*",
    "monthly-quest:*",
    "yearly-quest:*",
  ]);
}

async function resetCurrency(): Promise<number> {
  return deletePatterns([
    "currency:*",
    "wallet:*",
    "wallets:*",
    "economy:*",
    "coins:*",
    "coin:*",
  ]);
}

async function wipeOAuthTokens(): Promise<number> {
  const keys = await scanKeys("nightbot:channel:*");
  keys.push("nightbot:channels");

  return deleteKeys([...new Set(keys)]);
}

function helpText(): string {
  return [
    "Reset types:",
    "game",
    "profiles",
    "inventories",
    "tokens",
    "progression",
    "cooldowns",
    "quests",
    "globalquests",
    "currency",
    "globals",
    "oauth",
    "everything",
  ].join(", ");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyReset(req)) {
    return res.status(401).send("Unauthorized reset.");
  }

  const type = String(req.query.type ?? "help").toLowerCase().trim();

  if (type === "help") {
    return res.status(200).send(helpText());
  }

  if (type === "game" || type === "full" || type === "all") {
    const result = await resetGameData();

    return res
      .status(200)
      .send(
        `reset game ok | deleted ${result.deleted} keys | globals reset: ${result.resetGlobals}`
      );
  }

  if (type === "profiles") {
    const deleted = await resetProfiles();

    return res.status(200).send(`reset profiles ok | deleted ${deleted} keys`);
  }

  if (type === "inventories" || type === "inventory" || type === "items") {
    const deleted = await resetInventories();

    return res
      .status(200)
      .send(`reset inventories ok | deleted ${deleted} keys`);
  }

  if (type === "tokens") {
    const deleted = await resetTokensOnly();

    return res.status(200).send(`reset tokens ok | deleted ${deleted} keys`);
  }

  if (type === "progression") {
    const deleted = await resetProgression();

    return res
      .status(200)
      .send(`reset progression ok | deleted ${deleted} keys | globals reset`);
  }

  if (type === "cooldowns" || type === "cd") {
    const deleted = await resetCooldowns();

    return res.status(200).send(`reset cooldowns ok | deleted ${deleted} keys`);
  }

  if (type === "quests") {
    const deleted = await resetQuests();

    return res.status(200).send(`reset quests ok | deleted ${deleted} keys`);
  }

  if (
    type === "globalquests" ||
    type === "global-quests" ||
    type === "weekly" ||
    type === "monthly" ||
    type === "yearly"
  ) {
    const deleted = await resetGlobalQuests();

    return res
      .status(200)
      .send(`reset global quests ok | deleted ${deleted} keys`);
  }

  if (type === "currency" || type === "wallet" || type === "coins") {
    const deleted = await resetCurrency();

    return res.status(200).send(`reset currency ok | deleted ${deleted} keys`);
  }

  if (type === "globals") {
    await resetGlobals();

    return res.status(200).send("reset globals ok");
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

  return res.status(400).send(`Unknown reset type. ${helpText()}`);
}
