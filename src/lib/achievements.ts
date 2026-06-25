import type { AuraDef } from "../types/data";

export type AchievementCategoryId =
  | "tiers"
  | "biomes"
  | "events"
  | "special";

export type AchievementCondition =
  | {
      type: "biome_count";
      biomeId: string;
      target: number;
    }
  | {
      type: "rainy_streak";
      target: number;
    }
  | {
      type: "all_biomes";
      biomeIds: string[];
      target: number;
    }
  | {
      type: "aura_tier_count";
      tierId: string;
      target: number;
    }
  | {
      type: "aura_count";
      auraId: string;
      target: number;
    };

export interface AchievementReward {
  flatLuck?: number;
  finalLuckMultiplier?: number;
  cooldownReductionSeconds?: number;
  extraRolls?: number;
}

export interface AchievementDef {
  id: string;
  category: AchievementCategoryId;
  name: string;
  condition: AchievementCondition;
  reward: AchievementReward;
  message: string;
}

export interface AchievementState {
  unlocked: string[];

  totalAuraRolls: number;
  totalBiomeVisits: number;

  biomeCounts: Record<string, number>;
  seenBiomes: string[];

  auraTierCounts: Record<string, number>;
  auraCounts: Record<string, number>;

  rainyStreak: number;
  maxRainyStreak: number;

  lastBiomeTrackKey: string | null;
}

export interface AchievementBonuses {
  flatLuck: number;
  finalLuckMultiplier: number;
  cooldownReductionSeconds: number;
  extraRolls: number;
}

export const NORMAL_BIOMES = [
  "windy",
  "snowy",
  "rainy",
  "sandstorm",
  "hell",
  "starfall",
  "heaven",
  "corruption",
  "null",
];

export const RARE_BIOMES = [
  "glitched",
  "dreamspace",
  "cyberspace",
  "singularity",
];

export const EVENT_BIOMES = [
  "graveyard",
  "pumpkin_moon",
  "blazing_sun",
  "blood_rain",
  "aurora",
  "eggland",
];

export const NON_EVENT_DEV_BIOMES = [
  ...NORMAL_BIOMES,
  ...RARE_BIOMES,
];

export const AURA_TIER_IDS = [
  "basic",
  "epic",
  "unique",
  "legendary",
  "mythic",
  "exalted",
  "glorious",
  "transcendent",
  "dimensional",
  "challenged",
  "challenged+",
  "event_100m",
  "event_500m",
  "dev-exclusive",
  "illusionary",
];

