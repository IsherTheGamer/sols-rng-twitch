import { Redis } from "@upstash/redis";
import type { NextApiRequest, NextApiResponse } from "next";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

const PROFILE_OPTIONS = [
  "profile_rolls",
  "profile_token_rolls",
  "profile_rarity_total",
  "profile_xp",
  "profile_level",
  "profile_weekly_xp",
  "profile_level_rewards",
  "profile_dev_xp_auras",
  "profile_owned_tiers",
  "profile_highest_tier",
  "profile_best_aura",
  "profile_best_token",
  "profile_index",
] as const;

const INVENTORY_OPTIONS = [
  "inventory_tokens",
  "inventory_active_buffs",
  "inventory_pending_grants",
] as const;

const CORE_OPTIONS = [
  "core_tier",
  "core_path_focus",
  "core_shd_level",
  "core_stardust",
  "core_wall_seed",
  "core_materials",
  "core_components",
  "core_frames",
  "core_subcores",
  "core_reactor",
  "core_tokens",
  "core_lootboxes",
  "core_quest_progress",
  "core_quest_claims",
  "core_achievements",
  "core_unlocks",
  "core_stats",
  "core_jobs",
] as const;

const KNOWLEDGE_OPTIONS = [
  "knowledge_currency",
  "knowledge_merchant_marks",
  "knowledge_relic_shards",
  "knowledge_blueprint_fragments",
  "knowledge_scanner",
  "knowledge_research",
  "knowledge_blueprints",
  "knowledge_relics",
  "knowledge_stats",
  "knowledge_boss_participation",
] as const;

const SHARED_OPTIONS = [
  "social_titles",
  "social_recent_pulls",
  "social_flex",
  "quest_period_claims",
  "quest_npc_claims",
  "mega_luck_history",
  "leaderboard_channel_periods",
  "leaderboard_global_periods",
  "records_replay",
  "records_slots",
  "records_first_aura_discoveries",
  "player_cooldowns",
  "roll_access",
  "other_exact_player_keys",
] as const;

const ALL_OPTIONS = [
  ...PROFILE_OPTIONS,
  ...INVENTORY_OPTIONS,
  ...CORE_OPTIONS,
  ...KNOWLEDGE_OPTIONS,
  ...SHARED_OPTIONS,
] as const;

type ResetOption = (typeof ALL_OPTIONS)[number];

interface ResetRequestBody {
  channelId?: string;
  username?: string;
  userId?: string;
  options?: string[];
  preview?: boolean;
  confirmation?: string;
  token?: string;
}

interface TargetPlayer {
  channelId: string;
  username: string;
  userId: string;
  displayName: string;
  profileKey: string;
}

interface ResetPlanItem {
  option: ResetOption;
  kind: "field" | "key" | "shared";
  key: string;
  matches: number;
  description: string;
}

interface ResetPlan {
  target: TargetPlayer;
  options: ResetOption[];
  fullPlayerReset: boolean;
  items: ResetPlanItem[];
  notes: string[];
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isAuthorized(req: NextApiRequest, body: ResetRequestBody): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = firstHeader(req.headers.authorization);
  if (authorization === `Bearer ${secret}`) return true;

  const queryToken = queryValue(req.query.token);
  if (queryToken === secret) return true;

  return body.token === secret;
}

function cleanId(value: unknown, fallback = ""): string {
  return String(value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

function normalizeUsername(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function cleanDisplayName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_ -]/g, "")
    .slice(0, 50);
}

function selectedOptions(raw: unknown): ResetOption[] {
  const requested = new Set(
    Array.isArray(raw)
      ? raw.map((value) => String(value).toLowerCase())
      : []
  );

  return ALL_OPTIONS.filter((option) => requested.has(option));
}

function hasAll(
  selected: Set<ResetOption>,
  options: readonly ResetOption[]
): boolean {
  return options.every((option) => selected.has(option));
}

async function keysByPattern(r: Redis, pattern: string): Promise<string[]> {
  try {
    return await r.keys(pattern);
  } catch {
    return [];
  }
}

async function mgetValues(
  r: Redis,
  keys: string[]
): Promise<Array<any | null>> {
  if (keys.length === 0) return [];
  return (await r.mget(...keys)) as Array<any | null>;
}

