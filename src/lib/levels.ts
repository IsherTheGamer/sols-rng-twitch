import levelRewardsData from "../../data/level-rewards.json";
import type { AuraDef } from "../types/data";

export type LevelTierId =
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

type LootPoolId =
  | "starter"
  | "beginner"
  | "early"
  | "early_good"
  | "normal"
  | "normal_good"
  | "good"
  | "rare"
  | "elite"
  | "godly"
  | "post100";

export interface WeeklyXpState {
  weekId: string;
  tierCounts: Record<string, number>;
}

export interface LevelReward {
  level: number;
  name: string;
  type: string;
  id: string;
  amount: number;
  pool?: LootPoolId;
  claimKey?: string;
}

export interface LevelXpResult {
  xpGained: number;
  baseXp: number;
  bonusXp: number;
  levelBefore: number;
  levelAfter: number;
  levelsGained: number;
  unlockedRewards: LevelReward[];
  notes: string[];
}

interface LootPoolEntry {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  weight: number;
}

const STATIC_REWARDS = levelRewardsData.rewards as LevelReward[];

const TIER_XP: Partial<Record<LevelTierId, number>> = {
  unique: 5,
  legendary: 10,
  mythic: 25,
  exalted: 50,
  glorious: 125,
  transcendent: 350,
  dimensional: 2000,
  "challenged+": 1000,
  "dev-exclusive": 10000,
};

const WEEKLY_TIER_LIMITS: Partial<Record<LevelTierId, number>> = {
  unique: 200,
  legendary: 100,
  mythic: 75,
  exalted: 50,
  glorious: 25,
  transcendent: 5,
  dimensional: 1,
  challenged: 10,
  "challenged+": 3,
};

