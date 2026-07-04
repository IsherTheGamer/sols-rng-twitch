const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`✅ wrote ${file}`);
}

function replaceOrWarn(file, source, from, to, label) {
  if (!source.includes(from)) {
    console.log(`⚠️ ${label} already patched or pattern not found in ${file}`);
    return source;
  }
  console.log(`✅ patched ${label}`);
  return source.replace(from, to);
}

function replaceFunctionBlock(source, startNeedle, endNeedle, replacement, label) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  if (start === -1 || end === -1) {
    console.log(`⚠️ ${label} block not found, skipping.`);
    return source;
  }
  console.log(`✅ replaced ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const resetTs = String.raw`import { Redis } from "@upstash/redis";
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

function isOldGlobalKey(key: string): boolean {
  return (
    key === "global:rolls" ||
    key === "global:achievement-state" ||
    key.startsWith("social:recent:") ||
    key.startsWith("social:boosts:") ||
    key.startsWith("social:chat:") ||
    key.startsWith("social:merchant:") ||
    key.startsWith("social:npc:") ||
    key.startsWith("social:flex:")
  );
}

function isMegaGlobalKey(key: string): boolean {
  return (
    key.startsWith("mega:stats:") ||
    key.startsWith("mega:gstats:") ||
    key.startsWith("mega:replay:") ||
    key.startsWith("mega:records:") ||
    key.startsWith("mega:firsts:") ||
    key.startsWith("mega:event:") ||
    key.startsWith("mega:blackmarket:") ||
    key.startsWith("mega:discord:") ||
    key.startsWith("mega:lastbiome:")
  );
}

function isMegaPlayerKey(key: string): boolean {
  return key.startsWith("mega:qclaim:") || key.startsWith("mega:luck:");
}

function isGlobalKey(key: string): boolean {
  return isOldGlobalKey(key) || isMegaGlobalKey(key);
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
      isGlobalKey(key) ||
      isMegaPlayerKey(key)
    );
  }

  if (scope === "core") {
    return key.startsWith("core-system:");
  }

  if (scope === "profile") {
    return (
      key.startsWith("profile:") ||
      key.startsWith("profiles:") ||
      key.startsWith("viewer-profile:") ||
      key.startsWith("roll-profile:") ||
      key.startsWith("rolls:") ||
      isMegaPlayerKey(key)
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

function addOldGlobalServerKeys(keys: Set<string>, channelId: string): void {
  keys.add("global:rolls");
  keys.add("global:achievement-state");

  keys.add(`social:recent:${channelId}`);
  keys.add(`social:boosts:${channelId}`);
  keys.add(`social:chat:${channelId}`);
  keys.add(`social:merchant:${channelId}`);
  keys.add(`social:npc:${channelId}`);
  keys.add(`social:flex:${channelId}`);
}

async function addAllOldChannelSocialKeys(
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
}

async function addMegaServerKeys(
  r: Redis,
  keys: Set<string>,
  channelId: string,
  scope: ResetScope,
  allChannels: boolean
): Promise<void> {
  const channelPatterns = [
    `mega:stats:${channelId}:*`,
    `mega:replay:${channelId}`,
    `mega:records:${channelId}`,
    `mega:firsts:${channelId}`,
    `mega:event:${channelId}`,
    `mega:blackmarket:${channelId}`,
    `mega:discord:${channelId}`,
    `mega:lastbiome:${channelId}`,
  ];

  const globalPatterns = ["mega:gstats:*"];

  for (const pattern of [...channelPatterns, ...globalPatterns]) {
    await addKeysByPattern(r, keys, pattern, scope);
  }

  if (allChannels) {
    for (const pattern of [
      "mega:stats:*",
      "mega:replay:*",
      "mega:records:*",
      "mega:firsts:*",
      "mega:event:*",
      "mega:blackmarket:*",
      "mega:discord:*",
      "mega:lastbiome:*",
      "mega:gstats:*",
    ]) {
      await addKeysByPattern(r, keys, pattern, scope);
    }
  }
}

async function addMegaPlayerKeys(
  r: Redis,
  keys: Set<string>,
  channelId: string,
  userId: string,
  scope: ResetScope,
  allChannels: boolean
): Promise<void> {
  keys.add(`mega:luck:${channelId}:${userId}`);
  await addKeysByPattern(r, keys, `mega:qclaim:${channelId}:${userId}:*`, scope);
  await addKeysByPattern(r, keys, `mega:luck:${channelId}:${userId}`, scope);

  if (allChannels) {
    await addKeysByPattern(r, keys, `mega:qclaim:*:${userId}:*`, scope);
    await addKeysByPattern(r, keys, `mega:luck:*:${userId}`, scope);
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
    await addMegaPlayerKeys(r, keys, channelId, userId, scope, globalUser);
  }

  if (scope === "all" || scope === "inventory") {
    keys.add(`inventory:${channelId}:${userId}`);

    if (username) {
      keys.add(`inventory-grants:${channelId}:${username}`);
    }
  }

  if (includeServerData) {
    addOldGlobalServerKeys(keys, channelId);
    await addMegaServerKeys(r, keys, channelId, scope, globalUser);

    if (globalUser) {
      await addAllOldChannelSocialKeys(r, keys, scope);
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
      `No matching reset keys found. Scope=${scope} | ChannelId=${channelId} | UserId=${userId}.`
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
`;

const discordAdminTs = String.raw`import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";
import { setDiscordWebhookFromAdmin } from "@/lib/mega-feature-system";

function normalizeChannel(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawChannel =
    typeof req.query.channel === "string"
      ? req.query.channel
      : process.env.DEFAULT_CHANNEL_NAME ?? process.env.DEFAULT_CHANNEL_ID ?? "default";

  const channelId = normalizeChannel(rawChannel) || "default";

  return text(res, await setDiscordWebhookFromAdmin(req, channelId));
}
`;

const discordTestTs = String.raw`import type { NextApiRequest, NextApiResponse } from "next";
import { text, verifyCron } from "@/lib/api-helpers";
import { formatDcAlerts } from "@/lib/mega-feature-system";

function normalizeChannel(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyCron(req)) {
    return res.status(401).send("Unauthorized");
  }

  const rawChannel =
    typeof req.query.channel === "string"
      ? req.query.channel
      : process.env.DEFAULT_CHANNEL_NAME ?? process.env.DEFAULT_CHANNEL_ID ?? "default";

  const channelName = normalizeChannel(rawChannel) || "default";

  return text(res, await formatDcAlerts(channelName, channelName, "test", true));
}
`;

write('src/pages/api/reset.ts', resetTs);
write('src/pages/api/discord-admin.ts', discordAdminTs);
write('src/pages/api/discord-test.ts', discordTestTs);

// Patch mega-feature-system.ts
const megaPath = 'src/lib/mega-feature-system.ts';
if (!fs.existsSync(megaPath)) {
  throw new Error('src/lib/mega-feature-system.ts not found. Run the expanded feature pack first.');
}
let mega = read(megaPath);

mega = mega.replace(
  /users: Record<string, \{ id: string; name: string; rolls: number; rarePulls: number; bestAura\?: \{ name: string; rarity: number \} \}>;/,
  'users: Record<string, { id: string; name: string; rolls: number; rarePulls: number; ultraPulls: number; bestAura?: { name: string; rarity: number } }>;'
);

mega = mega.replace(
  'const user = stats.users[userId] ?? { id: userId, name: userName, rolls: 0, rarePulls: 0 };\n  user.name = userName;',
  'const user = stats.users[userId] ?? { id: userId, name: userName, rolls: 0, rarePulls: 0, ultraPulls: 0 };\n  if (user.ultraPulls == null) user.ultraPulls = 0;\n  user.name = userName;'
);

mega = mega.replace(
  'if (ultra) stats.ultraPulls++;',
  'if (ultra) { stats.ultraPulls++; user.ultraPulls++; }'
);

mega = mega.replace(
  'if (metric === "ultra") return (user.bestAura?.rarity ?? 0) >= 100000000 ? 1 : 0;',
  'if (metric === "ultra") return user.ultraPulls ?? ((user.bestAura?.rarity ?? 0) >= 100000000 ? 1 : 0);'
);

const claimQuestReplacement = String.raw`async function claimQuest(channelId: string, user: NightbotUser | null, scope: "player" | "global", period: QuestPeriod, key: string, stats: PeriodStats, list: Array<{ id: string; name: string; metric: QuestMetric; target: number; reward: string }>): Promise<string> {
  if (!user) return "Claim only works from Twitch chat.";
  const r = getRedis();
  if (!r) return "Quest database is not connected.";
  const userId = getUserId(user);
  const done = list.filter((q) => metricValue(stats, q.metric, scope === "player" ? userId : undefined) >= q.target);
  if (done.length === 0) return "No completed quests to claim yet.";
  const claimedKey = kQuestClaim(channelId, userId, scope, period, key);
  const claimed = new Set((await r.get<string[]>(claimedKey)) ?? []);
  const fresh = done.filter((q) => !claimed.has(q.id));
  if (fresh.length === 0) return `Already claimed completed ${scope} ${period} quests.`;

  for (const q of fresh) claimed.add(q.id);

  if (scope === "player") {
    const core = await getCoreState(channelId, user);
    const rewardEach = period === "daily" ? 100 : period === "weekly" ? 1000 : period === "monthly" ? 5000 : 25000;
    const stardustReward = rewardEach * fresh.length;
    core.stardust += stardustReward;
    await saveCoreState(core);
    await r.set(claimedKey, [...claimed]);
    return `✅ Claimed ${fresh.length} player ${period} quest reward(s): +${fmt(stardustReward)} Stardust.`;
  }

  const hasUltra = fresh.some((q) => q.metric === "ultra");
  const percent = hasUltra ? 25 : 10;
  const minutes = hasUltra ? 10 : 5;
  const event: ChannelEvent = {
    id: `global_quest:${period}:${Date.now()}`,
    name: `${titleCase(period)} Global Quest`,
    kind: "luckstorm",
    percent,
    createdAt: Date.now(),
    expiresAt: Date.now() + minutes * 60 * 1000,
    createdBy: getDisplayName(user),
  };

  await r.set(kEvent(channelId), event);
  await r.set(claimedKey, [...claimed]);

  return `✅ Claimed ${fresh.length} global ${period} quest reward(s): Global Luck +${percent}% for ${minutes}m.`;
}

`;

mega = replaceFunctionBlock(
  mega,
  'async function claimQuest(',
  'export async function formatReplay(',
  claimQuestReplacement,
  'claimQuest global/player reward logic'
);

// Clean up AOTD/BOTD wording so it does not promise inactive boosts.
mega = mega.replace(
  'return `🌟 Aura of the Day: ${aura} | Event flavor bonus today. Full chance boost can be added later in roll-engine.`;',
  'return `🌟 Aura of the Day: ${aura} | Used for daily flavor, quests, and event callouts.`;'
);
mega = mega.replace(
  'return `🌍 Biome of the Day: ${titleCase(biome)} | Watch for boosted event/quest bonuses today.`;',
  'return `🌍 Biome of the Day: ${titleCase(biome)} | Used for daily flavor, quests, and event callouts.`;'
);

write(megaPath, mega);

// Patch roll.ts to pass estimatedLuck into recordMegaRolls.
const rollPath = 'src/pages/api/roll.ts';
if (!fs.existsSync(rollPath)) {
  throw new Error('src/pages/api/roll.ts not found.');
}
let roll = read(rollPath);

if (!roll.includes('let bestLuckThisRoll = 0;')) {
  roll = replaceOrWarn(
    rollPath,
    roll,
    '    const results: RollHitResult[] = [];\n',
    '    const results: RollHitResult[] = [];\n    let bestLuckThisRoll = 0;\n',
    'roll best luck tracker variable'
  );
}

if (!roll.includes('bestLuckThisRoll = Math.max(bestLuckThisRoll, luck);')) {
  roll = replaceOrWarn(
    rollPath,
    roll,
    '        rareBiomeActive,\n      });\n\n      const result = rollOnce({',
    '        rareBiomeActive,\n      });\n\n      bestLuckThisRoll = Math.max(bestLuckThisRoll, luck);\n\n      const result = rollOnce({',
    'roll best luck tracker update'
  );
}

if (!roll.includes('estimatedLuck: bestLuckThisRoll')) {
  roll = replaceOrWarn(
    rollPath,
    roll,
    '      source: oneTimeTokenAssisted ? "token" : "roll",\n    });',
    '      source: oneTimeTokenAssisted ? "token" : "roll",\n      estimatedLuck: bestLuckThisRoll,\n    });',
    'recordMegaRolls estimatedLuck field'
  );
}

write(rollPath, roll);

console.log('\n✅ Mega full fix pack applied. Now run npm run build.');