async function resolveTarget(
  r: Redis,
  channelId: string,
  rawUserId: string,
  rawUsername: string
): Promise<TargetPlayer | null> {
  const requestedId = cleanId(rawUserId);
  const username = normalizeUsername(rawUsername);

  if (requestedId) {
    const profileKey = `profile:${channelId}:${requestedId}`;
    const profile = await r.get<Record<string, unknown>>(profileKey);

    return {
      channelId,
      userId: requestedId,
      username:
        username ||
        normalizeUsername(profile?.displayName) ||
        requestedId,
      displayName:
        cleanDisplayName(profile?.displayName) ||
        cleanDisplayName(rawUsername) ||
        requestedId,
      profileKey,
    };
  }

  if (!username) return null;

  const indexKey = `profiles:${channelId}:keys`;
  const indexedKeys = (await r.get<string[]>(indexKey)) ?? [];
  const values = await mgetValues(r, indexedKeys.slice(0, 5000));

  for (let index = 0; index < values.length; index++) {
    const profile = values[index] as Record<string, unknown> | null;
    const key = indexedKeys[index] ?? "";
    const keyUserId = cleanId(key.split(":").pop());
    const displayName = normalizeUsername(profile?.displayName);

    if (displayName !== username && keyUserId !== username) continue;

    const userId = cleanId(profile?.userId) || keyUserId;
    if (!userId) continue;

    return {
      channelId,
      userId,
      username,
      displayName:
        cleanDisplayName(profile?.displayName) ||
        cleanDisplayName(rawUsername) ||
        username,
      profileKey: `profile:${channelId}:${userId}`,
    };
  }

  return null;
}

function targetMatches(
  value: Record<string, any> | null | undefined,
  target: TargetPlayer
): boolean {
  if (!value) return false;

  const userId = cleanId(value.userId);
  const username = normalizeUsername(
    value.userName ??
      value.username ??
      value.displayName ??
      value.name
  );

  return (
    userId === target.userId ||
    (Boolean(target.username) && username === target.username)
  );
}

function arrayMatchCount(
  list: Array<Record<string, any>> | null | undefined,
  target: TargetPlayer
): number {
  return (list ?? []).filter((entry) => targetMatches(entry, target)).length;
}

function removeTargetFromArray(
  list: Array<Record<string, any>>,
  target: TargetPlayer
): Array<Record<string, any>> {
  return list.filter((entry) => !targetMatches(entry, target));
}

function resetProfileFields(
  profile: Record<string, any>,
  selected: Set<ResetOption>
): void {
  if (selected.has("profile_rolls")) profile.rolls = 0;

  if (selected.has("profile_token_rolls")) {
    profile.tokenRolls = 0;
    profile.potionRolls = 0;
  }

  if (selected.has("profile_rarity_total")) profile.rarityTotal = 0;
  if (selected.has("profile_xp")) profile.xp = 0;
  if (selected.has("profile_level")) profile.level = 1;

  if (selected.has("profile_weekly_xp")) {
    profile.weeklyXp = { weekId: "", tierCounts: {} };
  }

  if (selected.has("profile_level_rewards")) {
    profile.claimedLevelRewards = {};
  }

  if (selected.has("profile_dev_xp_auras")) {
    profile.devExclusiveXpAuras = [];
  }

  if (selected.has("profile_owned_tiers")) profile.ownedTiers = {};

  if (selected.has("profile_highest_tier")) {
    profile.highestTierId = null;
    profile.highestTierRank = 0;
  }

  if (selected.has("profile_best_aura")) profile.bestAura = null;

  if (selected.has("profile_best_token")) {
    profile.bestTokenAura = null;
    profile.bestPotionAura = null;
  }

  profile.updatedAt = Date.now();
}

function resetInventoryFields(
  inventory: Record<string, any>,
  selected: Set<ResetOption>
): void {
  if (selected.has("inventory_tokens")) inventory.tokens = {};
  if (selected.has("inventory_active_buffs")) inventory.activeBuffs = [];
  inventory.updatedAt = Date.now();
}

