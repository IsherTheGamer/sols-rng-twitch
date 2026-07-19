import type { Redis } from "@upstash/redis";
import { getCoalescedRedis } from "@/lib/redis-coalescer";
import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";

function getRedis(): Redis | null {
  return getCoalescedRedis();
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

type ResetScope = "all" | "core" | "profile" | "inventory" | "global";

function normalizeScope(scope: string): ResetScope | null {
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

  if (
    scope === "global" ||
    scope === "globals" ||
    scope === "server" ||
    scope === "social" ||
    scope === "boost" ||
    scope === "boosts"
  ) {
    return "global";
  }

  return null;
}

function isGlobalKey(key: string): boolean {
  return (
    key === "global:rolls" ||
    key === "global:achievement-state" ||
    key.startsWith("global:") ||
    key.startsWith("social:recent:") ||
    key.startsWith("social:boosts:") ||
    key.startsWith("social:chat:") ||
    key.startsWith("social:merchant:") ||
    key.startsWith("social:npc:") ||
    key.startsWith("social:flex:") ||
    key.startsWith("mega:") ||
    key.startsWith("aok:channel:") ||
    key.startsWith("core-channel-active:")
  );
}

function allowedForScope(key: string, scope: ResetScope): boolean {
  if (scope === "all") {
    return (
      key.startsWith("core-system:") ||
      key.startsWith("profile:") ||
      key.startsWith("profiles:") ||
      key.startsWith("inventory:") ||
      key.startsWith("inventory-grants:") ||
      key.startsWith("viewer-profile:") ||
      key.startsWith("viewer-inventory:") ||
      key.startsWith("roll-profile:") ||
      key.startsWith("rolls:") ||
      key.startsWith("aok:player:") ||
      isGlobalKey(key)
    );
  }

  if (scope === "core") {
    return key.startsWith("core-system:");
  }

  if (scope === "profile") {
    return (
      key.startsWith("profile:") ||
      key.startsWith("profiles:") ||
      key.startsWith("aok:player:") ||
      key.startsWith("viewer-profile:") ||
      key.startsWith("roll-profile:") ||
      key.startsWith("rolls:")
    );
  }

  if (scope === "inventory") {
    return (
      key.startsWith("inventory:") ||
      key.startsWith("inventory-grants:") ||
      key.startsWith("viewer-inventory:")
    );
  }

  return isGlobalKey(key);
}

async function addKeysByPattern(
  r: Redis,
  out: Set<string>,
  pattern: string,
  scope: ResetScope
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

function addGlobalServerKeys(keys: Set<string>, channelId: string): void {
  keys.add("global:rolls");
  keys.add("global:achievement-state");

  keys.add(`social:recent:${channelId}`);
  keys.add(`social:boosts:${channelId}`);
  keys.add(`social:chat:${channelId}`);
  keys.add(`social:merchant:${channelId}`);
  keys.add(`social:npc:${channelId}`);
  keys.add(`social:flex:${channelId}`);

  keys.add(`aok:channel:${channelId}`);
  keys.add(`core-channel-active:${channelId}`);
  keys.add(`mega:lastbiome:${channelId}`);
  keys.add(`mega:discord:${channelId}`);
}

async function addAllChannelSocialKeys(
  r: Redis,
  keys: Set<string>,
  scope: ResetScope
): Promise<void> {
  await addKeysByPattern(r, keys, "social:recent:*", scope);
  await addKeysByPattern(r, keys, "social:boosts:*", scope);
  await addKeysByPattern(r, keys, "social:chat:*", scope);
  await addKeysByPattern(r, keys, "social:merchant:*", scope);
  await addKeysByPattern(r, keys, "social:npc:*", scope);
  await addKeysByPattern(r, keys, "social:flex:*", scope);

  await addKeysByPattern(r, keys, "aok:channel:*", scope);
  await addKeysByPattern(r, keys, "core-channel-active:*", scope);
  await addKeysByPattern(r, keys, "mega:*", scope);
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
    return text(res, "Reset scopes: all, core, profile/rolls, inventory/tokens, global/server.");
  }

  const channelId = cleanId(req.query.channelId, ctx.channelId);
  const userId = cleanId(req.query.userId, ctx.user?.providerId ?? "anon");
  const name = cleanName(req.query.name, ctx.user?.displayName ?? ctx.user?.name ?? "Player");
  const username = normalizeUsername(name);

  const preview = truthy(req.query.preview) || truthy(req.query.dry);

  // global=1 keeps its old meaning: search this user across any channel.
  const globalUser = truthy(req.query.global);

  // server=1/globalData=1 means include global server-side state with an all reset.
  const includeServerData =
    scope === "global" ||
    truthy(req.query.server) ||
    truthy(req.query.globalData) ||
    truthy(req.query.serverData);

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

  if (includeServerData) {
    addGlobalServerKeys(keys, channelId);

    // For query=global&global=1, wipe social/server keys for all channels too.
    if (globalUser) {
      await addAllChannelSocialKeys(r, keys, scope);
    }
  }

  if (scope !== "global") {
    // Scoped search: safest normal player reset.
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

    // Global user search: use this if the channelId was wrong before.
    if (globalUser) {
      await addKeysByPattern(r, keys, `*:${userId}`, scope);
      await addKeysByPattern(r, keys, `*:${userId}:*`, scope);
      await addKeysByPattern(r, keys, `*${userId}*`, scope);
      await addKeysByPattern(r, keys, `aok:player:*:${userId}`, scope);

      if (username) {
        await addKeysByPattern(r, keys, `*:${username}`, scope);
        await addKeysByPattern(r, keys, `*:${username}:*`, scope);
        await addKeysByPattern(r, keys, `*${username}*`, scope);
      }
    }
  }

  const finalKeys = [...keys].filter((key) => allowedForScope(key, scope));

  if (finalKeys.length === 0) {
    return text(
      res,
      `No matching reset keys found. Scope=${scope} | ChannelId=${channelId} | UserId=${userId} | Tip: old URL format with global=1 searches all channels for this user.`
    );
  }

  if (preview) {
    return text(
      res,
      `Preview reset ${scope}: ${finalKeys.length} key(s): ${finalKeys
        .slice(0, 8)
        .join(", ")}${finalKeys.length > 8 ? "..." : ""}`
    );
  }

  await Promise.all(finalKeys.map((key) => r.del(key)));

  return text(
    res,
    `✅ Reset ${scope}. ChannelId=${channelId} | UserId=${userId} | Deleted ${finalKeys.length} key(s): ${finalKeys
      .map((k) => k.split(":").slice(0, 2).join(":"))
      .join(", ")}.`
  );
}
