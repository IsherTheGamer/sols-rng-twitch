import { Redis } from "@upstash/redis";
import type { AuraDef } from "../types/data";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  NORMAL_BIOMES,
  RARE_BIOMES,
  EVENT_BIOMES,
  AURA_TIER_IDS,
  type AchievementDef,
  type AchievementState,
  createDefaultAchievementState,
  normalizeAchievementState,
  recordAuraRollInState,
  recordBiomeVisitInState,
  unlockAvailableAchievements,
  calculateAchievementBonuses,
  formatReward,
  getAchievementProgress,
  getAchievementTarget,
  normalizeAchievementCategory,
} from "./achievements";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

const GLOBAL_ROLLS_KEY = "global:rolls";
const ACHIEVEMENT_STATE_KEY = "global:achievement-state";

export async function addGlobalRolls(amount = 1): Promise<number> {
  const r = getRedis();

  if (!r) return 0;

  const newValue = await r.incrby(GLOBAL_ROLLS_KEY, amount);
  return newValue;
}

export async function getGlobalRolls(): Promise<number> {
  const r = getRedis();

  if (!r) return 0;

  const v = await r.get<number>(GLOBAL_ROLLS_KEY);
  return v ?? 0;
}

export function getGlobalLuck(globalRolls: number): number {
  if (globalRolls >= 10000) return 4;
  if (globalRolls >= 1000) return 3;
  if (globalRolls >= 100) return 2;
  return 1;
}

export function getNextLuckMilestone(globalRolls: number): {
  target: number;
  remaining: number;
  nextLuck: number;
} {
  if (globalRolls < 100) {
    return {
      target: 100,
      remaining: 100 - globalRolls,
      nextLuck: 2,
    };
  }

  if (globalRolls < 1000) {
    return {
      target: 1000,
      remaining: 1000 - globalRolls,
      nextLuck: 3,
    };
  }

  if (globalRolls < 10000) {
    return {
      target: 10000,
      remaining: 10000 - globalRolls,
      nextLuck: 4,
    };
  }

  return {
    target: 10000,
    remaining: 0,
    nextLuck: 4,
  };
}

export async function getAchievementState(): Promise<AchievementState> {
  const r = getRedis();

  if (!r) return createDefaultAchievementState();

  const data = await r.get<AchievementState>(ACHIEVEMENT_STATE_KEY);

  return normalizeAchievementState(data);
}

export async function setAchievementState(
  state: AchievementState
): Promise<void> {
  const r = getRedis();

  if (!r) return;

  await r.set(ACHIEVEMENT_STATE_KEY, state);
}

export async function recordAuraRolls(
  rolls: Array<{ aura: AuraDef; effectiveRarity: number }>
): Promise<AchievementDef[]> {
  const state = await getAchievementState();

  for (const roll of rolls) {
    recordAuraRollInState(state, roll.aura);
  }

  const unlocked = unlockAvailableAchievements(state);

  await setAchievementState(state);

  return unlocked;
}

export async function recordBiomeVisit(
  biomeId: string,
  biomeExpiresAt?: number
): Promise<AchievementDef[]> {
  const state = await getAchievementState();

  const changed = recordBiomeVisitInState(
    state,
    biomeId,
    biomeExpiresAt
  );

  if (!changed) return [];

  const unlocked = unlockAvailableAchievements(state);

  await setAchievementState(state);

  return unlocked;
}

export async function getAchievementBonuses() {
  const state = await getAchievementState();
  return calculateAchievementBonuses(state);
}

