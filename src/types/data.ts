export interface AuraDef {
  id: string;
  name: string;
  rarity: number;
  nativeRarity?: number | null;
  biome?: string | null;
  biomeLock?: boolean;
  noBreakthrough?: boolean;
  potion?: { id: string; rarity: number } | null;
  devBiome?: string | null;
  luckImmune?: boolean;
  event?: string | null;
  unobtainable?: boolean;
  deleted?: boolean;
  tags?: string[];
  time?: "daytime" | "nighttime" | null;
}

export interface BiomeDef {
  id: string;
  name: string;
  pool: string;
  spawnPerSecond?: number | null;
  spawnOnChange?: number | null;
  deviceChance?: number;
  durationSeconds?: number | null;
  durationUntilNightEnd?: boolean;
  durationUntilNight?: boolean;
  nightChance?: number;
  dayChance?: number;
  breakthroughMultiplier: number;
  chatSpawn?: string | null;
  chatEnd?: string | null;
  blocksDevices?: boolean;
  nativeRarityOverride?: boolean;
  isRareBiome?: boolean;
  excludesRareBiomeAuras?: boolean;
  requiresNormalBiome?: boolean;
  deviceOnly?: boolean;
  replacesStarfall?: boolean;
  singularityChanceOnSpawn?: number;
  overridesExcept?: string[];
  replacesNormal?: boolean;
  requiresSnowy?: boolean;
  manualOnly?: boolean;
  devOnly?: boolean;
}

export interface PotionDef {
  id: string;
  name: string;
  aliases: string[];
  luck: number;
  clearsBuffs?: boolean;
  requiresEvent?: string;
  exclusiveAuras?: Array<{ auraId: string; rarity: number }>;
}

export interface ChannelState {
  channelId: string;
  channelName: string;
  biomeId: string;
  biomeExpiresAt: number;
  timeOfDay: "daytime" | "nighttime";
  timeExpiresAt: number;
  activeEvents: string[];
  activeDevBiome: string | null;
  devExpiresAt: number;
  bloodRainExpiresAt: number;
  lastStatusAt: number;
  lastTickAt: number;
  deviceServerCooldownUntil: number;
  strangeControllerCooldownUntil: number;
  biomeRandomizerCooldownUntil: number;
}

export interface RollResult {
  aura: AuraDef;
  effectiveRarity: number;
  luck: number;
}
