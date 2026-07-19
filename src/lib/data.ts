import aurasData from "../../data/auras.json";
import biomesData from "../../data/biomes.json";
import potionsData from "../../data/potions.json";
import eventsData from "../../data/events.json";
import devEventsData from "../../data/dev-events.json";
import devicesData from "../../data/devices.json";
import auraAnnouncementsData from "../../data/aura-announcements.json";
import type { AuraDef, BiomeDef, PotionDef } from "../types/data";
import {
  resolveAlias,
  type AliasCandidate,
  type AliasResolution,
} from "./fuzzy-alias";

export const auras: AuraDef[] = aurasData.auras as AuraDef[];
export const biomes: BiomeDef[] = biomesData.biomes as BiomeDef[];
export const potions: PotionDef[] = potionsData.potions as PotionDef[];
export const events = eventsData.events;
export const devEvents = devEventsData.devBiomes;
export const devices = devicesData.devices;

export const auraAnnouncements = auraAnnouncementsData.messages as Record<
  string,
  string
>;

export const TIME_CYCLE_SECONDS = biomesData.timeCycleSeconds as number;
export const STATUS_INTERVAL_SECONDS =
  biomesData.statusIntervalSeconds as number;
export const NORMAL_POOL_WEIGHTS = biomesData.normalPoolWeights as Array<{
  id: string;
  weight: number;
}>;
export const RANDOMIZER_POOL = biomesData.randomizerPool as string[];
export const DEV_LUCK_MULTIPLIER = devEventsData.luckMultiplier as number;
export const POTION_COOLDOWN_TIERS = potionsData.cooldownTiers as Array<{
  maxLuck: number | null;
  seconds: number;
}>;

export const biomeMap = new Map(biomes.map((b) => [b.id, b]));
export const auraMap = new Map(auras.map((a) => [a.id, a]));

function candidates<T>(
  items: readonly T[],
  fields: (item: T) => {
    id: string;
    label: string;
    aliases?: readonly string[];
  }
): AliasCandidate<T>[] {
  return items.map((item) => {
    const entry = fields(item);
    return {
      id: entry.id,
      label: entry.label,
      aliases: entry.aliases,
      value: item,
    };
  });
}

const BIOME_CANDIDATES = candidates(biomes, (biome) => ({
  id: biome.id,
  label: biome.name,
  aliases: [biome.id.replace(/_/g, " ")],
}));

const AURA_CANDIDATES = candidates(auras, (aura) => ({
  id: aura.id,
  label: aura.name,
  aliases: [
    aura.id.replace(/_/g, " "),
    aura.name.replace(/:/g, " "),
  ],
}));

const POTION_CANDIDATES = candidates(potions, (potion) => ({
  id: potion.id,
  label: potion.name,
  aliases: [potion.id.replace(/_/g, " "), ...(potion.aliases ?? [])],
}));

const EVENT_CANDIDATES = candidates(events, (event) => ({
  id: event.id,
  label: event.name,
  aliases: [event.id.replace(/_/g, " "), ...((event.aliases ?? []) as string[])],
}));

const DEV_CANDIDATES = candidates(devEvents, (dev) => ({
  id: dev.id,
  label: (dev as { name?: string }).name ?? dev.id.replace(/_/g, " "),
  aliases: [dev.id.replace(/_/g, " "), ...((dev.aliases ?? []) as string[])],
}));

const DEVICE_CANDIDATES = candidates(devices, (device) => ({
  id: device.id,
  label: device.name,
  aliases: [device.id.replace(/_/g, " "), ...((device.aliases ?? []) as string[])],
}));

export function resolveBiome(query: string): AliasResolution<BiomeDef> {
  return resolveAlias(query, BIOME_CANDIDATES, {
    maxScore: 0.3,
    ambiguityGap: 0.06,
  });
}

export function resolveAuraByQuery(query: string): AliasResolution<AuraDef> {
  return resolveAlias(query, AURA_CANDIDATES, {
    maxScore: 0.27,
    ambiguityGap: 0.075,
  });
}

export function resolvePotion(query: string): AliasResolution<PotionDef> {
  return resolveAlias(query, POTION_CANDIDATES, {
    maxScore: 0.29,
    ambiguityGap: 0.075,
  });
}

export function resolveEvent(
  query: string
): AliasResolution<(typeof events)[number]> {
  return resolveAlias(query, EVENT_CANDIDATES, {
    maxScore: 0.28,
    ambiguityGap: 0.075,
  });
}

export function resolveDevBiome(
  query: string
): AliasResolution<(typeof devEvents)[number]> {
  return resolveAlias(query, DEV_CANDIDATES, {
    maxScore: 0.29,
    ambiguityGap: 0.075,
  });
}

export function resolveDevice(
  query: string
): AliasResolution<(typeof devices)[number]> {
  return resolveAlias(query, DEVICE_CANDIDATES, {
    maxScore: 0.3,
    ambiguityGap: 0.075,
  });
}

// Backward-compatible find helpers. Ambiguous input intentionally returns
// undefined, preventing expensive or moderator actions from guessing.
export function findBiome(query: string): BiomeDef | undefined {
  const result = resolveBiome(query);
  return result.status === "matched" ? result.match.value : undefined;
}

export function findAuraByQuery(query: string): AuraDef | undefined {
  const result = resolveAuraByQuery(query);
  return result.status === "matched" ? result.match.value : undefined;
}

export function findPotion(query: string): PotionDef | undefined {
  const result = resolvePotion(query);
  return result.status === "matched" ? result.match.value : undefined;
}

export function findEvent(query: string): (typeof events)[number] | undefined {
  const result = resolveEvent(query);
  return result.status === "matched" ? result.match.value : undefined;
}

export function findDevBiome(
  query: string
): (typeof devEvents)[number] | undefined {
  const result = resolveDevBiome(query);
  return result.status === "matched" ? result.match.value : undefined;
}

export function findDevice(
  query: string
): (typeof devices)[number] | undefined {
  const result = resolveDevice(query);
  return result.status === "matched" ? result.match.value : undefined;
}
