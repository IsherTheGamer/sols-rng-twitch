import type { NextApiRequest, NextApiResponse } from "next";
import { Redis } from "@upstash/redis";
import type { ChannelState } from "@/types/data";
import { setChannelState } from "@/lib/state";
import { createDefaultAchievementState } from "@/lib/achievements";
import { resetViewerProfiles } from "@/lib/profile";

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

function getDefaultChannelId(): string {
  return process.env.DEFAULT_CHANNEL_ID ?? "default";
}

function createDefaultChannelState(): ChannelState {
  const now = Date.now();

  return {
    channelId: getDefaultChannelId(),
    channelName: "default",

    biomeId: "normal",
    biomeExpiresAt: now + 30000,

    timeOfDay: "daytime",
    timeExpiresAt: now + 150000,

    activeEvents: [],
    activeDevBiome: null,
    devExpiresAt: 0,
    bloodRainExpiresAt: 0,

    lastStatusAt: 0,
    lastTickAt: now,

    deviceServerCooldownUntil: 0,
    strangeControllerCooldownUntil: 0,
    biomeRandomizerCooldownUntil: 0,
  };
}

async function resetBiomeData(): Promise<void> {
  const state = createDefaultChannelState();
  await setChannelState(state);
}

async function resetAchievementData(): Promise<void> {
  const r = getRedis();

  if (!r) return;

  await r.set("global:achievement-state", createDefaultAchievementState());
}

async function resetRollData(): Promise<void> {
  const r = getRedis();

  if (!r) return;

  await r.set("global:rolls", 0);
}

async function resetCooldownData(): Promise<void> {
  const r = getRedis();

  if (!r) return;

  const channelId = getDefaultChannelId();

  const keys = [
    `cd:roll:${channelId}`,
    `cd:pop:${channelId}`,
    `cd:device:${channelId}`,
  ];

  await r.del(...keys);
}

async function resetProfileData(): Promise<void> {
  await resetViewerProfiles(getDefaultChannelId());
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyReset(req)) {
    return res.status(401).send("Unauthorized reset.");
  }

  const type = ((req.query.type as string) ?? "full")
    .toLowerCase()
    .trim();

  if (type === "biome" || type === "biomes") {
    await resetBiomeData();
    return res.status(200).send("reset biome ok");
  }

  if (type === "achievement" || type === "achievements") {
    await resetAchievementData();
    return res.status(200).send("reset achievements ok");
  }

  if (type === "roll" || type === "rolls") {
    await resetRollData();
    return res.status(200).send("reset rolls ok");
  }

  if (type === "cooldown" || type === "cooldowns") {
    await resetCooldownData();
    return res.status(200).send("reset cooldowns ok");
  }

  if (type === "profile" || type === "profiles") {
    await resetProfileData();
    return res.status(200).send("reset profiles ok");
  }

  if (type === "full" || type === "all") {
    await resetBiomeData();
    await resetAchievementData();
    await resetRollData();
    await resetCooldownData();
    await resetProfileData();

    return res.status(200).send("reset full ok");
  }

  return res
    .status(400)
    .send(
      "Unknown reset type. Use: full, biome, achievements, rolls, cooldowns, profiles"
    );
}
