import { Redis } from "@upstash/redis";
import type { NightbotUser } from "./nightbot";
import {
  BLUEPRINT_ACTIONS,
  BOSS_ACTIONS,
  RELIC_ACTIONS,
  RESEARCH_ACTIONS,
  resolveTextAlias,
} from "./command-aliases";
import {
  aliasSuggestionText,
  normalizeAlias,
  resolveAlias,
  type AliasCandidate,
} from "./fuzzy-alias";

interface StoredRelic {
  id?: string;
  name?: string;
}

interface StoredActivityPlayer {
  relics?: StoredRelic[];
}

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function titleCase(value: string): string {
  return value
    .split(/[_\-\s:]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function candidate(id: string, name: string, aliases: string[] = []): AliasCandidate<string> {
  return { id, label: name, aliases, value: id };
}

const RESEARCH_NODES: AliasCandidate<string>[] = [
  candidate("archive_memory_1", "Archive Memory I", ["archive memory 1"]),
  candidate("archive_memory_2", "Archive Memory II", ["archive memory 2"]),
  candidate("craft_efficiency_1", "Workshop Logistics I", ["craft efficiency 1", "workshop logistics 1"]),
  candidate("craft_efficiency_2", "Workshop Logistics II", ["craft efficiency 2", "workshop logistics 2"]),
  candidate("core_mapping_1", "Core Mapping I", ["core mapping 1"]),
  candidate("core_mapping_2", "Core Mapping II", ["core mapping 2"]),
  ...Array.from({ length: 6 }, (_, index) => {
    const level = index + 1;
    return candidate(`boss_damage_${level}`, `Hunter Training ${level}`, [
      `boss damage ${level}`,
      `hunter training ${level}`,
    ]);
  }),
  candidate("relic_slot_2", "Relic Slot II", ["relic slot 2", "second relic slot"]),
  candidate("relic_slot_3", "Relic Slot III", ["relic slot 3", "third relic slot"]),
  candidate("relic_attune_1", "Relic Attunement I", ["relic attune 1", "relic attunement 1"]),
  candidate("relic_attune_2", "Relic Attunement II", ["relic attune 2", "relic attunement 2"]),
  candidate("relic_reforger", "Relic Reforger", ["relic reforge", "reforger"]),
  ...Array.from({ length: 10 }, (_, index) => {
    const level = index + 1;
    return candidate(`scanner_${level}`, `Scanner ${level}`, [`scanner level ${level}`]);
  }),
  candidate("market_contacts_1", "Market Contacts I", ["market contacts 1"]),
  candidate("market_contacts_2", "Market Contacts II", ["market contacts 2"]),
  candidate("market_haggle_1", "Market Haggle I", ["market haggle 1", "haggle"]),
  candidate("blueprint_reading", "Blueprint Reading", ["blueprint reader"]),
  candidate("blueprint_assembly", "Blueprint Assembly", ["assemble blueprints"]),
  candidate("wall_breaker_1", "Wall Breaker I", ["wall breaker 1"]),
  candidate("forecast_1", "Forecast I", ["forecast 1"]),
  candidate("forecast_2", "Forecast II", ["forecast 2"]),
  candidate("forecast_3", "Forecast III", ["forecast 3"]),
];

const BLUEPRINTS: AliasCandidate<string>[] = [
  candidate("biome_lens", "Biome Lens Blueprint", ["biome lens", "lens blueprint"]),
  candidate("relic_forge", "Relic Forge Blueprint", ["relic forge", "forge blueprint"]),
  candidate("quantum_press", "Quantum Press Blueprint", ["quantum press"]),
  candidate("boss_beacon", "Boss Beacon Blueprint", ["boss beacon", "boss becon", "beacon"]),
  candidate("archive_terminal", "Archive Terminal Blueprint", ["archive terminal"]),
  candidate("forbidden_frame", "Forbidden Frame Blueprint", ["forbidden frame"]),
];

function resolveNode(raw: string): { value?: string; error?: string } {
  return resolveTextAlias(raw, RESEARCH_NODES, "research node", { strict: true });
}

function resolveBlueprint(raw: string): { value?: string; error?: string } {
  return resolveTextAlias(raw, BLUEPRINTS, "blueprint", { strict: true });
}

export function resolveResearchInput(raw: string): { query?: string; error?: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { query: "" };

  const actionResult = resolveTextAlias(parts[0], RESEARCH_ACTIONS, "research action");

  if (actionResult.value) {
    const action = actionResult.value;
    const target = parts.slice(1).join(" ");

    if (action === "unlock" || action === "info") {
      if (!target) return { query: action };
      const node = resolveNode(target);
      if (!node.value) return { error: node.error };
      return { query: `${action} ${node.value}` };
    }

    return { query: [action, target].filter(Boolean).join(" ") };
  }

  // The command also supports direct node lookup without "info".
  const direct = resolveNode(raw);
  if (direct.value) return { query: direct.value };

  return { error: actionResult.error ?? direct.error };
}

export function resolveBlueprintInput(raw: string): { query?: string; error?: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { query: "" };

  const actionResult = resolveTextAlias(parts[0], BLUEPRINT_ACTIONS, "blueprint action");

  if (actionResult.value) {
    const action = actionResult.value;
    const target = parts.slice(1).join(" ");

    if (action === "assemble" || action === "info") {
      if (!target) return { query: action };
      const blueprint = resolveBlueprint(target);
      if (!blueprint.value) return { error: blueprint.error };
      return { query: `${action} ${blueprint.value}` };
    }

    return { query: [action, target].filter(Boolean).join(" ") };
  }

  const direct = resolveBlueprint(raw);
  if (direct.value) return { query: direct.value };

  return { error: actionResult.error ?? direct.error };
}

export function resolveBossInput(raw: string): { action?: string; error?: string } {
  if (!raw.trim()) return { action: "status" };
  return resolveTextAlias(raw.trim().split(/\s+/)[0], BOSS_ACTIONS, "boss action");
}

async function resolveStoredRelic(
  channelId: string,
  user: NightbotUser | null,
  raw: string
): Promise<{ value?: string; error?: string }> {
  const clean = raw.trim();
  if (!clean) return { error: "Relic target is missing." };
  if (/^\d+$/.test(clean)) return { value: clean };
  if (normalizeAlias(clean) === "all") return { value: "all" };
  if (!user) return { error: "Relic aliases only work from Twitch chat." };

  const r = getRedis();
  if (!r) return { value: clean };

  const state = await r.get<StoredActivityPlayer>(
    `aok:player:${channelId}:${user.providerId}`
  );
  const relics = state?.relics ?? [];

  if (relics.length === 0) return { error: "Relic not found; your relic storage is empty." };

  const candidates: AliasCandidate<string>[] = relics.map((relic, index) => {
    const number = String(index + 1);
    const id = String(relic.id ?? `relic_${number}`);
    const name = String(relic.name ?? `Relic ${number}`);
    return {
      id,
      label: `#${number} ${name}`,
      aliases: [name, id, number, `relic ${number}`],
      value: number,
    };
  });

  const result = resolveAlias(clean, candidates, {
    maxScore: 0.27,
    ambiguityGap: 0.08,
  });

  if (result.status === "matched") return { value: result.match.value };
  return { error: aliasSuggestionText(result, "relic") };
}

export async function resolveRelicInput(
  channelId: string,
  user: NightbotUser | null,
  raw: string
): Promise<{ query?: string; error?: string }> {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { query: "" };

  const actionResult = resolveTextAlias(parts[0], RELIC_ACTIONS, "relic action");

  if (!actionResult.value) {
    const target = await resolveStoredRelic(channelId, user, raw);
    return target.value
      ? { query: `info ${target.value}` }
      : { error: actionResult.error ?? target.error };
  }

  const action = actionResult.value;
  if (["guide", "forge"].includes(action)) return { query: action };
  if (action === "list") {
    const page = parts[1] && /^\d+$/.test(parts[1]) ? parts[1] : "";
    return { query: [action, page].filter(Boolean).join(" ") };
  }

  const target = await resolveStoredRelic(channelId, user, parts.slice(1).join(" "));
  if (!target.value) return { error: target.error };
  return { query: `${action} ${target.value}` };
}

export function researchNodeLabels(): string[] {
  return RESEARCH_NODES.map((node) => node.label);
}

export function blueprintLabels(): string[] {
  return BLUEPRINTS.map((blueprint) => blueprint.label);
}

export function prettyAliasId(id: string): string {
  return titleCase(id);
}