function resetCoreFields(
  core: Record<string, any>,
  selected: Set<ResetOption>,
  target: TargetPlayer
): void {
  if (selected.has("core_tier")) core.coreTier = 0;

  if (selected.has("core_path_focus")) {
    core.corePath = "universal";
    core.coreFocus = "main";
  }

  if (selected.has("core_shd_level")) core.shdLevel = -1;
  if (selected.has("core_stardust")) core.stardust = 0;

  if (selected.has("core_wall_seed")) {
    core.wallSeed = `${target.channelId}:${target.userId}:${Date.now()}:${Math.random()}`;
  }

  if (selected.has("core_materials")) core.materials = {};
  if (selected.has("core_components")) core.components = {};
  if (selected.has("core_frames")) core.frames = {};

  if (selected.has("core_subcores")) {
    core.subCores = {};
    core.activeSubCoreId = null;
  }

  if (selected.has("core_reactor")) {
    core.reactor = { level: 0, activeDeposit: null };
  }

  if (selected.has("core_tokens")) core.tokens = {};
  if (selected.has("core_lootboxes")) core.lootboxes = {};
  if (selected.has("core_quest_progress")) core.questProgress = {};
  if (selected.has("core_quest_claims")) core.questClaimed = {};
  if (selected.has("core_achievements")) core.achievementsClaimed = {};
  if (selected.has("core_unlocks")) core.unlocks = {};

  if (selected.has("core_stats")) {
    core.stats = {
      totalRollsTracked: 0,
      totalCrafts: 0,
      totalComponentsCrafted: 0,
      coresCrafted: 0,
      shdCrafted: 0,
      reactorClaims: 0,
      questsCompleted: 0,
      boxesOpened: 0,
      pathSwitches: 0,
      highestRarity: 0,
      rareRolls100k: 0,
      rareRolls1m: 0,
      rareRolls10m: 0,
      materialsCollected: 0,
      stardustCollected: 0,
    };
  }

  if (selected.has("core_jobs")) core.activeJobs = {};

  core.updatedAt = Date.now();
  core.lastActiveAt = Date.now();
}

function resetKnowledgeFields(
  player: Record<string, any>,
  selected: Set<ResetOption>
): void {
  if (selected.has("knowledge_currency")) player.knowledge = 0;
  if (selected.has("knowledge_merchant_marks")) player.merchantMarks = 0;
  if (selected.has("knowledge_relic_shards")) player.relicShards = 0;
  if (selected.has("knowledge_blueprint_fragments")) {
    player.blueprintFragments = 0;
  }

  if (selected.has("knowledge_scanner")) player.scannerLevel = 0;
  if (selected.has("knowledge_research")) player.unlockedResearch = {};
  if (selected.has("knowledge_blueprints")) player.blueprints = {};
  if (selected.has("knowledge_relics")) player.relics = [];

  if (selected.has("knowledge_stats")) {
    player.stats = {
      bossDamage: 0,
      bossKills: 0,
      knowledgeEarned: 0,
      worldEventsSeen: 0,
      relicRerolls: 0,
    };
  }

  player.updatedAt = Date.now();
}