export const ACHIEVEMENT_CATEGORIES: Array<{
  id: AchievementCategoryId;
  name: string;
}> = [
  { id: "tiers", name: "Aura Tiers" },
  { id: "biomes", name: "Biomes" },
  { id: "events", name: "Events" },
  { id: "special", name: "Special" },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "aura_basic_1000",
    category: "tiers",
    name: "Basic Collector",
    condition: { type: "aura_tier_count", tierId: "basic", target: 1000 },
    reward: { flatLuck: 0.5 },
    message: "ACH Basic Collector! +0.5 luck",
  },
  {
    id: "aura_epic_1000",
    category: "tiers",
    name: "Epic Collector",
    condition: { type: "aura_tier_count", tierId: "epic", target: 1000 },
    reward: { flatLuck: 0.5 },
    message: "ACH Epic Collector! +0.5 luck",
  },
  {
    id: "aura_unique_1000",
    category: "tiers",
    name: "Unique Collector",
    condition: { type: "aura_tier_count", tierId: "unique", target: 1000 },
    reward: { flatLuck: 1 },
    message: "ACH Unique Collector! +1 luck",
  },
  {
    id: "aura_legendary_1000",
    category: "tiers",
    name: "Legendary Collector",
    condition: {
      type: "aura_tier_count",
      tierId: "legendary",
      target: 1000,
    },
    reward: { flatLuck: 1.2 },
    message: "ACH Legendary Collector! +1.2 luck",
  },
  {
    id: "aura_mythic_1000",
    category: "tiers",
    name: "Mythic Collector",
    condition: { type: "aura_tier_count", tierId: "mythic", target: 1000 },
    reward: { flatLuck: 1.6 },
    message: "ACH Mythic Collector! +1.6 luck",
  },
  {
    id: "aura_exalted_1000",
    category: "tiers",
    name: "Exalted Collector",
    condition: { type: "aura_tier_count", tierId: "exalted", target: 1000 },
    reward: { flatLuck: 2 },
    message: "ACH Exalted Collector! +2 luck",
  },
  {
    id: "aura_glorious_500",
    category: "tiers",
    name: "Glorious Collector",
    condition: { type: "aura_tier_count", tierId: "glorious", target: 500 },
    reward: { finalLuckMultiplier: 1.01 },
    message: "ACH Glorious Collector! 1.01x final luck",
  },
  {
    id: "aura_transcendent_250",
    category: "tiers",
    name: "Transcendent Collector",
    condition: {
      type: "aura_tier_count",
      tierId: "transcendent",
      target: 250,
    },
    reward: { finalLuckMultiplier: 1.03 },
    message: "ACH Transcendent Collector! 1.03x final luck",
  },
  {
    id: "aura_dimensional_20",
    category: "tiers",
    name: "Dimensional Breaker",
    condition: {
      type: "aura_tier_count",
      tierId: "dimensional",
      target: 20,
    },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH Dimensional Breaker! 1.05x final luck",
  },
  {
    id: "aura_challenged_350",
    category: "tiers",
    name: "Challenge Accepted",
    condition: {
      type: "aura_tier_count",
      tierId: "challenged",
      target: 350,
    },
    reward: { finalLuckMultiplier: 1.02 },
    message: "ACH Challenge Accepted! 1.02x final luck",
  },
  {
    id: "aura_challenged_plus_50",
    category: "tiers",
    name: "Challenge Master",
    condition: {
      type: "aura_tier_count",
      tierId: "challenged+",
      target: 50,
    },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH Challenge Master! 1.05x final luck",
  },

  {
    id: "biome_glitched_1",
    category: "biomes",
    name: "Code 404",
    condition: { type: "biome_count", biomeId: "glitched", target: 1 },
    reward: { extraRolls: 1 },
    message: "ACH Code 404! +1 bonus roll",
  },
  {
    id: "biome_dreamspace_1",
    category: "biomes",
    name: "Lucid Dreamer",
    condition: { type: "biome_count", biomeId: "dreamspace", target: 1 },
    reward: { cooldownReductionSeconds: 1 },
    message: "ACH Lucid Dreamer! -1s roll cooldown",
  },
  {
    id: "biome_cyberspace_1",
    category: "biomes",
    name: "Signal Received",
    condition: { type: "biome_count", biomeId: "cyberspace", target: 1 },
    reward: { finalLuckMultiplier: 1.01 },
    message: "ACH Signal Received! 1.01x final luck",
  },
  {
    id: "biome_singularity_1",
    category: "biomes",
    name: "Gravity Collapse",
    condition: { type: "biome_count", biomeId: "singularity", target: 1 },
    reward: { finalLuckMultiplier: 1.01 },
    message: "ACH Gravity Collapse! 1.01x final luck",
  },
  {
    id: "biome_null_1",
    category: "biomes",
    name: "Into The Null",
    condition: { type: "biome_count", biomeId: "null", target: 1 },
    reward: { flatLuck: 0.5 },
    message: "ACH Into The Null! +0.5 luck",
  },
  {
    id: "biome_null_10",
    category: "biomes",
    name: "Null Dweller",
    condition: { type: "biome_count", biomeId: "null", target: 10 },
    reward: { flatLuck: 2 },
    message: "ACH Null Dweller! +2 luck",
  },
  {
    id: "biome_all_non_event_dev",
    category: "biomes",
    name: "World Explorer",
    condition: {
      type: "all_biomes",
      biomeIds: NON_EVENT_DEV_BIOMES,
      target: NON_EVENT_DEV_BIOMES.length,
    },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH World Explorer! 1.05x final luck",
  },
  {
    id: "biome_rainy_streak_5",
    category: "biomes",
    name: "Rain Chain",
    condition: { type: "rainy_streak", target: 5 },
    reward: { flatLuck: 1 },
    message: "ACH Rain Chain! +1 luck",
  },

  {
    id: "aura_event_100m_500",
    category: "events",
    name: "Event Hunter",
    condition: {
      type: "aura_tier_count",
      tierId: "event_100m",
      target: 500,
    },
    reward: { flatLuck: 1.5 },
    message: "ACH Event Hunter! +1.5 luck",
  },
  {
    id: "aura_event_500m_1000",
    category: "events",
    name: "Event Legend",
    condition: {
      type: "aura_tier_count",
      tierId: "event_500m",
      target: 1000,
    },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH Event Legend! 1.05x final luck",
  },
  {
    id: "aura_dev_1",
    category: "events",
    name: "Developer Touch",
    condition: {
      type: "aura_tier_count",
      tierId: "dev-exclusive",
      target: 1,
    },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH Developer Touch! 1.05x final luck",
  },
  {
    id: "aura_dev_5",
    category: "events",
    name: "Developer Blessed",
    condition: {
      type: "aura_tier_count",
      tierId: "dev-exclusive",
      target: 5,
    },
    reward: { finalLuckMultiplier: 1.1, flatLuck: 2 },
    message: "ACH Developer Blessed! 1.1x final luck +2 luck",
  },

  {
    id: "aura_illusionary_1",
    category: "special",
    name: "Illusionary",
    condition: { type: "aura_count", auraId: "illusionary", target: 1 },
    reward: { flatLuck: 2, finalLuckMultiplier: 1.01 },
    message: "ACH Illusionary! +2 luck +1.01x final luck",
  },
];

