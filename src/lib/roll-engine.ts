import type { AuraDef, ChannelState } from "../types/data";
import { auras, biomeMap } from "./data";
import { rollHit } from "./rng";

export interface RollContext {
  state: ChannelState;
  luck: number;
  potionId?: string;
  forceAuraId?: string;
  includeDeleted?: boolean;
  includeUnobtainable?: boolean;
}

function isDevActive(state: ChannelState): boolean {
  return !!state.activeDevBiome && state.devExpiresAt > Date.now();
}

function isEventActive(state: ChannelState, eventId: string): boolean {
  return state.activeEvents.includes(eventId);
}

function getActiveBiomeIds(state: ChannelState): Set<string> {
  const ids = new Set<string>();
  if (state.biomeId) ids.add(state.biomeId);
  if (state.bloodRainExpiresAt > Date.now()) ids.add("blood_rain");
  if (isDevActive(state)) ids.add(state.activeDevBiome!);
  return ids;
}

function isNativeBiomeActive(aura: AuraDef, state: ChannelState): boolean {
  const active = getActiveBiomeIds(state);
  if (aura.biome && active.has(aura.biome)) return true;
  if (aura.time && state.timeOfDay === aura.time) return true;
  if (aura.devBiome && active.has(aura.devBiome)) return true;
  return false;
}

function isGlitchedOrAbnormality(state: ChannelState): boolean {
  const active = getActiveBiomeIds(state);
  return active.has("glitched") || active.has("abnormality") || active.has("red_full_moon");
}

function getBiomeBTMultiplier(biomeId: string): number {
  const b = biomeMap.get(biomeId);
  return b?.breakthroughMultiplier ?? 1;
}

function getTimeBTMultiplier(state: ChannelState): number {
  if (state.timeOfDay === "daytime") return 10;
  if (state.timeOfDay === "nighttime") return 10;
  return 1;
}

export function getEffectiveRarity(aura: AuraDef, state: ChannelState): number | null {
  const active = getActiveBiomeIds(state);
  const glitchedMode = isGlitchedOrAbnormality(state);

  if (aura.deleted && !aura.unobtainable) return null;
  if (aura.unobtainable) return null;

  if (aura.potion) {
    if (!aura.potion.id) return null;
    return aura.potion.rarity;
  }

  if (aura.event && !isEventActive(state, aura.event)) return null;

  if (aura.biomeLock) {
    if (!isNativeBiomeActive(aura, state)) return null;
    if (aura.nativeRarity != null) return aura.nativeRarity;
    return aura.rarity;
  }

  if (aura.devBiome) {
    if (!active.has(aura.devBiome)) return null;
    return aura.rarity;
  }

  if (aura.biome && aura.nativeRarity != null && isNativeBiomeActive(aura, state)) {
    return aura.nativeRarity;
  }

  if (aura.noBreakthrough) {
    if (!isNativeBiomeActive(aura, state)) return null;
    return aura.nativeRarity ?? aura.rarity;
  }

  if (glitchedMode && aura.biome && biomeMap.get(aura.biome)?.isRareBiome) {
    return null;
  }

  if (glitchedMode && aura.nativeRarity != null && aura.biome) {
    return aura.nativeRarity;
  }

  if (isNativeBiomeActive(aura, state) && aura.nativeRarity != null) {
    return aura.nativeRarity;
  }

  if (aura.biome || aura.time) {
    return aura.rarity;
  }

  return aura.rarity;
}

export function getEligibleAuras(ctx: RollContext, potionExclusiveOnly = false): AuraDef[] {
  const { state, potionId, includeDeleted, includeUnobtainable } = ctx;

  return auras.filter((aura) => {
    if (aura.deleted && !includeDeleted) return false;
    if (aura.unobtainable && !includeUnobtainable) return false;

    if (potionId) {
      if (aura.potion?.id === potionId) return true;
      if (potionExclusiveOnly) return false;
      if (aura.potion) return false;
      const eff = getEffectiveRarity(aura, state);
      return eff !== null;
    }

    if (aura.potion) return false;

    const eff = getEffectiveRarity(aura, state);
    return eff !== null;
  });
}

export function rollOnce(ctx: RollContext): { aura: AuraDef; effectiveRarity: number } {
  if (ctx.forceAuraId) {
    const forced = auras.find((a) => a.id === ctx.forceAuraId);
    if (forced) {
      const eff = getEffectiveRarity(forced, ctx.state) ?? forced.rarity;
      return { aura: forced, effectiveRarity: eff };
    }
  }

  const luck = ctx.luck;

  if (ctx.potionId) {
    const exclusiveAuras = getEligibleAuras(ctx, true);
    const generalAuras = getEligibleAuras(ctx, false);
    const hits: Array<{ aura: AuraDef; effectiveRarity: number }> = [];

    for (const aura of exclusiveAuras) {
      const eff = aura.potion?.rarity ?? aura.rarity;
      const hit = rollHit(1, eff);
      if (hit) hits.push({ aura, effectiveRarity: eff });
    }

    for (const aura of generalAuras) {
      if (aura.potion) continue;
      const eff = getEffectiveRarity(aura, ctx.state);
      if (eff === null) continue;
      const immune = aura.luckImmune;
      const hit = immune ? rollHit(1, eff) : rollHit(luck, eff);
      if (hit) hits.push({ aura, effectiveRarity: eff });
    }

    if (hits.length > 0) {
      hits.sort((a, b) => b.effectiveRarity - a.effectiveRarity);
      return hits[0];
    }

    return { aura: auras.find((a) => a.id === "common")!, effectiveRarity: 2 };
  }

  const eligible = getEligibleAuras(ctx);
  const hits: Array<{ aura: AuraDef; effectiveRarity: number }> = [];

  for (const aura of eligible) {
    const eff = getEffectiveRarity(aura, ctx.state);
    if (eff === null) continue;
    const immune = aura.luckImmune;
    const hit = immune ? rollHit(1, eff) : rollHit(luck, eff);
    if (hit) hits.push({ aura, effectiveRarity: eff });
  }

  if (hits.length > 0) {
    hits.sort((a, b) => b.effectiveRarity - a.effectiveRarity);
    return hits[0];
  }

  const fallback =
    auras.find((a) => a.id === "common") ??
    auras.find((a) => a.id === "nothing")!;
  return { aura: fallback, effectiveRarity: fallback.rarity };
}

export function rollMultiple(
  ctx: RollContext,
  count: number
): Array<{ aura: AuraDef; effectiveRarity: number }> {
  return Array.from({ length: count }, () => rollOnce(ctx));
}

export function topRarest(
  results: Array<{ aura: AuraDef; effectiveRarity: number }>,
  n: number
): Array<{ aura: AuraDef; effectiveRarity: number }> {
  const sorted = [...results].sort((a, b) => b.effectiveRarity - a.effectiveRarity);
  return sorted.slice(0, n);
}