function optionDescription(option: ResetOption): string {
  const descriptions: Record<ResetOption, string> = {
    profile_rolls: "Reset normal !roll count.",
    profile_token_rolls: "Reset token/potion roll count.",
    profile_rarity_total: "Reset accumulated rarity value.",
    profile_xp: "Reset XP to 0.",
    profile_level: "Reset displayed level to 1.",
    profile_weekly_xp: "Reset weekly tier-XP counters.",
    profile_level_rewards: "Forget claimed level rewards.",
    profile_dev_xp_auras: "Reset DEV-exclusive XP aura tracking.",
    profile_owned_tiers: "Reset owned tier counters.",
    profile_highest_tier: "Reset highest tier/rank.",
    profile_best_aura: "Reset best normal aura.",
    profile_best_token: "Reset best token/potion aura.",
    profile_index: "Remove player from profile lookup/standard leaderboard index.",
    inventory_tokens: "Delete stored roll/potion tokens.",
    inventory_active_buffs: "Delete active and queued token effects.",
    inventory_pending_grants: "Delete username-based pending token grants.",
    core_tier: "Reset Core tier.",
    core_path_focus: "Reset Core path and main/sub focus.",
    core_shd_level: "Reset SHD level.",
    core_stardust: "Reset stored Stardust.",
    core_wall_seed: "Regenerate the Core wall seed.",
    core_materials: "Delete Core-system materials.",
    core_components: "Delete crafted components.",
    core_frames: "Delete frames/chassis storage.",
    core_subcores: "Delete Sub-Cores and active Sub-Core.",
    core_reactor: "Reset Stardust Reactor and active deposit.",
    core_tokens: "Delete Core-system crafting tokens.",
    core_lootboxes: "Delete unopened boxes.",
    core_quest_progress: "Reset Core quest progress.",
    core_quest_claims: "Reset Core quest claim history.",
    core_achievements: "Reset Core achievement claim history.",
    core_unlocks: "Reset Core feature unlock flags.",
    core_stats: "Reset Core/crafting/box/reactor statistics.",
    core_jobs: "Delete active crafting/Core jobs.",
    knowledge_currency: "Reset Knowledge.",
    knowledge_merchant_marks: "Reset Merchant Marks.",
    knowledge_relic_shards: "Reset Relic Shards.",
    knowledge_blueprint_fragments: "Reset Blueprint Fragments.",
    knowledge_scanner: "Reset Scanner level.",
    knowledge_research: "Reset unlocked research.",
    knowledge_blueprints: "Reset owned blueprints.",
    knowledge_relics: "Delete owned/equipped relics.",
    knowledge_stats: "Reset boss/Knowledge/relic statistics.",
    knowledge_boss_participation: "Remove player from the active boss participant list.",
    social_titles: "Delete owned and equipped titles.",
    social_recent_pulls: "Remove player from !recent pull history.",
    social_flex: "Cancel the active flex challenge if player is involved.",
    quest_period_claims: "Delete personal/global period quest claim keys.",
    quest_npc_claims: "Remove NPC quest claimed-by markers.",
    mega_luck_history: "Delete stored best-luck history.",
    leaderboard_channel_periods: "Remove player rows from channel period leaderboards.",
    leaderboard_global_periods: "Remove player rows from cross-channel period leaderboards.",
    records_replay: "Remove player from rare-pull replay history.",
    records_slots: "Clear channel record slots owned by player.",
    records_first_aura_discoveries: "Remove player-owned aura discoveries shown by !first/!firsts.",
    player_cooldowns: "Delete player-specific command cooldowns.",
    roll_access: "Remove player from dynamic 10k-roll access.",
    other_exact_player_keys: "Delete additional exact keys containing channel ID and numeric user ID.",
  };

  return descriptions[option];
}

