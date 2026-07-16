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
  getUnlockedLevelRewards,
  getUpcomingLevelRewards,
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

const TOKEN_PRIORITY: Record<string, number> = {
  overpowered_potion: 10000,
  oblivion: 9500,
  godlike: 9000,
  chaos_potion: 8800,
  axis_potion: 8700,
  xyz_potion: 8600,
  word_potion: 8500,
  pump_kings_blood: 8200,
  red_fragment_ii: 8000,
  void_heart: 7800,
  dune: 7600,
  heavenly: 7000,
  bound: 6500,
  popping: 6000,

  eclipse_core: 5600,
  distortion: 5400,
  supernova: 5200,
  nebula: 5000,
  starlight: 4800,
  eclipse: 4600,
  astral: 4400,
  nova: 4200,
  galaxy: 4000,
  catalyst: 3800,
  horizon: 3600,
  resonance: 3400,
  pulse: 3200,
  stability: 3000,
  clover: 2800,
  fortune: 2600,
  comet: 2400,
  prism: 2200,
  storm: 2000,
  bloom: 1800,
  frost: 1600,
  ember: 1400,
  lunar: 1200,
  drizzle: 1000,
  spark: 800,
};

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
  tokenRolls: number;

  // Legacy field kept so old saved profiles do not break.
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
  bestTokenAura: BestAuraRecord | null;

  // Legacy field kept so old saved profiles do not break.
  bestPotionAura: BestAuraRecord | null;

  createdAt: number;
  updatedAt: number;
}

export interface LevelClaimResult {
  profile: ViewerProfile;
  claimedRewards: LevelReward[];
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

function tokenPriority(tokenId: string): number {
  return TOKEN_PRIORITY[tokenId] ?? 0;
}

function shortRewardName(reward: LevelReward): string {
  return reward.name
    .replace(/^Token of\s+/i, "")
    .replace(/^Potion of\s+/i, "")
    .replace(/\s+Potion$/i, "")
    .replace(/\sx\d+$/i, "")
    .trim();
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
    tokenRolls: 0,
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
    bestTokenAura: null,
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

  const legacyTokenRolls = input.tokenRolls ?? input.potionRolls ?? 0;
  const legacyBestTokenAura = input.bestTokenAura ?? input.bestPotionAura ?? null;

  return {
    channelId: input.channelId ?? channelId,
    userId: input.userId ?? userId,
    displayName: displayName || input.displayName || base.displayName,

    rolls: input.rolls ?? 0,
    tokenRolls: legacyTokenRolls,
    potionRolls: legacyTokenRolls,

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
    bestTokenAura: legacyBestTokenAura,
    bestPotionAura: legacyBestTokenAura,

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
  const profile = normalizeViewerProfile(data, channelId, userId, displayName);

  // Makes !profile create/register the user so other people can view them later.
  // Avoid saving anonymous browser/test profiles.
  if (user) {
    if (!data) {
      await r.set(key, profile);
    }

    await registerProfileKey(channelId, key);
  }

  return profile;
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
  source: "roll" | "token" | "potion"
): Promise<ViewerProfile> {
  const profile = await getViewerProfile(channelId, user);
  const isTokenRoll = source === "token" || source === "potion";

  for (const roll of rolls) {
    const record = makeBestAuraRecord(roll.aura, roll.effectiveRarity);

    profile.rarityTotal += Math.max(0, Math.floor(roll.effectiveRarity));

    if (isTokenRoll) {
      profile.tokenRolls += 1;
      profile.potionRolls = profile.tokenRolls;

      if (isBetterAura(record, profile.bestTokenAura)) {
        profile.bestTokenAura = record;
        profile.bestPotionAura = record;
      }
    } else {
      profile.rolls += 1;
      updateOwnedTier(profile, record.tierId);

      if (isBetterAura(record, profile.bestAura)) {
        profile.bestAura = record;
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

  const bestTokenRarity = profile.bestTokenAura
    ? formatRarity(profile.bestTokenAura.rarity)
    : "None";

  const msg =
    `${profile.displayName} | Level: ${profile.level} | XP: ${profile.xp.toLocaleString(
      "en-US"
    )} | Rolls: ${profile.rolls} | Token Rolls: ${profile.tokenRolls} | ` +
    `Best Rarity: ${bestRarity} | ` +
    `Best Aura: ${formatBestAura(profile.bestAura)} | ` +
    `Best Token: ${formatBestAura(profile.bestTokenAura)} (${bestTokenRarity})`;

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

export async function claimViewerLevelRewards(
  channelId: string,
  user: NightbotUser | null
): Promise<LevelClaimResult> {
  const profile = await getViewerProfile(channelId, user);

  const rewards = getUnlockedLevelRewards(
    profile.level,
    profile.claimedLevelRewards
  );

  if (rewards.length === 0) {
    return {
      profile,
      claimedRewards: [],
    };
  }

  markLevelRewardsClaimed(profile.claimedLevelRewards, rewards);

  await grantLevelRewardTokens({
    channelId: profile.channelId,
    user,
    rewards,
  });

  await setViewerProfile(profile);

  return {
    profile,
    claimedRewards: rewards,
  };
}

function compactRewardSummary(rewards: LevelReward[], maxLength: number): string {
  const totals = new Map<
    string,
    {
      id: string;
      name: string;
      amount: number;
      priority: number;
    }
  >();

  for (const reward of rewards) {
    if (reward.type !== "token") continue;

    const current = totals.get(reward.id);
    const amount = Math.max(1, Math.floor(reward.amount ?? 1));

    totals.set(reward.id, {
      id: reward.id,
      name: shortRewardName(reward),
      amount: (current?.amount ?? 0) + amount,
      priority: tokenPriority(reward.id),
    });
  }

  const entries = [...totals.values()].sort((a, b) => {
    const priorityDiff = b.priority - a.priority;

    if (priorityDiff !== 0) return priorityDiff;

    return b.amount - a.amount;
  });

  if (entries.length === 0) {
    return "No token rewards";
  }

  const shown: string[] = [];

  for (const entry of entries) {
    const next = `${entry.name} x${entry.amount}`;
    const hidden = entries.length - shown.length - 1;
    const suffix = hidden > 0 ? ` (+${hidden} more)` : "";
    const candidate = [...shown, next].join(", ") + suffix;

    if (candidate.length > maxLength) {
      break;
    }

    shown.push(next);
  }

  const hidden = entries.length - shown.length;
  const body = shown.length > 0 ? shown.join(", ") : `${entries[0].name} x${entries[0].amount}`;

  return hidden > 0 ? `${body} (+${hidden} more)` : body;
}

export function formatLevelClaimResult(result: LevelClaimResult): string {
  if (result.claimedRewards.length === 0) {
    const next = getUpcomingLevelRewards(result.profile.level, 1)[0];

    if (!next) {
      return `${result.profile.displayName} has no level rewards to claim.`;
    }

    return `${result.profile.displayName} has no level rewards to claim. Next reward: Lv.${next.level}: ${next.name}`;
  }

  const levels = result.claimedRewards
    .map((reward) => reward.level)
    .filter((level) => Number.isFinite(level));

  const minLevel = Math.min(...levels);
  const maxLevel = Math.max(...levels);
  const levelText =
    minLevel === maxLevel ? `Lv.${minLevel}` : `Lv.${minLevel}-${maxLevel}`;

  const prefix = `🎁 ${result.profile.displayName} claimed ${levelText} | Rewards: `;
  const rewardsText = compactRewardSummary(
    result.claimedRewards,
    390 - prefix.length
  );

  return `${prefix}${rewardsText}`;
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
