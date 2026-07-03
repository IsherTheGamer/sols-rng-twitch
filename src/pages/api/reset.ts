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

function getFirst(input: string | string[] | undefined): string | undefined {
  return Array.isArray(input) ? input[0] : input;
}

function clean(input: string | string[] | undefined, fallback = ""): string {
  return (getFirst(input) ?? fallback).trim();
}

function cleanName(input: string | string[] | undefined, fallback = "Player"): string {
  return clean(input, fallback)
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_ -]/g, "")
    .trim() || fallback;
}

function cleanId(input: string | string[] | undefined, fallback: string): string {
  return clean(input, fallback).replace(/[^a-zA-Z0-9_-]/g, "") || fallback;
}

function isSecretValid(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const token = clean(req.query.token, "");

  return Boolean(secret && token === secret);
}

function parseScope(query: string): string {
  const first = query.trim().split(/\s+/).filter(Boolean)[0]?.toLowerCase();
  return first || "all";
}

function normalizeScope(scope: string): string | null {
  if (scope === "all") return "all";
  if (scope === "core" || scope === "cores") return "core";
  if (scope === "profile" || scope === "rolls" || scope === "level" || scope === "xp") return "profile";
  if (scope === "inventory" || scope === "tokens" || scope === "token") return "inventory";

  return null;
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
  const scope = normalizeScope(parseScope(query));

  if (!scope) {
    return text(res, "Reset scopes: all, core, profile/rolls, inventory/tokens.");
  }

  const channelId = cleanId(req.query.channelId, ctx.channelId);
  const userId = cleanId(req.query.userId, ctx.user?.providerId ?? "anon");
  const name = cleanName(req.query.name, ctx.user?.displayName ?? ctx.user?.name ?? "Player");

  const keys: string[] = [];

  if (scope === "all" || scope === "core") {
    keys.push(`core-system:${channelId}:${userId}`);
  }

  if (scope === "all" || scope === "profile") {
    keys.push(`profile:${channelId}:${userId}`);
  }

  if (scope === "all" || scope === "inventory") {
    keys.push(`inventory:${channelId}:${userId}`);
  }

  await Promise.all(keys.map((key) => r.del(key)));

  return text(
    res,
    `✅ Reset ${scope} for ${name}. ChannelId=${channelId} | UserId=${userId} | Deleted: ${keys
      .map((k) => k.split(":")[0])
      .join(", ")}.`
  );
}
