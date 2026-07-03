import { Redis } from "@upstash/redis";
import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";
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

function cleanId(input: string | string[] | undefined, fallback: string): string {
  return clean(input, fallback).replace(/[^a-zA-Z0-9_-]/g, "") || fallback;
}

function cleanName(input: string | string[] | undefined, fallback = "Player"): string {
  return (
    clean(input, fallback)
      .replace(/^@+/, "")
      .replace(/[^a-zA-Z0-9_ -]/g, "")
      .trim() || fallback
  );
}

function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

function truthy(input: string | string[] | undefined): boolean {
  const value = clean(input, "").toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(value);
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

function normalizeScope(scope: string): "all" | "core" | "profile" | "inventory" | null {
  if (scope === "all" || scope === "everything" || scope === "full") return "all";
  if (scope === "core" || scope === "cores" || scope === "mega") return "core";
  if (
    scope === "profile" ||
    scope === "profiles" ||
    scope === "roll" ||
    scope === "rolls" ||
    scope === "level" ||
    scope === "xp"
  ) {
    return "profile";
  }
  if (
    scope === "inventory" ||
    scope === "inv" ||
    scope === "token" ||
    scope === "tokens" ||
    scope === "buffs"
  ) {
    return "inventory";
  }

  return null;
}

function allowedForScope(key: string, scope: "all" | "core" | "profile" | "inventory"): boolean {
  if (scope === "all") {
    return (
      key.startsWith("core-system:") ||
      key.startsWith("profile:") ||
      key.startsWith("inventory:") ||
      key.startsWith("inventory-grants:") ||
      key.startsWith("viewer-profile:") ||
      key.startsWith("viewer-inventory:") ||
      key.startsWith("roll-profile:") ||
      key.startsWith("rolls:")
    );
  }

  if (scope === "core") {
    return key.startsWith("core-system:");
  }

  if (scope === "profile") {
    return (
      key.startsWith("profile:") ||
      key.startsWith("viewer-profile:") ||
      key.startsWith("roll-profile:") ||
      key.startsWith("rolls:")
    );
  }

  return (
    key.startsWith("inventory:") ||
    key.startsWith("inventory-grants:") ||
    key.startsWith("viewer-inventory:")
  );
}

async function addKeysByPattern(
  r: Redis,
  out: Set<string>,
  pattern: string,
  scope: "all" | "core" | "profile" | "inventory"
): Promise<void> {
  try {
    const found = await r.keys(pattern);

    for (const key of found) {
      if (allowedForScope(key, scope)) {
        out.add(key);
      }
    }
  } catch {
    // Ignore pattern failures so reset still works with exact keys.
  }
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

  const rawScope =
    clean(req.query.query, "") ||
    clean(req.query.scope, "") ||
    clean(req.query.mode, "") ||
    "all";
  const scope = normalizeScope(parseScope(rawScope));

  if (!scope) {
    return text(res, "Reset scopes: all, core, profile/rolls, inventory/tokens.");
  }

  const channelId = cleanId(req.query.channelId, ctx.channelId);
  const userId = cleanId(req.query.userId, ctx.user?.providerId ?? "anon");
  const name = cleanName(req.query.name, ctx.user?.displayName ?? ctx.user?.name ?? "Player");
  const username = normalizeUsername(name);

  const preview = truthy(req.query.preview) || truthy(req.query.dry);
  const globalUser = truthy(req.query.global);

  const keys = new Set<string>();

  if (scope === "all" || scope === "core") {
    keys.add(`core-system:${channelId}:${userId}`);
  }

  if (scope === "all" || scope === "profile") {
    keys.add(`profile:${channelId}:${userId}`);
  }

  if (scope === "all" || scope === "inventory") {
    keys.add(`inventory:${channelId}:${userId}`);

    if (username) {
      keys.add(`inventory-grants:${channelId}:${username}`);
    }
  }

  // Scoped search: safest normal reset.
  await addKeysByPattern(r, keys, `*:${channelId}:${userId}`, scope);
  await addKeysByPattern(r, keys, `*:${channelId}:${userId}:*`, scope);
  await addKeysByPattern(r, keys, `*:${channelId}:*:${userId}`, scope);
  await addKeysByPattern(r, keys, `*:${channelId}:*${userId}*`, scope);
  await addKeysByPattern(r, keys, `*${channelId}*${userId}*`, scope);

  if (username) {
    await addKeysByPattern(r, keys, `*:${channelId}:${username}`, scope);
    await addKeysByPattern(r, keys, `*:${channelId}:${username}:*`, scope);
    await addKeysByPattern(r, keys, `*${channelId}*${username}*`, scope);
  }

  // Global search: use this if the channelId was wrong before.
  if (globalUser) {
    await addKeysByPattern(r, keys, `*:${userId}`, scope);
    await addKeysByPattern(r, keys, `*:${userId}:*`, scope);
    await addKeysByPattern(r, keys, `*${userId}*`, scope);

    if (username) {
      await addKeysByPattern(r, keys, `*:${username}`, scope);
      await addKeysByPattern(r, keys, `*:${username}:*`, scope);
      await addKeysByPattern(r, keys, `*${username}*`, scope);
    }
  }

  const finalKeys = [...keys].filter((key) => allowedForScope(key, scope));

  if (finalKeys.length === 0) {
    return text(
      res,
      `No matching reset keys found for ${name}. ChannelId=${channelId} | UserId=${userId}. Try &global=1.`
    );
  }

  if (preview) {
    return text(
      res,
      `Preview reset ${scope} for ${name}: ${finalKeys.length} key(s): ${finalKeys
        .slice(0, 8)
        .join(", ")}${finalKeys.length > 8 ? "..." : ""}`
    );
  }

  await Promise.all(finalKeys.map((key) => r.del(key)));

  return text(
    res,
    `✅ Reset ${scope} for ${name}. ChannelId=${channelId} | UserId=${userId} | Deleted ${finalKeys.length} key(s): ${finalKeys
      .map((k) => k.split(":")[0])
      .join(", ")}.`
  );
}
