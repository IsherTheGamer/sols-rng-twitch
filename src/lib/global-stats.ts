import { Redis } from "@upstash/redis";
import type { AuraDef } from "../types/data";
import {
  type GlobalAchievementState,
  type AchievementBonuses,
  type AchievementDef,
  normalizeAchievementState,
  applyAuraRollToAchievements,
  applyBiomeVisitToAchievements,
  unlockAvailableAchievements,
  calculateAchievementBonuses,
  createDefaultAchievementState,
  getAchievementProgressLine,
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

export async function getAchievementState(): Promise<GlobalAchievementState> {
  const r = getRedis();

  if (!r) return createDefaultAchievementState();

  const data = await r.get<GlobalAchievementState>(ACHIEVEMENT_STATE_KEY);

  return normalizeAchievementState(data);
}

export async function setAchievementState(
  state: GlobalAchievementState
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
    applyAuraRollToAchievements(state, roll.aura);
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

  const changed = applyBiomeVisitToAchievements(
    state,
    biomeId,
    biomeExpiresAt
  );

  if (!changed) return [];

  const unlocked = unlockAvailableAchievements(state);

  await setAchievementState(state);

  return unlocked;
}

export async function getAchievementBonuses(): Promise<AchievementBonuses> {
  const state = await getAchievementState();
  return calculateAchievementBonuses(state);
}

export async function getAchievementProgress(): Promise<string> {
  const state = await getAchievementState();
  return getAchievementProgressLine(state);
}