const LOOT_POOLS: Record<LootPoolId, LootPoolEntry[]> = {
  starter: [
    { id: "spark", name: "Token of Spark", minAmount: 1, maxAmount: 3, weight: 35 },
    { id: "drizzle", name: "Token of Drizzle", minAmount: 1, maxAmount: 2, weight: 25 },
    { id: "ember", name: "Token of Ember", minAmount: 1, maxAmount: 2, weight: 20 },
    { id: "popping", name: "Token of Popping", minAmount: 1, maxAmount: 1, weight: 20 }
  ],

  beginner: [
    { id: "spark", name: "Token of Spark", minAmount: 2, maxAmount: 4, weight: 20 },
    { id: "drizzle", name: "Token of Drizzle", minAmount: 1, maxAmount: 3, weight: 18 },
    { id: "ember", name: "Token of Ember", minAmount: 1, maxAmount: 2, weight: 17 },
    { id: "frost", name: "Token of Frost", minAmount: 1, maxAmount: 2, weight: 15 },
    { id: "popping", name: "Token of Popping", minAmount: 1, maxAmount: 2, weight: 20 },
    { id: "lunar", name: "Token of Lunar", minAmount: 1, maxAmount: 1, weight: 10 }
  ],

  early: [
    { id: "popping", name: "Token of Popping", minAmount: 1, maxAmount: 3, weight: 25 },
    { id: "lunar", name: "Token of Lunar", minAmount: 1, maxAmount: 2, weight: 20 },
    { id: "fortune", name: "Token of Fortune", minAmount: 1, maxAmount: 1, weight: 15 },
    { id: "bloom", name: "Token of Bloom", minAmount: 1, maxAmount: 1, weight: 15 },
    { id: "storm", name: "Token of Storm", minAmount: 1, maxAmount: 1, weight: 15 },
    { id: "clover", name: "Token of Clover", minAmount: 1, maxAmount: 1, weight: 10 }
  ],

  early_good: [
    { id: "popping", name: "Token of Popping", minAmount: 2, maxAmount: 4, weight: 20 },
    { id: "fortune", name: "Token of Fortune", minAmount: 1, maxAmount: 2, weight: 20 },
    { id: "clover", name: "Token of Clover", minAmount: 1, maxAmount: 1, weight: 18 },
    { id: "bound", name: "Token of Bound", minAmount: 1, maxAmount: 1, weight: 14 },
    { id: "prism", name: "Token of Prism", minAmount: 1, maxAmount: 1, weight: 14 },
    { id: "comet", name: "Token of Comet", minAmount: 1, maxAmount: 1, weight: 14 }
  ],

  normal: [
    { id: "popping", name: "Token of Popping", minAmount: 2, maxAmount: 5, weight: 18 },
    { id: "fortune", name: "Token of Fortune", minAmount: 1, maxAmount: 3, weight: 16 },
    { id: "bound", name: "Token of Bound", minAmount: 1, maxAmount: 2, weight: 15 },
    { id: "clover", name: "Token of Clover", minAmount: 1, maxAmount: 2, weight: 14 },
    { id: "eclipse", name: "Token of Eclipse", minAmount: 1, maxAmount: 1, weight: 10 },
    { id: "starlight", name: "Token of Starlight", minAmount: 1, maxAmount: 1, weight: 9 },
    { id: "pulse", name: "Token of Pulse", minAmount: 1, maxAmount: 1, weight: 9 },
    { id: "resonance", name: "Token of Resonance", minAmount: 1, maxAmount: 1, weight: 9 }
  ],

  normal_good: [
    { id: "bound", name: "Token of Bound", minAmount: 1, maxAmount: 3, weight: 18 },
    { id: "clover", name: "Token of Clover", minAmount: 1, maxAmount: 2, weight: 16 },
    { id: "eclipse", name: "Token of Eclipse", minAmount: 1, maxAmount: 2, weight: 14 },
    { id: "starlight", name: "Token of Starlight", minAmount: 1, maxAmount: 2, weight: 14 },
    { id: "pulse", name: "Token of Pulse", minAmount: 1, maxAmount: 2, weight: 12 },
    { id: "resonance", name: "Token of Resonance", minAmount: 1, maxAmount: 1, weight: 10 },
    { id: "galaxy", name: "Token of Galaxy", minAmount: 1, maxAmount: 1, weight: 8 },
    { id: "heavenly", name: "Token of Heavenly", minAmount: 1, maxAmount: 1, weight: 8 }
  ],

  good: [
    { id: "bound", name: "Token of Bound", minAmount: 2, maxAmount: 4, weight: 16 },
    { id: "heavenly", name: "Token of Heavenly", minAmount: 1, maxAmount: 1, weight: 14 },
    { id: "nebula", name: "Token of Nebula", minAmount: 1, maxAmount: 1, weight: 12 },
    { id: "horizon", name: "Token of Horizon", minAmount: 1, maxAmount: 1, weight: 12 },
    { id: "catalyst", name: "Token of Catalyst", minAmount: 1, maxAmount: 1, weight: 10 },
    { id: "galaxy", name: "Token of Galaxy", minAmount: 1, maxAmount: 1, weight: 10 },
    { id: "nova", name: "Token of Nova", minAmount: 1, maxAmount: 1, weight: 8 },
    { id: "astral", name: "Token of Astral", minAmount: 1, maxAmount: 1, weight: 8 },
    { id: "distortion", name: "Token of Distortion", minAmount: 1, maxAmount: 1, weight: 6 },
    { id: "godlike", name: "Token of Godlike", minAmount: 1, maxAmount: 1, weight: 4 }
  ],

  rare: [
    { id: "heavenly", name: "Token of Heavenly", minAmount: 1, maxAmount: 2, weight: 18 },
    { id: "nebula", name: "Token of Nebula", minAmount: 1, maxAmount: 2, weight: 15 },
    { id: "nova", name: "Token of Nova", minAmount: 1, maxAmount: 1, weight: 14 },
    { id: "astral", name: "Token of Astral", minAmount: 1, maxAmount: 1, weight: 12 },
    { id: "supernova", name: "Token of Supernova", minAmount: 1, maxAmount: 1, weight: 10 },
    { id: "distortion", name: "Token of Distortion", minAmount: 1, maxAmount: 1, weight: 10 },
    { id: "eclipse_core", name: "Token of Eclipse Core", minAmount: 1, maxAmount: 1, weight: 8 },
    { id: "godlike", name: "Token of Godlike", minAmount: 1, maxAmount: 1, weight: 8 },
    { id: "oblivion", name: "Token of Oblivion", minAmount: 1, maxAmount: 1, weight: 5 }
  ],

  elite: [
    { id: "heavenly", name: "Token of Heavenly", minAmount: 2, maxAmount: 3, weight: 16 },
    { id: "godlike", name: "Token of Godlike", minAmount: 1, maxAmount: 1, weight: 15 },
    { id: "supernova", name: "Token of Supernova", minAmount: 1, maxAmount: 1, weight: 13 },
    { id: "distortion", name: "Token of Distortion", minAmount: 1, maxAmount: 1, weight: 12 },
    { id: "eclipse_core", name: "Token of Eclipse Core", minAmount: 1, maxAmount: 1, weight: 12 },
    { id: "nebula", name: "Token of Nebula", minAmount: 1, maxAmount: 2, weight: 12 },
    { id: "oblivion", name: "Token of Oblivion", minAmount: 1, maxAmount: 1, weight: 8 },
    { id: "bound", name: "Token of Bound", minAmount: 4, maxAmount: 8, weight: 12 }
  ],

  godly: [
    { id: "godlike", name: "Token of Godlike", minAmount: 1, maxAmount: 2, weight: 22 },
    { id: "oblivion", name: "Token of Oblivion", minAmount: 1, maxAmount: 1, weight: 18 },
    { id: "supernova", name: "Token of Supernova", minAmount: 1, maxAmount: 2, weight: 15 },
    { id: "eclipse_core", name: "Token of Eclipse Core", minAmount: 1, maxAmount: 1, weight: 15 },
    { id: "distortion", name: "Token of Distortion", minAmount: 1, maxAmount: 1, weight: 12 },
    { id: "heavenly", name: "Token of Heavenly", minAmount: 2, maxAmount: 4, weight: 10 },
    { id: "nebula", name: "Token of Nebula", minAmount: 2, maxAmount: 3, weight: 8 }
  ],

  post100: [
    { id: "popping", name: "Token of Popping", minAmount: 3, maxAmount: 8, weight: 12 },
    { id: "bound", name: "Token of Bound", minAmount: 2, maxAmount: 6, weight: 12 },
    { id: "clover", name: "Token of Clover", minAmount: 1, maxAmount: 4, weight: 10 },
    { id: "fortune", name: "Token of Fortune", minAmount: 1, maxAmount: 4, weight: 10 },
    { id: "heavenly", name: "Token of Heavenly", minAmount: 1, maxAmount: 3, weight: 10 },
    { id: "nebula", name: "Token of Nebula", minAmount: 1, maxAmount: 2, weight: 8 },
    { id: "supernova", name: "Token of Supernova", minAmount: 1, maxAmount: 2, weight: 8 },
    { id: "distortion", name: "Token of Distortion", minAmount: 1, maxAmount: 1, weight: 7 },
    { id: "eclipse_core", name: "Token of Eclipse Core", minAmount: 1, maxAmount: 1, weight: 7 },
    { id: "godlike", name: "Token of Godlike", minAmount: 1, maxAmount: 2, weight: 8 },
    { id: "oblivion", name: "Token of Oblivion", minAmount: 1, maxAmount: 1, weight: 8 }
  ]
};