export function createDefaultAchievementState(): AchievementState {
  const biomeCounts: Record<string, number> = {};
  for (const id of [...NORMAL_BIOMES, ...RARE_BIOMES, ...EVENT_BIOMES]) {
    biomeCounts[id] = 0;
  }

  const auraTierCounts: Record<string, number> = {};
  for (const id of AURA_TIER_IDS) {
    auraTierCounts[id] = 0;
  }

  return {
    unlocked: [],

    totalAuraRolls: 0,
    totalBiomeVisits: 0,

    biomeCounts,
    seenBiomes: [],

    auraTierCounts,
    auraCounts: {},

    rainyStreak: 0,
    maxRainyStreak: 0,

    lastBiomeTrackKey: null,
  };
}

export function normalizeAchievementState(
  input: Partial<AchievementState> | null | undefined
): AchievementState {
  const base = createDefaultAchievementState();

  if (!input) return base;

  return {
    unlocked: Array.isArray(input.unlocked) ? input.unlocked : [],

    totalAuraRolls: input.totalAuraRolls ?? 0,
    totalBiomeVisits: input.totalBiomeVisits ?? 0,

    biomeCounts: {
      ...base.biomeCounts,
      ...(input.biomeCounts ?? {}),
    },
    seenBiomes: Array.isArray(input.seenBiomes) ? input.seenBiomes : [],

    auraTierCounts: {
      ...base.auraTierCounts,
      ...(input.auraTierCounts ?? {}),
    },
    auraCounts: {
      ...(input.auraCounts ?? {}),
    },

    rainyStreak: input.rainyStreak ?? 0,
    maxRainyStreak: input.maxRainyStreak ?? 0,

    lastBiomeTrackKey: input.lastBiomeTrackKey ?? null,
  };
}

export function getAuraTierIds(aura: AuraDef): string[] {
  const tags = (aura.tags ?? []).map((tag) => tag.toLowerCase().trim());

  const ids: string[] = [];

  const isEventAura = !!aura.event;
  const isDevExclusive = tags.includes("dev-exclusive") || !!aura.devBiome;

  if (aura.id === "illusionary") {
    ids.push("illusionary");
  }

  if (isDevExclusive) {
    ids.push("dev-exclusive");
    return Array.from(new Set(ids));
  }

  if (isEventAura) {
    if (aura.rarity >= 100000000) ids.push("event_100m");
    if (aura.rarity >= 500000000) ids.push("event_500m");
    return Array.from(new Set(ids));
  }

  if (tags.includes("challenged+")) {
    ids.push("challenged+");
    return Array.from(new Set(ids));
  }

  if (tags.includes("challenged")) {
    ids.push("challenged");
    return Array.from(new Set(ids));
  }

  if (tags.includes("dimensional")) {
    ids.push("dimensional");
    return Array.from(new Set(ids));
  }

  const rarity = aura.rarity;

  if (rarity >= 1 && rarity <= 999) ids.push("basic");
  else if (rarity >= 1000 && rarity <= 9999) ids.push("epic");
  else if (rarity >= 10000 && rarity <= 99999) ids.push("unique");
  else if (rarity >= 100000 && rarity <= 999999) ids.push("legendary");
  else if (rarity >= 1000000 && rarity <= 9999999) ids.push("mythic");
  else if (rarity >= 10000000 && rarity <= 99999998) ids.push("exalted");
  else if (rarity >= 99999999 && rarity <= 999999999) ids.push("glorious");
  else if (rarity >= 1000000000 && rarity <= 7499999999) {
    ids.push("transcendent");
  } else if (rarity >= 7500000000) {
    ids.push("dimensional");
  }

  return Array.from(new Set(ids));
}

export function recordAuraRollInState(
  state: AchievementState,
  aura: AuraDef
): void {
  state.totalAuraRolls += 1;

  state.auraCounts[aura.id] = (state.auraCounts[aura.id] ?? 0) + 1;

  const tierIds = getAuraTierIds(aura);

  for (const tierId of tierIds) {
    state.auraTierCounts[tierId] =
      (state.auraTierCounts[tierId] ?? 0) + 1;
  }
}