function parsePage(raw: string | undefined, fallback = 1): number {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

export async function getAchievementMenuLine(
  categoryRaw?: string,
  pageRaw?: string
): Promise<string> {
  const state = await getAchievementState();

  if (!categoryRaw) {
    const cats = ACHIEVEMENT_CATEGORIES.map((c) => c.id).join(", ");
    return `Achievements: ${cats} | Use !achievements tiers 1`;
  }

  const category = normalizeAchievementCategory(categoryRaw);

  if (!category) {
    const cats = ACHIEVEMENT_CATEGORIES.map((c) => c.id).join(", ");
    return `Unknown category. Use: ${cats}`;
  }

  const list = ACHIEVEMENTS.filter((a) => a.category === category);

  if (list.length === 0) {
    return `No achievements in ${category}.`;
  }

  const page = parsePage(pageRaw, 1);
  const index = page - 1;
  const totalPages = list.length;

  if (index < 0 || index >= list.length) {
    return `No page ${page}. Use !achievements ${category} 1-${totalPages}`;
  }

  const achievement = list[index];
  const progress = getAchievementProgress(state, achievement);
  const target = getAchievementTarget(achievement);
  const done = progress >= target;
  const left = Math.max(0, target - progress);
  const reward = formatReward(achievement.reward);

  const progressText = done ? "DONE" : `${progress}/${target}`;
  const nextText = done ? "Unlocked" : `Next ${left}`;

  return `ACH ${category} ${page}/${totalPages}: ${achievement.name} | ${progressText} | Reward ${reward} | ${nextText}`;
}

function formatCounterEntries(
  label: string,
  entries: Array<[string, number]>,
  pageRaw?: string
): string {
  const perPage = 4;
  const page = parsePage(pageRaw, 1);
  const totalPages = Math.max(1, Math.ceil(entries.length / perPage));

  if (page > totalPages) {
    return `No page ${page}. Use !counter ${label} 1-${totalPages}`;
  }

  const start = (page - 1) * perPage;
  const pageEntries = entries.slice(start, start + perPage);

  const body = pageEntries
    .map(([name, value]) => `${name} ${value}`)
    .join(" | ");

  return `Counter ${label} ${page}/${totalPages}: ${body}`;
}

export async function getCounterMenuLine(
  categoryRaw?: string,
  pageRaw?: string
): Promise<string> {
  const state = await getAchievementState();
  const bonuses = calculateAchievementBonuses(state);

  if (!categoryRaw) {
    return "Counters: totals, tiers, biomes, rare, events | Use !counter tiers 1";
  }

  const category = categoryRaw.toLowerCase().trim();

  if (category === "total" || category === "totals") {
    return `Totals: rolls ${state.totalAuraRolls} | biomes ${state.totalBiomeVisits} | ACH ${state.unlocked.length}/${ACHIEVEMENTS.length} | +Luck ${bonuses.flatLuck}`;
  }

  if (category === "tier" || category === "tiers" || category === "aura") {
    const entries = AURA_TIER_IDS.map((id) => [
      id,
      state.auraTierCounts[id] ?? 0,
    ] as [string, number]);

    return formatCounterEntries("tiers", entries, pageRaw);
  }

  if (category === "biome" || category === "biomes") {
    const entries = NORMAL_BIOMES.map((id) => [
      id,
      state.biomeCounts[id] ?? 0,
    ] as [string, number]);

    return formatCounterEntries("biomes", entries, pageRaw);
  }

  if (category === "rare") {
    const entries = RARE_BIOMES.map((id) => [
      id,
      state.biomeCounts[id] ?? 0,
    ] as [string, number]);

    return formatCounterEntries("rare", entries, pageRaw);
  }

  if (category === "event" || category === "events") {
    const entries: Array<[string, number]> = [
      ...EVENT_BIOMES.map((id) => [
        id,
        state.biomeCounts[id] ?? 0,
      ] as [string, number]),
      ["event_100m", state.auraTierCounts.event_100m ?? 0],
      ["event_500m", state.auraTierCounts.event_500m ?? 0],
      ["dev-exclusive", state.auraTierCounts["dev-exclusive"] ?? 0],
      ["illusionary", state.auraCounts.illusionary ?? 0],
    ];

    return formatCounterEntries("events", entries, pageRaw);
  }

  if (category === "rain" || category === "rainy") {
    return `Rain counters: current ${state.rainyStreak} | best ${state.maxRainyStreak} | rainy ${state.biomeCounts.rainy ?? 0}`;
  }

  return "Unknown counter. Use: totals, tiers, biomes, rare, events";
}