function getWeekId(date = new Date()): string {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );

  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const day = Math.floor((utc - start) / 86400000);
  const week = Math.floor(day / 7) + 1;

  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function rollWeighted(pool: LootPoolEntry[]): LootPoolEntry {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;

  for (const entry of pool) {
    roll -= entry.weight;

    if (roll <= 0) return entry;
  }

  return pool[pool.length - 1];
}

function rollAmount(entry: LootPoolEntry): number {
  const min = Math.max(1, Math.floor(entry.minAmount));
  const max = Math.max(min, Math.floor(entry.maxAmount));

  return min + Math.floor(Math.random() * (max - min + 1));
}

function getRewardClaimKey(reward: LevelReward): string {
  if (reward.claimKey) return reward.claimKey;

  if (reward.level > 100) {
    return `post_100_${reward.level}:${reward.id}`;
  }

  return `${reward.level}:${reward.id}`;
}

function wasRewardClaimed(
  reward: LevelReward,
  claimed: Record<string, boolean>
): boolean {
  return Boolean(
    claimed[getRewardClaimKey(reward)] ||
      claimed[String(reward.level)]
  );
}

function resolveRandomLootReward(reward: LevelReward): LevelReward[] {
  const poolId = reward.pool ?? "starter";
  const pool = LOOT_POOLS[poolId] ?? LOOT_POOLS.starter;
  const rolls = Math.max(1, Math.floor(reward.amount ?? 1));
  const grouped = new Map<string, { id: string; name: string; amount: number }>();

  for (let i = 0; i < rolls; i++) {
    const entry = rollWeighted(pool);
    const amount = rollAmount(entry);
    const current = grouped.get(entry.id);

    grouped.set(entry.id, {
      id: entry.id,
      name: entry.name,
      amount: (current?.amount ?? 0) + amount,
    });
  }

  return [...grouped.values()].map((entry) => ({
    level: reward.level,
    name: `${entry.name} x${entry.amount}`,
    type: "token",
    id: entry.id,
    amount: entry.amount,
    claimKey: getRewardClaimKey(reward),
  }));
}

