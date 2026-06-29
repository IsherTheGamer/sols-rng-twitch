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

const REWARDS = levelRewardsData.rewards as LevelReward[];

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

  return tierId === "dev-exclusive" || tags.includes("dev-exclusive") || !!aura.devBiome;
}

export function getUnlockedLevelRewards(
  level: number,
  claimed: Record<string, boolean>
): LevelReward[] {
  return REWARDS.filter((reward) => {
    if (reward.level > level) return false;

    return !claimed[String(reward.level)];
  });
}

export function getUpcomingLevelRewards(
  level: number,
  count = 5
): LevelReward[] {
  return REWARDS.filter((reward) => reward.level > level).slice(0, count);
}

export function getAllLevelRewards(): LevelReward[] {
  return [...REWARDS].sort((a, b) => a.level - b.level);
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
    claimedLevelRewards[String(reward.level)] = true;
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

  return `${options.displayName} | Level ${options.level} | XP: ${options.xp.toLocaleString("en-US")}/${nextXp.toLocaleString("en-US")} | Next: ${remaining.toLocaleString("en-US")} XP`;
}

export function formatRewardList(rewards: LevelReward[]): string {
  if (rewards.length === 0) return "No upcoming rewards.";

  return rewards
    .map((reward) => `Lv.${reward.level}: ${reward.name}`)
    .join(" | ");
}
