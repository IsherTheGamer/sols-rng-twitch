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

const POST_100_REWARD_POOL: Array<{
  name: string;
  id: string;
  minAmount: number;
  maxAmount: number;
}> = [
  { name: "Token of Popping", id: "popping", minAmount: 1, maxAmount: 5 },
  { name: "Token of Bound", id: "bound", minAmount: 1, maxAmount: 3 },
  { name: "Token of Heavenly", id: "heavenly", minAmount: 1, maxAmount: 2 },
  { name: "Token of Clover", id: "clover", minAmount: 1, maxAmount: 2 },
  { name: "Token of Lunar", id: "lunar", minAmount: 1, maxAmount: 3 },
  { name: "Token of Eclipse", id: "eclipse", minAmount: 1, maxAmount: 2 },
  { name: "Token of Starlight", id: "starlight", minAmount: 1, maxAmount: 2 },
  { name: "Token of Nebula", id: "nebula", minAmount: 1, maxAmount: 1 },
  { name: "Token of Fortune", id: "fortune", minAmount: 1, maxAmount: 2 },
  { name: "Token of Godlike", id: "godlike", minAmount: 1, maxAmount: 1 },
  { name: "Token of Oblivion", id: "oblivion", minAmount: 1, maxAmount: 1 },
];

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

function hashNumber(input: string): number {
  let hash = 0;

  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}

function randomPost100Reward(level: number): LevelReward {
  const poolIndex = hashNumber(`reward-${level}`) % POST_100_REWARD_POOL.length;
  const chosen = POST_100_REWARD_POOL[poolIndex];

  const spread = chosen.maxAmount - chosen.minAmount + 1;
  const amount =
    chosen.minAmount + (hashNumber(`amount-${level}`) % Math.max(1, spread));

  return {
    level,
    name: `${chosen.name} x${amount}`,
    type: "token",
    id: chosen.id,
    amount,
  };
}

function getGeneratedRewardsUpTo(level: number): LevelReward[] {
  const rewards: LevelReward[] = [];

  for (let current = 105; current <= level; current += 5) {
    rewards.push(randomPost100Reward(current));
  }

  return rewards;
}

function getGeneratedUpcomingRewards(level: number, count: number): LevelReward[] {
  const rewards: LevelReward[] = [];
  let next = Math.max(105, Math.floor(level / 5) * 5 + 5);

  while (rewards.length < count) {
    rewards.push(randomPost100Reward(next));
    next += 5;
  }

  return rewards;
}

function getRewardClaimKey(reward: LevelReward): string {
  if (reward.level > 100) {
    return `post_100_${reward.level}`;
  }

  return String(reward.level);
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

  return allRewards.filter((reward) => {
    if (reward.level > level) return false;

    return !claimed[getRewardClaimKey(reward)];
  });
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
