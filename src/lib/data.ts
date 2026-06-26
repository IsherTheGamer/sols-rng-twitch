import aurasData from "../../data/auras.json";
import biomesData from "../../data/biomes.json";
import potionsData from "../../data/potions.json";
import eventsData from "../../data/events.json";
import devEventsData from "../../data/dev-events.json";
import devicesData from "../../data/devices.json";
import auraAnnouncementsData from "../../data/aura-announcements.json";
import type { AuraDef, BiomeDef, PotionDef } from "../types/data";

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

export function findBiome(id: string): BiomeDef | undefined {
  const norm = id.toLowerCase().replace(/\s+/g, "_");

  return (
    biomeMap.get(norm) ??
    biomes.find(
      (b) => b.id === norm || b.name.toLowerCase() === id.toLowerCase()
    )
  );
}

export function findAuraByQuery(query: string): AuraDef | undefined {
  const q = query.toLowerCase().trim();

  const asId = q
    .replace(/[:\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return auras.find(
    (a) =>
      a.id === asId ||
      a.id === q.replace(/\s+/g, "_") ||
      a.name.toLowerCase() === q ||
      a.name.toLowerCase().replace(/[^a-z0-9]/gi, "") ===
        q.replace(/[^a-z0-9]/gi, "")
  );
}

export function findPotion(query: string): PotionDef | undefined {
  const q = query.toLowerCase().trim();

  return potions.find(
    (p) =>
      p.id === q ||
      p.aliases.some((a) => a === q) ||
      p.name.toLowerCase() === q
  );
}

export function findEvent(query: string): typeof events[0] | undefined {
  const q = query.toLowerCase().trim();

  return events.find(
    (e) =>
      e.id === q ||
      e.aliases.some((a) => a === q) ||
      e.name.toLowerCase() === q
  );
}

export function findDevBiome(query: string): typeof devEvents[0] | undefined {
  const q = query.toLowerCase().trim();

  return devEvents.find(
    (d) => d.id === q || d.aliases.some((a) => a === q)
  );
}

export function findDevice(query: string): typeof devices[0] | undefined {
  const q = query.toLowerCase().trim();

  return devices.find(
    (d) =>
      d.id === q ||
      d.aliases.some((a) => a === q) ||
      d.name.toLowerCase() === q
  );
}