async function buildPlan(
  r: Redis,
  body: ResetRequestBody
): Promise<ResetPlan> {
  const channelId = cleanId(body.channelId, "904797805");
  if (!channelId) throw new Error("Enter a valid Twitch channel ID.");

  const options = selectedOptions(body.options);
  if (options.length === 0) {
    throw new Error("Select at least one reset item.");
  }

  const target = await resolveTarget(
    r,
    channelId,
    cleanId(body.userId),
    normalizeUsername(body.username)
  );

  if (!target) {
    throw new Error(
      "Player not found. Use their numeric Twitch user ID for perfect accuracy."
    );
  }

  const selected = new Set(options);
  const fullPlayerReset = ALL_OPTIONS.every((option) =>
    selected.has(option)
  );

  const keys = {
    profile: target.profileKey,
    inventory: `inventory:${channelId}:${target.userId}`,
    core: `core-system:${channelId}:${target.userId}`,
    knowledge: `aok:player:${channelId}:${target.userId}`,
    titles: `social:titles:${channelId}:${target.userId}`,
    recent: `social:recent:${channelId}`,
    flex: `social:flex:${channelId}`,
    npc: `social:npc:${channelId}`,
    replay: `mega:replay:${channelId}`,
    records: `mega:records:${channelId}`,
    firsts: `mega:firsts:${channelId}`,
    aokChannel: `aok:channel:${channelId}`,
    access: `roll-access:${channelId}`,
    profileIndex: `profiles:${channelId}:keys`,
    luck: `mega:luck:${channelId}:${target.userId}`,
  };

  const sharedKeys = [
    keys.profile,
    keys.inventory,
    keys.core,
    keys.knowledge,
    keys.titles,
    keys.recent,
    keys.flex,
    keys.npc,
    keys.replay,
    keys.records,
    keys.firsts,
    keys.aokChannel,
    keys.access,
    keys.profileIndex,
    keys.luck,
  ];

  const values = await mgetValues(r, sharedKeys);
  const valueByKey = new Map<string, any>(
    sharedKeys.map((key, index) => [key, values[index]])
  );

  const items: ResetPlanItem[] = options.map((option) => {
    let key = "player object";
    let kind: ResetPlanItem["kind"] = "field";
    let matches = 1;

    if (option.startsWith("inventory_")) key = keys.inventory;
    else if (option.startsWith("core_")) key = keys.core;
    else if (option.startsWith("knowledge_")) key = keys.knowledge;
    else if (option.startsWith("profile_")) key = keys.profile;

    if (option === "profile_index") {
      key = keys.profileIndex;
      kind = "shared";
      matches = ((valueByKey.get(key) as string[] | null) ?? []).filter(
        (entry) => entry === target.profileKey
      ).length;
    }

    if (option === "inventory_pending_grants") {
      key = `inventory-grants:${channelId}:${target.username}`;
      kind = "key";
    }

    if (option === "social_titles") {
      key = keys.titles;
      kind = "key";
    }

    if (option === "social_recent_pulls") {
      key = keys.recent;
      kind = "shared";
      matches = arrayMatchCount(valueByKey.get(key), target);
    }

    if (option === "social_flex") {
      key = keys.flex;
      kind = "shared";
      matches = targetMatches(valueByKey.get(key), target) ? 1 : 0;

      const flex = valueByKey.get(key);
      if (
        flex &&
        (normalizeUsername(flex.challengerName) === target.username ||
          normalizeUsername(flex.targetName) === target.username ||
          cleanId(flex.challengerId) === target.userId)
      ) {
        matches = 1;
      }
    }

    if (option === "quest_period_claims") {
      key = `mega:qclaim:${channelId}:${target.userId}:*`;
      kind = "key";
      matches = 0;
    }

    if (option === "quest_npc_claims") {
      key = keys.npc;
      kind = "shared";
      const npc = valueByKey.get(key);
      matches = Array.isArray(npc?.quests)
        ? npc.quests.filter(
            (quest: any) => quest?.claimedBy?.[target.userId] === true
          ).length
        : 0;
    }

    if (option === "mega_luck_history") {
      key = keys.luck;
      kind = "key";
    }

    if (option === "leaderboard_channel_periods") {
      key = `mega:stats:${channelId}:*`;
      kind = "shared";
      matches = 0;
    }

    if (option === "leaderboard_global_periods") {
      key = "mega:gstats:*";
      kind = "shared";
      matches = 0;
    }

    if (option === "records_replay") {
      key = keys.replay;
      kind = "shared";
      matches = arrayMatchCount(valueByKey.get(key), target);
    }

    if (option === "records_slots") {
      key = keys.records;
      kind = "shared";
      const records = valueByKey.get(key);
      matches = [
        records?.bestAura,
        records?.biggestToday,
        records?.mostRollsUser,
      ].filter((entry) => targetMatches(entry, target)).length;
    }

    if (option === "records_first_aura_discoveries") {
      key = keys.firsts;
      kind = "shared";
      const firsts = valueByKey.get(key);
      matches = Object.values(firsts?.auras ?? {}).filter((entry) =>
        targetMatches(entry as Record<string, any>, target)
      ).length;
    }

    if (option === "knowledge_boss_participation") {
      key = keys.aokChannel;
      kind = "shared";
      matches = valueByKey.get(key)?.boss?.participants?.[target.userId]
        ? 1
        : 0;
    }

    if (option === "player_cooldowns") {
      key = `cd:*:${channelId}:${target.userId}*`;
      kind = "key";
      matches = 0;
    }

    if (option === "roll_access") {
      key = keys.access;
      kind = "shared";
      matches = (
        (valueByKey.get(key) as Array<Record<string, any>> | null) ?? []
      ).filter(
        (entry) =>
          normalizeUsername(entry.username) === target.username
      ).length;
    }

    if (option === "other_exact_player_keys") {
      key = `*:${channelId}:*${target.userId}*`;
      kind = "key";
      matches = 0;
    }

    return {
      option,
      kind,
      key,
      matches,
      description: optionDescription(option),
    };
  });

  const notes = [
    "Aura discoveries from !first/!firsts are player-owned and can be removed independently.",
    "Biome firsts are channel-owned in the current schema and do not store a player ID, so they are intentionally preserved.",
    "Period leaderboard cleanup removes only the player's row. Channel/global aggregate quest totals are preserved so other viewers are not punished.",
    "Full Player Reset does not delete global rolls, biome/event state, Discord settings, server boosts, Black Market state, or other viewers.",
  ];

  return {
    target,
    options,
    fullPlayerReset,
    items,
    notes,
  };
}

