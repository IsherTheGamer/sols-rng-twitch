import type { AuraDef } from "../types/data";

export type AchievementCondition =
  | {
      type: "biome_count";
      biomeId: string;
      count: number;
    }
  | {
      type: "rainy_streak";
      count: number;
    }
  | {
      type: "all_biomes";
      biomeIds: string[];
    }
  | {
      type: "aura_tier_count";
      tierId: string;
      count: number;
    }
  | {
      type: "aura_count";
      auraId: string;
      count: number;
    };

export interface AchievementReward {
  flatLuck?: number;
  finalLuckMultiplier?: number;
  cooldownReductionSeconds?: number;
  extraRolls?: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  condition: AchievementCondition;
  reward: AchievementReward;
  message: string;
}

export interface GlobalAchievementState {
  unlocked: string[];
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

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "biome_glitched_1",
    name: "Code 404",
    condition: { type: "biome_count", biomeId: "glitched", count: 1 },
    reward: { extraRolls: 1 },
    message: "ACH Code 404! +1 bonus roll",
  },
  {
    id: "biome_dreamspace_1",
    name: "Lucid Dreamer",
    condition: { type: "biome_count", biomeId: "dreamspace", count: 1 },
    reward: { cooldownReductionSeconds: 1 },
    message: "ACH Lucid Dreamer! -1s roll cooldown",
  },
  {
    id: "biome_cyberspace_1",
    name: "Signal Received",
    condition: { type: "biome_count", biomeId: "cyberspace", count: 1 },
    reward: { finalLuckMultiplier: 1.01 },
    message: "ACH Signal Received! 1.01x final luck",
  },
  {
    id: "biome_singularity_1",
    name: "Gravity Collapse",
    condition: { type: "biome_count", biomeId: "singularity", count: 1 },
    reward: { finalLuckMultiplier: 1.01 },
    message: "ACH Gravity Collapse! 1.01x final luck",
  },
  {
    id: "biome_null_1",
    name: "Into The Null",
    condition: { type: "biome_count", biomeId: "null", count: 1 },
    reward: { flatLuck: 0.5 },
    message: "ACH Into The Null! +0.5 luck",
  },
  {
    id: "biome_null_10",
    name: "Null Dweller",
    condition: { type: "biome_count", biomeId: "null", count: 10 },
    reward: { flatLuck: 2 },
    message: "ACH Null Dweller! +2 luck",
  },
  {
    id: "biome_all_non_event_dev",
    name: "World Explorer",
    condition: {
      type: "all_biomes",
      biomeIds: NON_EVENT_DEV_BIOMES,
    },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH World Explorer! 1.05x final luck",
  },
  {
    id: "biome_rainy_streak_5",
    name: "Rain Chain",
    condition: { type: "rainy_streak", count: 5 },
    reward: { flatLuck: 1 },
    message: "ACH Rain Chain! +1 luck",
  },

  {
    id: "aura_basic_1000",
    name: "Basic Collector",
    condition: { type: "aura_tier_count", tierId: "basic", count: 1000 },
    reward: { flatLuck: 0.5 },
    message: "ACH Basic Collector! +0.5 luck",
  },
  {
    id: "aura_epic_1000",
    name: "Epic Collector",
    condition: { type: "aura_tier_count", tierId: "epic", count: 1000 },
    reward: { flatLuck: 0.5 },
    message: "ACH Epic Collector! +0.5 luck",
  },
  {
    id: "aura_unique_1000",
    name: "Unique Collector",
    condition: { type: "aura_tier_count", tierId: "unique", count: 1000 },
    reward: { flatLuck: 1 },
    message: "ACH Unique Collector! +1 luck",
  },
  {
    id: "aura_legendary_1000",
    name: "Legendary Collector",
    condition: { type: "aura_tier_count", tierId: "legendary", count: 1000 },
    reward: { flatLuck: 1.2 },
    message: "ACH Legendary Collector! +1.2 luck",
  },
  {
    id: "aura_mythic_1000",
    name: "Mythic Collector",
    condition: { type: "aura_tier_count", tierId: "mythic", count: 1000 },
    reward: { flatLuck: 1.6 },
    message: "ACH Mythic Collector! +1.6 luck",
  },
  {
    id: "aura_exalted_1000",
    name: "Exalted Collector",
    condition: { type: "aura_tier_count", tierId: "exalted", count: 1000 },
    reward: { flatLuck: 2 },
    message: "ACH Exalted Collector! +2 luck",
  },
  {
    id: "aura_glorious_500",
    name: "Glorious Collector",
    condition: { type: "aura_tier_count", tierId: "glorious", count: 500 },
    reward: { finalLuckMultiplier: 1.01 },
    message: "ACH Glorious Collector! 1.01x final luck",
  },
  {
    id: "aura_transcendent_250",
    name: "Transcendent Collector",
    condition: { type: "aura_tier_count", tierId: "transcendent", count: 250 },
    reward: { finalLuckMultiplier: 1.03 },
    message: "ACH Transcendent Collector! 1.03x final luck",
  },
  {
    id: "aura_dimensional_20",
    name: "Dimensional Breaker",
    condition: { type: "aura_tier_count", tierId: "dimensional", count: 20 },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH Dimensional Breaker! 1.05x final luck",
  },
  {
    id: "aura_challenged_350",
    name: "Challenge Accepted",
    condition: { type: "aura_tier_count", tierId: "challenged", count: 350 },
    reward: { finalLuckMultiplier: 1.02 },
    message: "ACH Challenge Accepted! 1.02x final luck",
  },
  {
    id: "aura_challenged_plus_50",
    name: "Challenge Master",
    condition: { type: "aura_tier_count", tierId: "challenged+", count: 50 },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH Challenge Master! 1.05x final luck",
  },
  {
    id: "aura_event_100m_500",
    name: "Event Hunter",
    condition: { type: "aura_tier_count", tierId: "event_100m", count: 500 },
    reward: { flatLuck: 1.5 },
    message: "ACH Event Hunter! +1.5 luck",
  },
  {
    id: "aura_event_500m_1000",
    name: "Event Legend",
    condition: { type: "aura_tier_count", tierId: "event_500m", count: 1000 },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH Event Legend! 1.05x final luck",
  },
  {
    id: "aura_dev_1",
    name: "Developer Touch",
    condition: { type: "aura_tier_count", tierId: "dev-exclusive", count: 1 },
    reward: { finalLuckMultiplier: 1.05 },
    message: "ACH Developer Touch! 1.05x final luck",
  },
  {
    id: "aura_dev_5",
    name: "Developer Blessed",
    condition: { type: "aura_tier_count", tierId: "dev-exclusive", count: 5 },
    reward: { finalLuckMultiplier: 1.1, flatLuck: 2 },
    message: "ACH Developer Blessed! 1.1x final luck +2 luck",
  },
  {
    id: "aura_illusionary_1",
    name: "Illusionary",
    condition: { type: "aura_count", auraId: "illusionary", count: 1 },
    reward: { flatLuck: 2, finalLuckMultiplier: 1.01 },
    message: "ACH Illusionary! +2 luck +1.01x final luck",
  },
];