export function recordBiomeVisitInState(
  state: AchievementState,
  biomeId: string,
  biomeExpiresAt?: number
): boolean {
  if (!biomeId || biomeId === "normal") return false;

  const trackKey = `${biomeId}:${biomeExpiresAt ?? 0}`;

  if (state.lastBiomeTrackKey === trackKey) {
    return false;
  }

  state.lastBiomeTrackKey = trackKey;
  state.totalBiomeVisits += 1;

  state.biomeCounts[biomeId] = (state.biomeCounts[biomeId] ?? 0) + 1;

  if (!state.seenBiomes.includes(biomeId)) {
    state.seenBiomes.push(biomeId);
  }

  if (biomeId === "rainy") {
    state.rainyStreak += 1;
  } else {
    state.rainyStreak = 0;
  }

  if (state.rainyStreak > state.maxRainyStreak) {
    state.maxRainyStreak = state.rainyStreak;
  }

  return true;
}

export function getAchievementProgress(
  state: AchievementState,
  achievement: AchievementDef
): number {
  const condition = achievement.condition;

  if (condition.type === "biome_count") {
    return state.biomeCounts[condition.biomeId] ?? 0;
  }

  if (condition.type === "rainy_streak") {
    return state.maxRainyStreak;
  }

  if (condition.type === "all_biomes") {
    return condition.biomeIds.filter((id) => state.seenBiomes.includes(id))
      .length;
  }

  if (condition.type === "aura_tier_count") {
    return state.auraTierCounts[condition.tierId] ?? 0;
  }

  if (condition.type === "aura_count") {
    return state.auraCounts[condition.auraId] ?? 0;
  }

  return 0;
}

export function getAchievementTarget(achievement: AchievementDef): number {
  return achievement.condition.target;
}

export function unlockAvailableAchievements(
  state: AchievementState
): AchievementDef[] {
  const unlockedNow: AchievementDef[] = [];
  const unlockedSet = new Set(state.unlocked);

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedSet.has(achievement.id)) continue;

    const progress = getAchievementProgress(state, achievement);
    const target = getAchievementTarget(achievement);

    if (progress >= target) {
      unlockedSet.add(achievement.id);
      state.unlocked.push(achievement.id);
      unlockedNow.push(achievement);
    }
  }

  return unlockedNow;
}

export function calculateAchievementBonuses(
  state: AchievementState
): AchievementBonuses {
  let flatLuck = 0;
  let finalLuckMultiplier = 1;
  let cooldownReductionSeconds = 0;
  let extraRolls = 0;

  const unlocked = new Set(state.unlocked);

  for (const achievement of ACHIEVEMENTS) {
    if (!unlocked.has(achievement.id)) continue;

    flatLuck += achievement.reward.flatLuck ?? 0;
    finalLuckMultiplier *= achievement.reward.finalLuckMultiplier ?? 1;
    cooldownReductionSeconds +=
      achievement.reward.cooldownReductionSeconds ?? 0;
    extraRolls += achievement.reward.extraRolls ?? 0;
  }

  return {
    flatLuck,
    finalLuckMultiplier,
    cooldownReductionSeconds,
    extraRolls,
  };
}

export function formatReward(reward: AchievementReward): string {
  const parts: string[] = [];

  if (reward.flatLuck) parts.push(`+${reward.flatLuck} luck`);
  if (reward.finalLuckMultiplier) {
    parts.push(`${reward.finalLuckMultiplier.toFixed(2)}x luck`);
  }
  if (reward.cooldownReductionSeconds) {
    parts.push(`CD -${reward.cooldownReductionSeconds}s`);
  }
  if (reward.extraRolls) parts.push(`+${reward.extraRolls} roll`);

  return parts.length ? parts.join(", ") : "none";
}

export function formatAchievementUnlocks(
  achievements: AchievementDef[]
): string {
  if (achievements.length === 0) return "";

  if (achievements.length === 1) {
    return achievements[0].message;
  }

  return `${achievements[0].message} (+${achievements.length - 1} more)`;
}

export function normalizeAchievementCategory(
  input: string
): AchievementCategoryId | null {
  const value = input.toLowerCase().trim();

  if (value === "tier" || value === "tiers" || value === "aura") {
    return "tiers";
  }

  if (value === "biome" || value === "biomes") {
    return "biomes";
  }

  if (value === "event" || value === "events" || value === "dev") {
    return "events";
  }

  if (value === "special" || value === "misc") {
    return "special";
  }

  return null;
}