async function removeProfileIndex(
  r: Redis,
  target: TargetPlayer
): Promise<void> {
  const key = `profiles:${target.channelId}:keys`;
  const list = (await r.get<string[]>(key)) ?? [];
  const next = list.filter((entry) => entry !== target.profileKey);
  if (next.length !== list.length) await r.set(key, next);
}

async function resetPeriodLeaderboards(
  r: Redis,
  target: TargetPlayer,
  global: boolean
): Promise<number> {
  const pattern = global
    ? "mega:gstats:*"
    : `mega:stats:${target.channelId}:*`;

  const keys = await keysByPattern(r, pattern);
  const values = await mgetValues(r, keys);
  const writes: Record<string, any> = {};
  let changed = 0;

  const userKey = global
    ? `${target.channelId}:${target.userId}`
    : target.userId;

  for (let index = 0; index < keys.length; index++) {
    const stats = values[index];
    if (!stats?.users?.[userKey]) continue;

    delete stats.users[userKey];

    if (stats.bestAura?.user) {
      const remainingBestUser = Object.values(stats.users)
        .filter((entry: any) => entry?.bestAura)
        .sort(
          (a: any, b: any) =>
            b.bestAura.rarity - a.bestAura.rarity
        )[0] as any;

      stats.bestAura = remainingBestUser
        ? {
            name: remainingBestUser.bestAura.name,
            rarity: remainingBestUser.bestAura.rarity,
            user: remainingBestUser.name,
          }
        : undefined;
    }

    stats.updatedAt = Date.now();
    writes[keys[index]] = stats;
    changed++;
  }

  if (Object.keys(writes).length > 0) await r.mset(writes);
  return changed;
}

async function removeOtherExactKeys(
  r: Redis,
  target: TargetPlayer,
  protectedKeys: Set<string>
): Promise<string[]> {
  const patterns = [
    `*:${target.channelId}:${target.userId}`,
    `*:${target.channelId}:${target.userId}:*`,
    `*:${target.channelId}:*:${target.userId}`,
    `*:${target.channelId}:*:${target.userId}:*`,
  ];

  const questClaimPrefix =
    `mega:qclaim:${target.channelId}:${target.userId}:`;

  const cooldownNeedle =
    `:${target.channelId}:${target.userId}`;

  const found = new Set<string>();

  for (const pattern of patterns) {
    for (const key of await keysByPattern(r, pattern)) {
      const isKnownQuestClaim = key.startsWith(questClaimPrefix);
      const isKnownCooldown =
        key.startsWith("cd:") && key.includes(cooldownNeedle);

      if (
        protectedKeys.has(key) ||
        isKnownQuestClaim ||
        isKnownCooldown
      ) {
        continue;
      }

      found.add(key);
    }
  }

  const keys = [...found];
  if (keys.length > 0) await r.del(...keys);
  return keys;
}

