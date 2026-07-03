import { Redis } from "@upstash/redis";
import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

function getUserId(user: { providerId?: string } | null): string {
  return user?.providerId ?? "anon";
}

function getDisplayName(user: { displayName?: string; name?: string } | null): string {
  return user?.displayName ?? user?.name ?? "Player";
}

function cleanId(input: string | string[] | undefined, fallback: string): string {
  const raw = Array.isArray(input) ? input[0] : input;
  return (raw ?? fallback).trim();
}

function isSecretValid(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const token = typeof req.query.token === "string" ? req.query.token : "";

  return Boolean(secret && token === secret);
}

function parseScope(query: string): string {
  const first = query.trim().split(/\s+/).filter(Boolean)[0]?.toLowerCase();
  return first || "all";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSecretValid(req)) {
    return text(res, "Reset locked. Use ?token=CRON_SECRET.");
  }

  const ctx = getChannelContext(req);
  const r = getRedis();

  if (!r) {
    return text(res, "Reset failed: Redis is not connected.");
  }

  const query = parseQuery(req);
  const scope = parseScope(query);

  const channelId = cleanId(req.query.channelId, ctx.channelId);
  const userId = cleanId(req.query.userId, getUserId(ctx.user));
  const name = cleanId(req.query.name, getDisplayName(ctx.user));

  const keys: string[] = [];

  if (scope === "all" || scope === "core") {
    keys.push(`core-system:${channelId}:${userId}`);
  }

  if (scope === "all" || scope === "profile" || scope === "rolls") {
    keys.push(`profile:${channelId}:${userId}`);
  }

  if (scope === "all" || scope === "inventory" || scope === "tokens") {
    keys.push(`inventory:${channelId}:${userId}`);
  }

  if (keys.length === 0) {
    return text(res, "Reset scopes: all, core, profile/rolls, inventory/tokens.");
  }

  await Promise.all(keys.map((key) => r.del(key)));

  return text(
    res,
    `✅ Reset ${scope} for ${name}. Channel: ${channelId} | User: ${userId} | Deleted: ${keys
      .map((k) => k.split(":")[0])
      .join(", ")}.`
  );
}