function getPost100RewardTemplate(level: number): LevelReward {
  const rolls = Math.min(8, 1 + Math.floor((level - 100) / 25));

  return {
    level,
    name: `Post-100 Loot x${rolls}`,
    type: "random_loot",
    id: `post100_loot_${level}`,
    pool: "post100",
    amount: rolls,
  };
}

function getGeneratedRewardsUpTo(level: number): LevelReward[] {
  const rewards: LevelReward[] = [];

  for (let current = 105; current <= level; current += 5) {
    rewards.push(getPost100RewardTemplate(current));
  }

  return rewards;
}

function getGeneratedUpcomingRewards(level: number, count: number): LevelReward[] {
  const rewards: LevelReward[] = [];
  let next = Math.max(105, Math.floor(level / 5) * 5 + 5);

  while (rewards.length < count) {
    rewards.push(getPost100RewardTemplate(next));
    next += 5;
  }

  return rewards;
}

export function normalizeWeeklyXpState(
  input: Partial<WeeklyXpState> | null | undefined
): WeeklyXpState {
  const currentWeek = getWeekId();

  if (!input || input.weekId !== currentWeek) {
    return {
      weekId: currentWeek,
      tierCounts: {},
    };
  }

  return {
    weekId: input.weekId,
    tierCounts: input.tierCounts ?? {},
  };
}

export function calculateLevel(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));

  return Math.max(1, Math.floor(Math.sqrt(xp / 10)));
}

export function xpRequiredForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));

  return safe * safe * 10;
}

export function xpRequiredForNextLevel(currentLevel: number): number {
  return xpRequiredForLevel(currentLevel + 1);
}

function randomChallengedXp(): number {
  return 150 + Math.floor(Math.random() * 51);
}

function getTierXp(tierId: LevelTierId): number {
  if (tierId === "challenged") {
    return randomChallengedXp();
  }

  return TIER_XP[tierId] ?? 0;
}

function canUseWeeklyTierXp(
  weekly: WeeklyXpState,
  tierId: LevelTierId
): boolean {
  const limit = WEEKLY_TIER_LIMITS[tierId];

  if (!limit) return true;

  const used = weekly.tierCounts[tierId] ?? 0;

  return used < limit;
}

function useWeeklyTierXp(weekly: WeeklyXpState, tierId: LevelTierId): void {
  const limit = WEEKLY_TIER_LIMITS[tierId];

  if (!limit) return;

  weekly.tierCounts[tierId] = (weekly.tierCounts[tierId] ?? 0) + 1;
}

function isDevExclusiveAura(aura: AuraDef, tierId: LevelTierId): boolean {
  const tags = (aura.tags ?? []).map((tag) => tag.toLowerCase().trim());

  return (
    tierId === "dev-exclusive" ||
    tags.includes("dev-exclusive") ||
    !!aura.devBiome
  );
}