async function executePlan(
  r: Redis,
  plan: ResetPlan
): Promise<{
  writes: number;
  deletedKeys: number;
  sharedChanges: number;
}> {
  const selected = new Set(plan.options);
  const target = plan.target;

  const keys = {
    profile: target.profileKey,
    inventory: `inventory:${target.channelId}:${target.userId}`,
    core: `core-system:${target.channelId}:${target.userId}`,
    knowledge: `aok:player:${target.channelId}:${target.userId}`,
    titles: `social:titles:${target.channelId}:${target.userId}`,
    recent: `social:recent:${target.channelId}`,
    flex: `social:flex:${target.channelId}`,
    npc: `social:npc:${target.channelId}`,
    replay: `mega:replay:${target.channelId}`,
    records: `mega:records:${target.channelId}`,
    firsts: `mega:firsts:${target.channelId}`,
    aokChannel: `aok:channel:${target.channelId}`,
    access: `roll-access:${target.channelId}`,
    luck: `mega:luck:${target.channelId}:${target.userId}`,
  };

  const directKeys = [
    keys.profile,
    keys.inventory,
    keys.core,
    keys.knowledge,
  ];

  const directValues = await mgetValues(r, directKeys);
  const profile = directValues[0] as Record<string, any> | null;
  const inventory = directValues[1] as Record<string, any> | null;
  const core = directValues[2] as Record<string, any> | null;
  const knowledge = directValues[3] as Record<string, any> | null;

  const writes: Record<string, any> = {};
  const deletes = new Set<string>();
  let sharedChanges = 0;

  if (profile && PROFILE_OPTIONS.some((option) => selected.has(option))) {
    if (hasAll(selected, PROFILE_OPTIONS)) {
      deletes.add(keys.profile);
    } else {
      resetProfileFields(profile, selected);
      writes[keys.profile] = profile;
    }
  }

  if (
    inventory &&
    INVENTORY_OPTIONS.some((option) => selected.has(option))
  ) {
    if (hasAll(selected, INVENTORY_OPTIONS)) {
      deletes.add(keys.inventory);
    } else {
      resetInventoryFields(inventory, selected);
      writes[keys.inventory] = inventory;
    }
  }

  if (core && CORE_OPTIONS.some((option) => selected.has(option))) {
    if (hasAll(selected, CORE_OPTIONS)) {
      deletes.add(keys.core);
    } else {
      resetCoreFields(core, selected, target);
      writes[keys.core] = core;
    }
  }

  if (
    knowledge &&
    KNOWLEDGE_OPTIONS.some((option) => selected.has(option))
  ) {
    if (hasAll(selected, KNOWLEDGE_OPTIONS)) {
      deletes.add(keys.knowledge);
    } else {
      resetKnowledgeFields(knowledge, selected);
      writes[keys.knowledge] = knowledge;
    }
  }

  if (selected.has("profile_index")) {
    await removeProfileIndex(r, target);
    sharedChanges++;
  }

  if (selected.has("inventory_pending_grants") && target.username) {
    deletes.add(
      `inventory-grants:${target.channelId}:${target.username}`
    );
  }

  if (selected.has("social_titles")) deletes.add(keys.titles);
  if (selected.has("mega_luck_history")) deletes.add(keys.luck);

  if (selected.has("quest_period_claims")) {
    for (const key of await keysByPattern(
      r,
      `mega:qclaim:${target.channelId}:${target.userId}:*`
    )) {
      deletes.add(key);
    }
  }

  if (selected.has("player_cooldowns")) {
    const patterns = [
      `cd:*:${target.channelId}:${target.userId}`,
      `cd:*:${target.channelId}:${target.userId}:*`,
    ];

    for (const pattern of patterns) {
      for (const key of await keysByPattern(r, pattern)) {
        deletes.add(key);
      }
    }
  }

  const sharedKeys = [
    keys.recent,
    keys.flex,
    keys.npc,
    keys.replay,
    keys.records,
    keys.firsts,
    keys.aokChannel,
    keys.access,
  ];

  const sharedValues = await mgetValues(r, sharedKeys);
  const shared = new Map<string, any>(
    sharedKeys.map((key, index) => [key, sharedValues[index]])
  );

  if (selected.has("social_recent_pulls")) {
    const list = (shared.get(keys.recent) as Array<Record<string, any>>) ?? [];
    const next = removeTargetFromArray(list, target);

    if (next.length !== list.length) {
      writes[keys.recent] = next;
      sharedChanges += list.length - next.length;
    }
  }

  if (selected.has("social_flex")) {
    const flex = shared.get(keys.flex);

    if (
      flex &&
      (cleanId(flex.challengerId) === target.userId ||
        normalizeUsername(flex.challengerName) === target.username ||
        normalizeUsername(flex.targetName) === target.username)
    ) {
      deletes.add(keys.flex);
      sharedChanges++;
    }
  }

  if (selected.has("quest_npc_claims")) {
    const npc = shared.get(keys.npc);

    if (Array.isArray(npc?.quests)) {
      let changed = 0;

      for (const quest of npc.quests) {
        if (quest?.claimedBy?.[target.userId]) {
          delete quest.claimedBy[target.userId];
          changed++;
        }
      }

      if (changed > 0) {
        writes[keys.npc] = npc;
        sharedChanges += changed;
      }
    }
  }

  if (selected.has("records_replay")) {
    const list = (shared.get(keys.replay) as Array<Record<string, any>>) ?? [];
    const next = removeTargetFromArray(list, target);

    if (next.length !== list.length) {
      writes[keys.replay] = next;
      sharedChanges += list.length - next.length;
    }
  }

  if (selected.has("records_slots")) {
    const records = shared.get(keys.records);

    if (records) {
      let changed = 0;

      for (const field of [
        "bestAura",
        "biggestToday",
        "mostRollsUser",
      ]) {
        if (targetMatches(records[field], target)) {
          delete records[field];
          changed++;
        }
      }

      if (changed > 0) {
        records.updatedAt = Date.now();
        writes[keys.records] = records;
        sharedChanges += changed;
      }
    }
  }

  if (selected.has("records_first_aura_discoveries")) {
    const firsts = shared.get(keys.firsts);

    if (firsts?.auras) {
      let changed = 0;

      for (const [auraId, entry] of Object.entries(firsts.auras)) {
        if (targetMatches(entry as Record<string, any>, target)) {
          delete firsts.auras[auraId];
          changed++;
        }
      }

      if (changed > 0) {
        writes[keys.firsts] = firsts;
        sharedChanges += changed;
      }
    }
  }

  if (selected.has("knowledge_boss_participation")) {
    const channel = shared.get(keys.aokChannel);

    if (channel?.boss?.participants?.[target.userId]) {
      delete channel.boss.participants[target.userId];
      channel.updatedAt = Date.now();
      writes[keys.aokChannel] = channel;
      sharedChanges++;
    }
  }

  if (selected.has("roll_access")) {
    const list = (shared.get(keys.access) as Array<Record<string, any>>) ?? [];
    const next = list.filter(
      (entry) =>
        normalizeUsername(entry.username) !== target.username
    );

    if (next.length !== list.length) {
      writes[keys.access] = next;
      sharedChanges += list.length - next.length;
    }
  }

  if (selected.has("leaderboard_channel_periods")) {
    sharedChanges += await resetPeriodLeaderboards(r, target, false);
  }

  if (selected.has("leaderboard_global_periods")) {
    sharedChanges += await resetPeriodLeaderboards(r, target, true);
  }

  if (Object.keys(writes).length > 0) await r.mset(writes);
  if (deletes.size > 0) await r.del(...deletes);

  if (selected.has("other_exact_player_keys")) {
    const protectedKeys = new Set([
      keys.profile,
      keys.inventory,
      keys.core,
      keys.knowledge,
      keys.titles,
      keys.luck,
      `channel:${target.channelId}:state`,
      `mega:discord:${target.channelId}`,
      `mega:event:${target.channelId}`,
      `mega:blackmarket:${target.channelId}`,
      `social:boosts:${target.channelId}`,
      `profiles:${target.channelId}:keys`,
      `aok:channel:${target.channelId}`,
    ]);

    const extra = await removeOtherExactKeys(r, target, protectedKeys);
    for (const key of extra) deletes.add(key);
  }

  return {
    writes: Object.keys(writes).length,
    deletedKeys: deletes.size,
    sharedChanges,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Use POST from the player-reset dashboard.",
    });
  }

  const body = (req.body ?? {}) as ResetRequestBody;

  if (!isAuthorized(req, body)) {
    return res.status(401).json({
      ok: false,
      error: "Reset locked. Enter the correct CRON_SECRET.",
    });
  }

  const r = getRedis();

  if (!r) {
    return res.status(503).json({
      ok: false,
      error: "Redis is not connected.",
    });
  }

  try {
    const plan = await buildPlan(r, body);
    const preview = body.preview !== false;

    if (preview) {
      return res.status(200).json({
        ok: true,
        preview: true,
        plan,
        totals: {
          selectedItems: plan.options.length,
          currentlyMatchedEntries: plan.items.reduce(
            (sum, item) => sum + item.matches,
            0
          ),
        },
      });
    }

    const expectedByName = `RESET ${plan.target.username}`;
    const expectedById = `RESET ${plan.target.userId}`;
    const confirmation = String(body.confirmation ?? "").trim();

    if (
      confirmation !== expectedByName &&
      confirmation !== expectedById
    ) {
      return res.status(400).json({
        ok: false,
        error: `Confirmation must exactly match "${expectedByName}" or "${expectedById}".`,
      });
    }

    const result = await executePlan(r, plan);

    return res.status(200).json({
      ok: true,
      preview: false,
      message: `✅ Reset completed for ${plan.target.displayName} (${plan.target.userId}).`,
      selectedItems: plan.options.length,
      fullPlayerReset: plan.fullPlayerReset,
      ...result,
      notes: plan.notes,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
