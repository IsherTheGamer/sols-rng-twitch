import { Redis } from "@upstash/redis";
import type { AuraDef } from "../types/data";
import type { NightbotChannel, NightbotUser } from "./nightbot";
import { formatRarity, truncate } from "./format";
import { grantLevelRewardTokens } from "./inventory";
import {
  awardXpForRolls,
  calculateLevel,
  formatLevelSummary,
  formatRewardList,
  getUpcomingLevelRewards,
  getUnlockedLevelRewards,
  markLevelRewardsClaimed,
  normalizeWeeklyXpState,
  type LevelReward,
  type WeeklyXpState,
} from "./levels";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

export type ProfileTierId =
  | "basic"
  | "epic"
  | "unique"
  | "legendary"
  | "mythic"
  | "exalted"
  | "glorious"
  | "transcendent"
  | "challenged"
  | "dimensional"
  | "challenged+"
  | "dev-exclusive";

export const PROFILE_TIER_ORDER: ProfileTierId[] = [
  "basic",
  "epic",
  "unique",
  "legendary",
  "mythic",
  "exalted",
  "glorious",
  "transcendent",
  "challenged",
  "dimensional",
  "challenged+",
  "dev-exclusive",
];

export const PROFILE_TIER_RANK: Record<ProfileTierId, number> =
  PROFILE_TIER_ORDER.reduce((acc, tier, index) => {
    acc[tier] = index + 1;
    return acc;
  }, {} as Record<ProfileTierId, number>);

export interface BestAuraRecord {
  auraId: string;
  auraName: string;
  rarity: number;
  tierId: ProfileTierId;
  tierRank: number;
  obtainedAt: number;
}

export interface ViewerProfile {
  channelId: string;
  userId: string;
  displayName: string;

  rolls: number;
  potionRolls: number;
  rarityTotal: number;

  xp: number;
  level: number;
  weeklyXp: WeeklyXpState;
  claimedLevelRewards: Record<string, boolean>;
  devExclusiveXpAuras: string[];

  highestTierId: ProfileTierId | null;
  highestTierRank: number;
  ownedTiers: Record<string, number>;

  bestAura: BestAuraRecord | null;
  bestPotionAura: BestAuraRecord | null;

  createdAt: number;
  updatedAt: number;
}

function profileKey(channelId: string, userId: string): string {
  return `profile:${channelId}:${userId}`;
}

function profileIndexKey(channelId: string): string {
  return `profiles:${channelId}:keys`;
}

function getUserId(user: NightbotUser | null): string {
  return user?.providerId ?? "anon";
}

function getDisplayName(user: NightbotUser | null): string {
  return user?.displayName ?? user?.name ?? "Player";
}

export function isBroadcasterUser(
  user: NightbotUser | null,
  channel: NightbotChannel | null
): boolean {
  if (!user) return false;

  const level = user.userLevel.toLowerCase();

  if (level === "owner" || level === "broadcaster") return true;

  if (channel?.providerId && user.providerId === channel.providerId) {
    return true;
  }

  return false;
}