export function getUnlockedLevelRewards(
  level: number,
  claimed: Record<string, boolean>
): LevelReward[] {
  const allRewards = [
    ...STATIC_REWARDS,
    ...getGeneratedRewardsUpTo(level),
  ];

  const unlocked: LevelReward[] = [];

  for (const reward of allRewards) {
    if (reward.level > level) continue;
    if (wasRewardClaimed(reward, claimed)) continue;

    if (reward.type === "random_loot") {
      unlocked.push(...resolveRandomLootReward(reward));
    } else {
      unlocked.push(reward);
    }
  }

  return unlocked;
}

export function getUpcomingLevelRewards(
  level: number,
  count = 5
): LevelReward[] {
  const staticUpcoming = STATIC_REWARDS.filter(
    (reward) => reward.level > level
  );

  const generatedUpcoming =
    level >= 100 || staticUpcoming.length < count
      ? getGeneratedUpcomingRewards(level, count)
      : [];

  return [...staticUpcoming, ...generatedUpcoming]
    .sort((a, b) => a.level - b.level)
    .slice(0, count);
}

export function getAllLevelRewards(): LevelReward[] {
  return [...STATIC_REWARDS].sort((a, b) => a.level - b.level);
}

export function awardXpForRolls(options: {
  currentXp: number;
  currentLevel: number;
  weeklyXp: WeeklyXpState;
  claimedLevelRewards: Record<string, boolean>;
  devExclusiveXpAuras: string[];
  rolls: Array<{
    aura: AuraDef;
    effectiveRarity: number;
    tierId: LevelTierId;
  }>;
}): LevelXpResult {
  const {
    currentXp,
    currentLevel,
    weeklyXp,
    claimedLevelRewards,
    devExclusiveXpAuras,
    rolls,
  } = options;

  let baseXp = 0;
  let bonusXp = 0;
  const notes: string[] = [];
  const devSet = new Set(devExclusiveXpAuras);

  for (const roll of rolls) {
    baseXp += 1;

    const tierId = roll.tierId;

    if (isDevExclusiveAura(roll.aura, tierId)) {
      if (!devSet.has(roll.aura.id)) {
        devSet.add(roll.aura.id);
        bonusXp += 10000;
        notes.push(`Dev-exclusive XP: ${roll.aura.name}`);
      }

      continue;
    }

    const tierBonus = getTierXp(tierId);

    if (tierBonus <= 0) continue;

    if (!canUseWeeklyTierXp(weeklyXp, tierId)) {
      continue;
    }

    useWeeklyTierXp(weeklyXp, tierId);
    bonusXp += tierBonus;
  }

  devExclusiveXpAuras.splice(0, devExclusiveXpAuras.length, ...devSet);

  const xpGained = baseXp + bonusXp;
  const nextXp = currentXp + xpGained;
  const levelAfter = calculateLevel(nextXp);
  const levelsGained = Math.max(0, levelAfter - currentLevel);

  const unlockedRewards = getUnlockedLevelRewards(
    levelAfter,
    claimedLevelRewards
  );

  for (const reward of unlockedRewards) {
    claimedLevelRewards[getRewardClaimKey(reward)] = true;
  }

  return {
    xpGained,
    baseXp,
    bonusXp,
    levelBefore: currentLevel,
    levelAfter,
    levelsGained,
    unlockedRewards,
    notes,
  };
}

export function formatLevelSummary(options: {
  displayName: string;
  xp: number;
  level: number;
}): string {
  const nextXp = xpRequiredForNextLevel(options.level);
  const remaining = Math.max(0, nextXp - options.xp);

  return `${options.displayName} | Level ${
    options.level
  } | XP: ${options.xp.toLocaleString("en-US")}/${nextXp.toLocaleString(
    "en-US"
  )} | Next: ${remaining.toLocaleString("en-US")} XP`;
}

export function formatRewardList(rewards: LevelReward[]): string {
  if (rewards.length === 0) return "No upcoming rewards.";

  return rewards
    .map((reward) => `Lv.${reward.level}: ${reward.name}`)
    .join(" | ");
}