export function createDefaultAchievementState(): GlobalAchievementState {
  const auraTierCounts: Record<string, number> = {};
  for (const id of AURA_TIER_IDS) auraTierCounts[id] = 0;

  const biomeCounts: Record<string, number> = {};
  for (const id of [...NORMAL_BIOMES, ...RARE_BIOMES, ...EVENT_BIOMES]) {
    biomeCounts[id] = 0;
  }

  return {
    unlocked: [],
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
  input: Partial<GlobalAchievementState> | null | undefined
): GlobalAchievementState {
  const base = createDefaultAchievementState();

  if (!input) return base;

  return {
    unlocked: Array.isArray(input.unlocked) ? input.unlocked : [],
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
  const isDevExclusive =
    tags.includes("dev-exclusive") || aura.devBiome != null;

  if (!isEventAura && !isDevExclusive) {
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
  }

  if (tags.includes("dimensional")) ids.push("dimensional");
  if (tags.includes("challenged")) ids.push("challenged");
  if (tags.includes("challenged+")) ids.push("challenged+");

  if (isEventAura && aura.rarity >= 100000000) ids.push("event_100m");
  if (isEventAura && aura.rarity >= 500000000) ids.push("event_500m");

  if (isDevExclusive) ids.push("dev-exclusive");

  if (aura.id === "illusionary") ids.push("illusionary");

  return Array.from(new Set(ids));
}

export function applyAuraRollToAchievements(
  state: GlobalAchievementState,
  aura: AuraDef
): void {
  state.auraCounts[aura.id] = (state.auraCounts[aura.id] ?? 0) + 1;

  const tierIds = getAuraTierIds(aura);
  for (const tierId of tierIds) {
    state.auraTierCounts[tierId] =
      (state.auraTierCounts[tierId] ?? 0) + 1;
  }
}

export function applyBiomeVisitToAchievements(
  state: GlobalAchievementState,
  biomeId: string,
  biomeExpiresAt?: number
): boolean {
  if (!biomeId || biomeId === "normal") return false;

  const trackKey = `${biomeId}:${biomeExpiresAt ?? 0}`;

  if (state.lastBiomeTrackKey === trackKey) {
    return false;
  }

  state.lastBiomeTrackKey = trackKey;
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

function isConditionMet(
  state: GlobalAchievementState,
  condition: AchievementCondition
): boolean {
  if (condition.type === "biome_count") {
    return (state.biomeCounts[condition.biomeId] ?? 0) >= condition.count;
  }

  if (condition.type === "rainy_streak") {
    return state.maxRainyStreak >= condition.count;
  }

  if (condition.type === "all_biomes") {
    return condition.biomeIds.every((id) => state.seenBiomes.includes(id));
  }

  if (condition.type === "aura_tier_count") {
    return (state.auraTierCounts[condition.tierId] ?? 0) >= condition.count;
  }

  if (condition.type === "aura_count") {
    return (state.auraCounts[condition.auraId] ?? 0) >= condition.count;
  }

  return false;
}

export function unlockAvailableAchievements(
  state: GlobalAchievementState
): AchievementDef[] {
  const unlockedNow: AchievementDef[] = [];
  const unlockedSet = new Set(state.unlocked);

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedSet.has(achievement.id)) continue;

    if (isConditionMet(state, achievement.condition)) {
      unlockedSet.add(achievement.id);
      state.unlocked.push(achievement.id);
      unlockedNow.push(achievement);
    }
  }

  return unlockedNow;
}

export function calculateAchievementBonuses(
  state: GlobalAchievementState
): AchievementBonuses {
  let flatLuck = 0;
  let finalLuckMultiplier = 1;
  let cooldownReductionSeconds = 0;
  let extraRolls = 0;

  const unlockedSet = new Set(state.unlocked);

  for (const achievement of ACHIEVEMENTS) {
    if (!unlockedSet.has(achievement.id)) continue;

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

export function formatAchievementUnlocks(
  achievements: AchievementDef[]
): string {
  if (achievements.length === 0) return "";

  if (achievements.length === 1) {
    return achievements[0].message;
  }

  return `${achievements[0].message} (+${achievements.length - 1} more)`;
}

export function getAchievementProgressLine(
  state: GlobalAchievementState
): string {
  const unlocked = state.unlocked.length;
  const total = ACHIEVEMENTS.length;

  const basic = state.auraTierCounts.basic ?? 0;
  const epic = state.auraTierCounts.epic ?? 0;
  const mythic = state.auraTierCounts.mythic ?? 0;

  return `ACH ${unlocked}/${total} | Basic ${basic}/1000 | Epic ${epic}/1000 | Mythic ${mythic}/1000`;
}
