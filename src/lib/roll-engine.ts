import type { AuraDef, ChannelState } from "../types/data";
import { auras, auraMap, biomeMap, potions } from "./data";
import { rollHit } from "./rng";

export interface RollContext {
  state: ChannelState;
  luck: number;
  potionId?: string;
  forceAuraId?: string;
  includeDeleted?: boolean;
  includeUnobtainable?: boolean;
}

interface PotionExclusiveRoll {
  aura: AuraDef;
  effectiveRarity: number;
}

const POTION_AURA_ID_ALIASES: Record<string, string> = {
  dune_exclusive: "neferkhaf",
};

function normalizePotionAuraId(auraId: string): string {
  return POTION_AURA_ID_ALIASES[auraId] ?? auraId;
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

  return (
    active.has("glitched") ||
    active.has("abnormality") ||
    active.has("red_full_moon")
  );
}

function buildPotionExclusiveAuraIds(): Set<string> {
  const ids = new Set<string>();

  for (const potion of potions) {
    for (const exclusive of potion.exclusiveAuras ?? []) {
      ids.add(exclusive.auraId);
      ids.add(normalizePotionAuraId(exclusive.auraId));
    }
  }

  for (const aura of auras) {
    if (aura.potion?.id) {
      ids.add(aura.id);
    }
  }

  return ids;
}

const POTION_EXCLUSIVE_AURA_IDS = buildPotionExclusiveAuraIds();

function isPotionExclusiveAura(aura: AuraDef): boolean {
  return !!aura.potion?.id || POTION_EXCLUSIVE_AURA_IDS.has(aura.id);
}

function getPotionExclusivePool(potionId: string): PotionExclusiveRoll[] {
  const potion = potions.find((p) => p.id === potionId);
  const pool: PotionExclusiveRoll[] = [];
  const seen = new Set<string>();

  function addExclusive(auraId: string, rarity: number) {
    const normalizedId = normalizePotionAuraId(auraId);
    const aura = auraMap.get(normalizedId);

    if (!aura) return;
    if (seen.has(aura.id)) return;

    seen.add(aura.id);

    pool.push({
      aura,
      effectiveRarity: rarity,
    });
  }

  for (const exclusive of potion?.exclusiveAuras ?? []) {
    addExclusive(exclusive.auraId, exclusive.rarity);
  }

  for (const aura of auras) {
    if (aura.potion?.id !== potionId) continue;

    addExclusive(aura.id, aura.potion.rarity);
  }

  return pool;
}

function isAllowedByBaseFlags(
  aura: AuraDef,
  ctx: RollContext
): boolean {
  if (aura.deleted && !ctx.includeDeleted) return false;
  if (aura.unobtainable && !ctx.includeUnobtainable) return false;

  return true;
}

export function getEffectiveRarity(
  aura: AuraDef,
  state: ChannelState
): number | null {
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

  if (
    aura.biome &&
    aura.nativeRarity != null &&
    isNativeBiomeActive(aura, state)
  ) {
    return aura.nativeRarity;
  }

  if (aura.noBreakthrough) {
    if (!isNativeBiomeActive(aura, state)) return null;
    return aura.nativeRarity ?? aura.rarity;
  }

  if (
    glitchedMode &&
    aura.biome &&
    biomeMap.get(aura.biome)?.isRareBiome
  ) {
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

export function getEligibleAuras(
  ctx: RollContext,
  potionExclusiveOnly = false
): AuraDef[] {
  const { state, potionId } = ctx;

  return auras.filter((aura) => {
    const isExclusive = isPotionExclusiveAura(aura);

    if (potionId) {
      if (potionExclusiveOnly) {
        return getPotionExclusivePool(potionId).some(
          (entry) => entry.aura.id === aura.id
        );
      }

      if (isExclusive) return false;
      if (!isAllowedByBaseFlags(aura, ctx)) return false;

      const eff = getEffectiveRarity(aura, state);
      return eff !== null;
    }

    if (isExclusive) return false;
    if (!isAllowedByBaseFlags(aura, ctx)) return false;

    const eff = getEffectiveRarity(aura, state);
    return eff !== null;
  });
}

export function rollOnce(
  ctx: RollContext
): { aura: AuraDef; effectiveRarity: number } {
  if (ctx.forceAuraId) {
    const forced = auras.find((a) => a.id === ctx.forceAuraId);

    if (forced) {
      const eff = getEffectiveRarity(forced, ctx.state) ?? forced.rarity;
      return { aura: forced, effectiveRarity: eff };
    }
  }

  const luck = ctx.luck;

  if (ctx.potionId) {
    const exclusivePool = getPotionExclusivePool(ctx.potionId);
    const generalAuras = getEligibleAuras(ctx, false);

    const hits: Array<{ aura: AuraDef; effectiveRarity: number }> = [];

    for (const entry of exclusivePool) {
      const hit = rollHit(1, entry.effectiveRarity);

      if (hit) {
        hits.push({
          aura: entry.aura,
          effectiveRarity: entry.effectiveRarity,
        });
      }
    }

    for (const aura of generalAuras) {
      const eff = getEffectiveRarity(aura, ctx.state);

      if (eff === null) continue;

      const immune = aura.luckImmune;
      const hit = immune ? rollHit(1, eff) : rollHit(luck, eff);

      if (hit) {
        hits.push({
          aura,
          effectiveRarity: eff,
        });
      }
    }

    if (hits.length > 0) {
      hits.sort((a, b) => b.effectiveRarity - a.effectiveRarity);
      return hits[0];
    }

    const fallback =
      auras.find((a) => a.id === "common") ??
      auras.find((a) => a.id === "nothing")!;

    return {
      aura: fallback,
      effectiveRarity: fallback.rarity,
    };
  }

  const eligible = getEligibleAuras(ctx);
  const hits: Array<{ aura: AuraDef; effectiveRarity: number }> = [];

  for (const aura of eligible) {
    const eff = getEffectiveRarity(aura, ctx.state);

    if (eff === null) continue;

    const immune = aura.luckImmune;
    const hit = immune ? rollHit(1, eff) : rollHit(luck, eff);

    if (hit) {
      hits.push({
        aura,
        effectiveRarity: eff,
      });
    }
  }

  if (hits.length > 0) {
    hits.sort((a, b) => b.effectiveRarity - a.effectiveRarity);
    return hits[0];
  }

  const fallback =
    auras.find((a) => a.id === "common") ??
    auras.find((a) => a.id === "nothing")!;

  return {
    aura: fallback,
    effectiveRarity: fallback.rarity,
  };
}

export function rollMultiple(
  ctx: RollContext,
  count: number
): Array<{ aura: AuraDef; effectiveRarity: number }> {
  const safeCount = Math.max(0, Math.floor(count));

  return Array.from({ length: safeCount }, () => rollOnce(ctx));
}

export function topRarest(
  results: Array<{ aura: AuraDef; effectiveRarity: number }>,
  n: number
): Array<{ aura: AuraDef; effectiveRarity: number }> {
  const sorted = [...results].sort(
    (a, b) => b.effectiveRarity - a.effectiveRarity
  );

  return sorted.slice(0, n);
}