export function createDefaultViewerProfile(
  channelId: string,
  userId: string,
  displayName: string
): ViewerProfile {
  const now = Date.now();

  return {
    channelId,
    userId,
    displayName,

    rolls: 0,
    potionRolls: 0,
    rarityTotal: 0,

    xp: 0,
    level: 1,
    weeklyXp: normalizeWeeklyXpState(null),
    claimedLevelRewards: {},
    devExclusiveXpAuras: [],

    highestTierId: null,
    highestTierRank: 0,
    ownedTiers: {},

    bestAura: null,
    bestPotionAura: null,

    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeViewerProfile(
  input: Partial<ViewerProfile> | null | undefined,
  channelId: string,
  userId: string,
  displayName: string
): ViewerProfile {
  const base = createDefaultViewerProfile(channelId, userId, displayName);

  if (!input) return base;

  return {
    channelId: input.channelId ?? channelId,
    userId: input.userId ?? userId,
    displayName: displayName || input.displayName || base.displayName,

    rolls: input.rolls ?? 0,
    potionRolls: input.potionRolls ?? 0,
    rarityTotal: input.rarityTotal ?? 0,

    xp: input.xp ?? 0,
    level: input.level ?? calculateLevel(input.xp ?? 0),
    weeklyXp: normalizeWeeklyXpState(input.weeklyXp),
    claimedLevelRewards: input.claimedLevelRewards ?? {},
    devExclusiveXpAuras: input.devExclusiveXpAuras ?? [],

    highestTierId: input.highestTierId ?? null,
    highestTierRank: input.highestTierRank ?? 0,
    ownedTiers: input.ownedTiers ?? {},

    bestAura: input.bestAura ?? null,
    bestPotionAura: input.bestPotionAura ?? null,

    createdAt: input.createdAt ?? base.createdAt,
    updatedAt: Date.now(),
  };
}

async function registerProfileKey(
  channelId: string,
  key: string
): Promise<void> {
  const r = getRedis();
  if (!r) return;

  const indexKey = profileIndexKey(channelId);
  const keys = (await r.get<string[]>(indexKey)) ?? [];

  if (!keys.includes(key)) {
    keys.push(key);
    await r.set(indexKey, keys);
  }
}

export async function getViewerProfile(
  channelId: string,
  user: NightbotUser | null
): Promise<ViewerProfile> {
  const userId = getUserId(user);
  const displayName = getDisplayName(user);

  const r = getRedis();

  if (!r) {
    return createDefaultViewerProfile(channelId, userId, displayName);
  }

  const key = profileKey(channelId, userId);
  const data = await r.get<ViewerProfile>(key);

  return normalizeViewerProfile(data, channelId, userId, displayName);
}

export async function setViewerProfile(
  profile: ViewerProfile
): Promise<void> {
  const r = getRedis();

  if (!r) return;

  const key = profileKey(profile.channelId, profile.userId);

  profile.updatedAt = Date.now();

  await r.set(key, profile);
  await registerProfileKey(profile.channelId, key);
}

export function getProfileTierId(
  aura: AuraDef,
  effectiveRarity: number
): ProfileTierId {
  const tags = (aura.tags ?? []).map((tag) => tag.toLowerCase().trim());

  if (tags.includes("dev-exclusive") || aura.devBiome) {
    return "dev-exclusive";
  }

  if (tags.includes("challenged+")) {
    return "challenged+";
  }

  if (tags.includes("dimensional")) {
    return "dimensional";
  }

  if (tags.includes("challenged")) {
    return "challenged";
  }

  if (effectiveRarity >= 1 && effectiveRarity <= 999) return "basic";
  if (effectiveRarity >= 1000 && effectiveRarity <= 9999) return "epic";
  if (effectiveRarity >= 10000 && effectiveRarity <= 99999) return "unique";

  if (effectiveRarity >= 100000 && effectiveRarity <= 999999) {
    return "legendary";
  }

  if (effectiveRarity >= 1000000 && effectiveRarity <= 9999999) {
    return "mythic";
  }

  if (effectiveRarity >= 10000000 && effectiveRarity <= 99999998) {
    return "exalted";
  }

  if (effectiveRarity >= 99999999 && effectiveRarity <= 999999999) {
    return "glorious";
  }

  if (effectiveRarity >= 1000000000 && effectiveRarity <= 7499999999) {
    return "transcendent";
  }

  return "dimensional";
}

function makeBestAuraRecord(
  aura: AuraDef,
  effectiveRarity: number
): BestAuraRecord {
  const tierId = getProfileTierId(aura, effectiveRarity);

  return {
    auraId: aura.id,
    auraName: aura.name,
    rarity: effectiveRarity,
    tierId,
    tierRank: PROFILE_TIER_RANK[tierId],
    obtainedAt: Date.now(),
  };
}

function isBetterAura(
  next: BestAuraRecord,
  current: BestAuraRecord | null
): boolean {
  if (!current) return true;

  if (next.tierRank !== current.tierRank) {
    return next.tierRank > current.tierRank;
  }

  return next.rarity > current.rarity;
}

function updateOwnedTier(profile: ViewerProfile, tierId: ProfileTierId): void {
  const rank = PROFILE_TIER_RANK[tierId];

  profile.ownedTiers[tierId] = (profile.ownedTiers[tierId] ?? 0) + 1;

  if (rank > profile.highestTierRank) {
    profile.highestTierRank = rank;
    profile.highestTierId = tierId;
  }
}

export async function recordViewerRolls(
  channelId: string,
  user: NightbotUser | null,
  rolls: Array<{ aura: AuraDef; effectiveRarity: number }>,
  source: "roll" | "potion"
): Promise<ViewerProfile> {
  const profile = await getViewerProfile(channelId, user);

  for (const roll of rolls) {
    const record = makeBestAuraRecord(roll.aura, roll.effectiveRarity);

    profile.rarityTotal += Math.max(0, Math.floor(roll.effectiveRarity));

    if (source === "roll") {
      profile.rolls += 1;
      updateOwnedTier(profile, record.tierId);

      if (isBetterAura(record, profile.bestAura)) {
        profile.bestAura = record;
      }
    } else {
      profile.potionRolls += 1;

      if (isBetterAura(record, profile.bestPotionAura)) {
        profile.bestPotionAura = record;
      }
    }
  }

  const levelResult = awardXpForRolls({
    currentXp: profile.xp,
    currentLevel: profile.level,
    weeklyXp: profile.weeklyXp,
    claimedLevelRewards: profile.claimedLevelRewards,
    devExclusiveXpAuras: profile.devExclusiveXpAuras,
    rolls: rolls.map((roll) => {
      const record = makeBestAuraRecord(roll.aura, roll.effectiveRarity);

      return {
        aura: roll.aura,
        effectiveRarity: roll.effectiveRarity,
        tierId: record.tierId,
      };
    }),
  });

  profile.xp += levelResult.xpGained;
  profile.level = levelResult.levelAfter;

  await setViewerProfile(profile);

  return profile;
}

export function hasTierAtLeast(
  profile: ViewerProfile,
  requiredTier: ProfileTierId
): boolean {
  return profile.highestTierRank >= PROFILE_TIER_RANK[requiredTier];
}

function formatBestAura(record: BestAuraRecord | null): string {
  if (!record) return "None";

  return `${record.auraName} [${record.tierId}]`;
}

export function formatViewerProfile(profile: ViewerProfile): string {
  const bestRarity = profile.bestAura
    ? formatRarity(profile.bestAura.rarity)
    : "None";

  const msg =
    `${profile.displayName} | Level: ${profile.level} | XP: ${profile.xp.toLocaleString(
      "en-US"
    )} | Rolls: ${profile.rolls} | ` +
    `Best Rarity: ${bestRarity} | ` +
    `Best Aura: ${formatBestAura(profile.bestAura)} | ` +
    `Best Potion: ${formatBestAura(profile.bestPotionAura)}`;

  return truncate(msg, 390);
}

export async function listViewerProfiles(
  channelId: string
): Promise<ViewerProfile[]> {
  const r = getRedis();

  if (!r) return [];

  const indexKey = profileIndexKey(channelId);
  const keys = (await r.get<string[]>(indexKey)) ?? [];

  const profiles: ViewerProfile[] = [];

  for (const key of keys) {
    const data = await r.get<ViewerProfile>(key);

    if (!data) continue;

    profiles.push(
      normalizeViewerProfile(
        data,
        data.channelId ?? channelId,
        data.userId ?? "anon",
        data.displayName ?? "Player"
      )
    );
  }

  return profiles;
}

export function formatViewerLevel(profile: ViewerProfile): string {
  return formatLevelSummary({
    displayName: profile.displayName,
    xp: profile.xp,
    level: profile.level,
  });
}

export function formatViewerLevelRewards(profile: ViewerProfile): string {
  const rewards = getUpcomingLevelRewards(profile.level, 5);

  return `${profile.displayName} upcoming rewards: ${formatRewardList(rewards)}`;
}

export async function resetViewerProfiles(channelId: string): Promise<void> {
  const r = getRedis();

  if (!r) return;

  const indexKey = profileIndexKey(channelId);
  const keys = (await r.get<string[]>(indexKey)) ?? [];

  if (keys.length > 0) {
    await r.del(...keys);
  }

  await r.del(indexKey);
}
