import { Redis } from "@upstash/redis";
import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { isBroadcasterUser } from "@/lib/profile";

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

function isSecretValid(req: NextApiRequest): boolean {
  const secret = process.env.CORE_DEBUG_SECRET ?? process.env.CRON_SECRET;
  const token = typeof req.query.token === "string" ? req.query.token : "";

  return Boolean(secret && token === secret);
}

function parseScope(query: string): string {
  const first = query.trim().split(/\s+/).filter(Boolean)[0]?.toLowerCase();
  return first || "all";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channel, channelId, user } = getChannelContext(req);
  const broadcaster = isBroadcasterUser(user, channel);
  const secretOk = isSecretValid(req);

  if (!broadcaster && !secretOk) {
    return text(res, "Reset locked. Use broadcaster account or ?token=CORE_DEBUG_SECRET.");
  }

  const r = getRedis();

  if (!r) {
    return text(res, "Reset failed: Redis is not connected.");
  }

  const scope = parseScope(parseQuery(req));
  const userId = getUserId(user);
  const name = getDisplayName(user);

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
    `✅ Reset ${scope} for ${name}. Deleted: ${keys.map((k) => k.split(":")[0]).join(", ")}.`
  );
}
