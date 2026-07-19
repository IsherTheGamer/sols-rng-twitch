import { Redis } from "@upstash/redis";
import type { NightbotUser } from "./nightbot";
import { getCoreState, saveCoreState } from "./core-system";
import { findEvent, events } from "./data";
import { getChannelState, setChannelState } from "./state";
import { truncate } from "./format";
import {
  aliasSuggestionText,
  normalizeAlias,
  resolveAlias,
  type AliasCandidate,
} from "./fuzzy-alias";
import { initialism } from "./abbreviations";

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function clean(value: string | undefined | null): string {
  return String(value ?? "").trim();
}
function norm(value: string | undefined | null): string {
  return normalizeAlias(value).replace(/\s+/g, "_");
}
function fmt(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}
function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
function displayName(user: NightbotUser | null): string {
  return user?.displayName ?? user?.name ?? "Moderator";
}
function userId(user: NightbotUser | null): string {
  return user?.providerId ?? "anon";
}
function parseAmount(raw: string | undefined, fallback = 1): number {
  const match = clean(raw).toLowerCase().replace(/,/g, "").match(/^(\d+)(k|m)?$/);
  if (!match) return fallback;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return fallback;
  return match[2] === "k" ? base * 1000 : match[2] === "m" ? base * 1000000 : base;
}
function timeLeft(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
function hashSeed(raw: string): number {
  let hash = 2166136261;
  for (const char of raw) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function seededRandom(seed: number): () => number {
  let value = seed || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRST DISCOVERIES — permanent maps remain hidden; only newest 15 are shown.
// ─────────────────────────────────────────────────────────────────────────────
interface ReplayPull {
  id: string;
  userId: string;
  userName: string;
  auraId: string;
  auraName: string;
  rarity: number;
  channelName: string;
  source: "roll" | "potion" | "token";
  createdAt: number;
}
interface FirstBiome {
  biomeId: string;
  biomeName: string;
  channelName: string;
  createdAt: number;
}
interface FirstState {
  auras: Record<string, ReplayPull>;
  biomes: Record<string, FirstBiome>;
}
interface FirstRow {
  kind: "aura" | "biome";
  name: string;
  userName?: string;
  channelName: string;
  createdAt: number;
}
function firstsKey(channelId: string): string {
  return `mega:firsts:${channelId}`;
}
function montrealDate(timestamp: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montreal",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function parseDateQuery(raw: string): string | null {
  const value = clean(raw).replace(/\//g, "-");
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const short = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (short) return `${short[3]}-${short[1].padStart(2, "0")}-${short[2].padStart(2, "0")}`;
  return null;
}
export async function formatFirstsV2(channelId: string, query: string): Promise<string> {
  const r = getRedis();
  if (!r) return "Firsts database is not connected.";
  const state = (await r.get<FirstState>(firstsKey(channelId))) ?? { auras: {}, biomes: {} };
  const rows: FirstRow[] = [
    ...Object.values(state.auras).map((pull) => ({
      kind: "aura" as const,
      name: pull.auraName,
      userName: pull.userName,
      channelName: pull.channelName,
      createdAt: pull.createdAt,
    })),
    ...Object.values(state.biomes).map((biome) => ({
      kind: "biome" as const,
      name: biome.biomeName,
      channelName: biome.channelName,
      createdAt: biome.createdAt,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const parts = clean(query).split(/\s+/).filter(Boolean);
  let pageIndex = -1;
  for (let index = parts.length - 1; index >= 0; index--) {
    if (/^\d+$/.test(parts[index])) { pageIndex = index; break; }
  }
  const requestedPage = pageIndex >= 0 ? Number(parts[pageIndex]) : 1;
  if (pageIndex >= 0) parts.splice(pageIndex, 1);
  const rawFilter = parts.join(" ");
  const normalized = normalizeAlias(rawFilter || "latest");

  let filtered = rows;
  let label = "Latest";
  if (["aura", "auras"].includes(normalized)) {
    filtered = rows.filter((row) => row.kind === "aura");
    label = "Aura Firsts";
  } else if (["biome", "biomes"].includes(normalized)) {
    filtered = rows.filter((row) => row.kind === "biome");
    label = "Biome Firsts";
  } else if (!["", "latest", "recent", "new"].includes(normalized)) {
    const explicitDate = normalized.startsWith("date ") ? rawFilter.slice(5) : rawFilter;
    const date = parseDateQuery(explicitDate);
    if (date) {
      filtered = rows.filter((row) => montrealDate(row.createdAt) === date);
      label = `Firsts on ${date}`;
    } else {
      const username = normalizeAlias(normalized.replace(/^user\s+/, ""));
      filtered = rows.filter(
        (row) => row.userName && normalizeAlias(row.userName) === username
      );
      label = `${rawFilter.replace(/^user\s+/i, "")} Firsts`;
    }
  }

  // Exactly 3 visible pages. The permanent maps above still prevent rediscovery.
  const visible = filtered.slice(0, 15);
  const totalPages = Math.max(1, Math.min(3, Math.ceil(visible.length / 5)));
  const page = Math.max(1, Math.min(totalPages, Number.isFinite(requestedPage) ? requestedPage : 1));
  const shown = visible.slice((page - 1) * 5, page * 5);
  const text = shown.map((row) =>
    row.kind === "aura"
      ? `✨ ${row.name} — ${row.userName} (${montrealDate(row.createdAt)})`
      : `🌍 ${row.name} — ${row.channelName} (${montrealDate(row.createdAt)})`
  );

  return truncate(
    `🥇 ${label} ${page}/${totalPages}: ${text.join(" | ") || "None found"} | Filters: !firsts latest/auras/biomes/<user>/<YYYY-MM-DD> [page]`,
    390
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BLACK MARKET — six offers, three/page, shared stock and Redis purchase lock.
// ─────────────────────────────────────────────────────────────────────────────
type BlackKind = "token" | "box" | "material";
interface BlackMarketItem {
  id: string;
  name: string;
  aliases?: string[];
  price: number;
  kind: BlackKind;
  targetId: string;
  amount: number;
  stock: number;
  maxStock?: number;
}
interface BlackMarketState {
  spawnedAt: number;
  expiresAt: number;
  stock: BlackMarketItem[];
}
const BLACK_CATALOG: Omit<BlackMarketItem, "stock">[] = [
  { id: "void_box", name: "Void Box", aliases: ["void", "anomaly box", "vb"], price: 25000, kind: "box", targetId: "anomaly_box", amount: 1, maxStock: 2 },
  { id: "reactor_token", name: "Reactor Token", aliases: ["reactor", "rct"], price: 40000, kind: "token", targetId: "reactor_token", amount: 1, maxStock: 1 },
  { id: "anomaly_token", name: "Anomaly Token", aliases: ["anomaly", "at"], price: 65000, kind: "token", targetId: "anomaly_token", amount: 1, maxStock: 1 },
  { id: "matrix_pack", name: "Matrix Pack", aliases: ["matrix", "reality pack", "mp"], price: 12000, kind: "material", targetId: "reality_thread", amount: 25, maxStock: 3 },
  { id: "singularity_pack", name: "Singularity Pack", aliases: ["singularity", "shard pack", "sp"], price: 50000, kind: "material", targetId: "singularity_shard", amount: 5, maxStock: 2 },
  { id: "forbidden_circuit", name: "Forbidden Circuit", aliases: ["forbidden", "fc"], price: 75000, kind: "material", targetId: "forbidden_circuit", amount: 2, maxStock: 1 },
  { id: "recipe_bundle", name: "Recipe Token Bundle", aliases: ["recipe", "recipe tokens", "rtb"], price: 30000, kind: "token", targetId: "recipe_token", amount: 3, maxStock: 2 },
  { id: "wall_token", name: "Wall Token", aliases: ["wall", "wt"], price: 35000, kind: "token", targetId: "wall_token", amount: 1, maxStock: 2 },
  { id: "quest_box_bundle", name: "Quest Box Bundle", aliases: ["quest boxes", "qbb"], price: 18000, kind: "box", targetId: "quest_box", amount: 3, maxStock: 3 },
  { id: "glitched_alloy_pack", name: "Glitched Alloy Pack", aliases: ["glitched alloy", "gap"], price: 60000, kind: "material", targetId: "glitched_alloy", amount: 4, maxStock: 2 },
  { id: "dimensional_pack", name: "Dimensional Seal Pack", aliases: ["dimensional seals", "dsp"], price: 42000, kind: "material", targetId: "dimensional_seal", amount: 4, maxStock: 2 },
  { id: "reactor_box", name: "Reactor Box", aliases: ["reactor box", "rb"], price: 55000, kind: "box", targetId: "reactor_box", amount: 1, maxStock: 1 },
];
function blackKey(channelId: string): string { return `mega:blackmarket:${channelId}`; }
function blackLockKey(channelId: string): string { return `mega:blackmarket-lock:${channelId}`; }
function createBlackStock(seed: number): BlackMarketItem[] {
  const rng = seededRandom(seed);
  return [...BLACK_CATALOG]
    .sort(() => rng() - 0.5)
    .slice(0, 6)
    .map((item) => ({ ...item, stock: item.maxStock ?? 1 }));
}
function normalizeBlackState(state: BlackMarketState): BlackMarketState {
  if (!Array.isArray(state.stock) || state.stock.length !== 6) {
    return { ...state, stock: createBlackStock(hashSeed(String(state.spawnedAt))) };
  }
  return {
    ...state,
    stock: state.stock.map((item) => {
      const catalog = BLACK_CATALOG.find((entry) => entry.id === item.id);
      return {
        ...catalog,
        ...item,
        aliases: item.aliases ?? catalog?.aliases ?? [],
        maxStock: item.maxStock ?? catalog?.maxStock ?? Math.max(1, item.stock),
      } as BlackMarketItem;
    }),
  };
}
async function getBlackState(channelId: string): Promise<BlackMarketState | null> {
  const r = getRedis();
  if (!r) return null;
  const state = await r.get<BlackMarketState>(blackKey(channelId));
  if (!state || state.expiresAt <= Date.now()) return null;
  const normalized = normalizeBlackState(state);
  if (JSON.stringify(normalized) !== JSON.stringify(state)) await r.set(blackKey(channelId), normalized);
  return normalized;
}
async function setBlackState(channelId: string, state: BlackMarketState | null): Promise<void> {
  const r = getRedis();
  if (!r) return;
  if (!state) await r.del(blackKey(channelId));
  else await r.set(blackKey(channelId), state);
}
function blackCandidates(items: BlackMarketItem[]): AliasCandidate<string>[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const abbreviation = initialism(item.name).toLowerCase();
    counts.set(abbreviation, (counts.get(abbreviation) ?? 0) + 1);
  }
  return items.map((item, index) => {
    const abbreviation = initialism(item.name);
    return {
      id: item.id,
      label: item.name,
      aliases: [
        item.id.replace(/_/g, " "),
        ...(item.aliases ?? []),
        String(index + 1),
        ...(counts.get(abbreviation.toLowerCase()) === 1 ? [abbreviation] : []),
      ],
      value: item.id,
    };
  });
}
async function withBlackLock<T>(channelId: string, callback: () => Promise<T>): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  const key = blackLockKey(channelId);
  const token = `${Date.now()}:${Math.random()}`;
  const acquired = await r.set(key, token, { nx: true, px: 5000 });
  if (!acquired) return null;
  try {
    return await callback();
  } finally {
    if ((await r.get<string>(key)) === token) await r.del(key);
  }
}
const BLACK_ACTIONS = [
  { id: "status", label: "status", aliases: ["show", "list", "shop"], value: "status" as const },
  { id: "buy", label: "buy", aliases: ["purchase", "get"], value: "buy" as const },
  { id: "spawn", label: "spawn", aliases: ["open", "start"], value: "spawn" as const },
  { id: "refresh", label: "refresh", aliases: ["reroll", "rotate", "new"], value: "refresh" as const },
  { id: "restock", label: "restock", aliases: ["refill", "stock"], value: "restock" as const },
  { id: "close", label: "close", aliases: ["stop", "end", "off"], value: "close" as const },
];
export async function formatBlackMarketV2(
  channelId: string,
  user: NightbotUser | null,
  query: string,
  isMod: boolean
): Promise<string> {
  const r = getRedis();
  if (!r) return "Black Market database is not connected.";
  const parts = clean(query).split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "status";
  const directPage = /^\d+$/.test(first) ? Number(first) : null;
  const actionResult = directPage
    ? null
    : resolveAlias(first, BLACK_ACTIONS, { maxScore: 0.3, ambiguityGap: 0.08 });
  const action = actionResult?.status === "matched" ? actionResult.match.value : "status";

  if (["spawn", "refresh"].includes(action)) {
    if (!isMod) return `Black Market ${action} is mod/broadcaster only.`;
    const mins = Math.max(1, Math.min(120, parseAmount(parts[1], 15)));
    const now = Date.now();
    await setBlackState(channelId, {
      spawnedAt: now,
      expiresAt: now + mins * 60 * 1000,
      stock: createBlackStock(hashSeed(`${channelId}:${now}`)),
    });
    return `🕶️ Black Market ${action === "spawn" ? "opened" : "rerolled"} with 6 offers for ${mins}m. Use !blackmarket 1/2.`;
  }

  if (action === "close") {
    if (!isMod) return "Black Market close is mod/broadcaster only.";
    await setBlackState(channelId, null);
    return "🕶️ Black Market closed.";
  }

  if (action === "restock") {
    if (!isMod) return "Black Market restock is mod/broadcaster only.";
    const state = await getBlackState(channelId);
    if (!state) return "No Black Market active.";
    state.stock = state.stock.map((item) => ({ ...item, stock: item.maxStock ?? 1 }));
    await setBlackState(channelId, state);
    return "🕶️ Black Market stock refilled without changing the offers.";
  }

  const state = await getBlackState(channelId);
  if (!state) return "🕶️ No Black Market active. Mods: !blackmarket spawn 15";

  if (action === "buy") {
    if (!user) return "Black Market purchases only work from Twitch chat.";
    const buyParts = parts.slice(1);
    let amount = 1;
    if (buyParts.length >= 2 && /^\d+$/.test(buyParts[buyParts.length - 1])) {
      amount = Math.max(1, Math.min(3, parseAmount(buyParts.pop(), 1)));
    }
    const rawItem = buyParts.join(" ");
    const result = await withBlackLock(channelId, async () => {
      const fresh = await getBlackState(channelId);
      if (!fresh) return "Black Market expired before the purchase completed.";
      const resolved = resolveAlias(rawItem, blackCandidates(fresh.stock), {
        maxScore: 0.3,
        ambiguityGap: 0.08,
      });
      if (resolved.status !== "matched") return aliasSuggestionText(resolved, "Black Market offer");
      const item = fresh.stock.find((entry) => entry.id === resolved.match.value);
      if (!item) return "That offer is no longer available.";
      if (item.stock < amount) return `${item.name} has ${item.stock} left; requested ${amount}.`;
      const core = await getCoreState(channelId, user);
      const cost = item.price * amount;
      if (core.stardust < cost) return `Need ${fmt(cost)} Stardust; you have ${fmt(core.stardust)}.`;
      core.stardust -= cost;
      item.stock -= amount;
      const rewardAmount = item.amount * amount;
      if (item.kind === "material") core.materials[item.targetId] = (core.materials[item.targetId] ?? 0) + rewardAmount;
      if (item.kind === "token") core.tokens[item.targetId] = (core.tokens[item.targetId] ?? 0) + rewardAmount;
      if (item.kind === "box") core.lootboxes[item.targetId] = (core.lootboxes[item.targetId] ?? 0) + rewardAmount;
      await Promise.all([saveCoreState(core), setBlackState(channelId, fresh)]);
      return `✅ Bought ${item.name} x${amount} for ${fmt(cost)} Stardust. Received ${fmt(rewardAmount)} ${titleCase(item.targetId)}. Stock left ${item.stock}.`;
    });
    return result ?? "Another Black Market purchase is processing. Try again in a moment.";
  }

  const page = Math.max(1, Math.min(2, directPage ?? parseAmount(parts[1], 1)));
  const shown = state.stock.slice((page - 1) * 3, page * 3);
  const offers = shown.map((item, index) => {
    const number = (page - 1) * 3 + index + 1;
    const abbreviation = initialism(item.name);
    return `${number}) ${item.name} [${abbreviation}] ${fmt(item.price)} SD stock ${item.stock}`;
  });
  return truncate(
    `🕶️ Black Market ${page}/2 | Closes in ${timeLeft(state.expiresAt - Date.now())} | ${offers.join(" | ")} | !blackmarket buy <name/#> [amount] | Mods: refresh/restock/close`,
    390
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL + SEASONAL EVENTS
// ─────────────────────────────────────────────────────────────────────────────
type ChannelEventKind = "luckstorm" | "biome_frenzy" | "meteor" | "stardust" | "festival";
interface ChannelEvent {
  id: string;
  name: string;
  kind: ChannelEventKind;
  percent: number;
  createdAt: number;
  expiresAt: number;
  createdBy: string;
}
const EVENT_KIND_INFO: Record<ChannelEventKind, { name: string; percent: number; aliases: string[] }> = {
  luckstorm: { name: "Luckstorm", percent: 25, aliases: ["luck storm", "luck stom", "luck", "ls"] },
  biome_frenzy: { name: "Biome Frenzy", percent: 18, aliases: ["biome frenzy", "biome frenz", "frenzy", "bf"] },
  meteor: { name: "Meteor Shower", percent: 10, aliases: ["meteor shower", "meteors"] },
  stardust: { name: "Stardust Rush", percent: 12, aliases: ["stardust rush", "dust", "sd"] },
  festival: { name: "Festival", percent: 15, aliases: ["market festival", "fest"] },
};
const EVENT_ACTIONS = [
  { id: "status", label: "status", aliases: ["show", "info", "current", "stat", "staus"], value: "status" as const },
  { id: "list", label: "list", aliases: ["events", "seasonal", "available"], value: "list" as const },
  { id: "start", label: "start", aliases: ["spawn", "begin", "on", "enable", "activate"], value: "start" as const },
  { id: "stop", label: "stop", aliases: ["end", "off", "disable", "clear"], value: "stop" as const },
];
function eventKey(channelId: string): string { return `mega:event:${channelId}`; }
function eventKindCandidates(): AliasCandidate<ChannelEventKind>[] {
  return (Object.entries(EVENT_KIND_INFO) as Array<[ChannelEventKind, (typeof EVENT_KIND_INFO)[ChannelEventKind]]>).map(([id, info]) => ({
    id,
    label: info.name,
    aliases: [id.replace(/_/g, " "), ...info.aliases],
    value: id,
  }));
}
function seasonalCandidates() {
  return events.map((event) => ({
    id: event.id,
    label: event.name,
    aliases: [event.id.replace(/_/g, " "), ...(event.aliases ?? [])],
    value: event.id,
  }));
}
function resolveSeasonal(raw: string) {
  const exact = findEvent(raw) ?? findEvent(raw.replace(/_/g, " "));
  if (exact) return { status: "matched" as const, id: exact.id };
  const result = resolveAlias(raw, seasonalCandidates(), { maxScore: 0.29, ambiguityGap: 0.08 });
  return result.status === "matched"
    ? { status: "matched" as const, id: result.match.value }
    : { status: result.status, error: aliasSuggestionText(result, "seasonal event") };
}
async function activeBoost(channelId: string): Promise<ChannelEvent | null> {
  const r = getRedis();
  if (!r) return null;
  const event = await r.get<ChannelEvent>(eventKey(channelId));
  if (!event || event.expiresAt <= Date.now()) return null;
  return event;
}
export async function formatChannelEventV2(
  channelId: string,
  user: NightbotUser | null,
  query: string,
  isMod: boolean
): Promise<string> {
  const r = getRedis();
  if (!r) return "Event database is not connected.";
  const parts = clean(query).split(/\s+/).filter(Boolean);
  let action: "status" | "list" | "start" | "stop" = "status";
  let rest = parts;

  if (parts.length > 0) {
    const resolved = resolveAlias(parts[0], EVENT_ACTIONS, { maxScore: 0.3, ambiguityGap: 0.08 });
    if (resolved.status === "matched") {
      action = resolved.match.value;
      rest = parts.slice(1);
    } else {
      // Backward compatibility: !event summer_2025 directly activates seasonal.
      const seasonal = resolveSeasonal(parts.join(" "));
      if (seasonal.status === "matched") {
        action = "start";
        rest = parts;
      } else {
        const boost = resolveAlias(parts.join(" "), eventKindCandidates(), { maxScore: 0.29, ambiguityGap: 0.08 });
        if (boost.status === "matched") {
          action = "start";
          rest = parts;
        }
      }
    }
  }

  if (action === "list") {
    const state = await getChannelState(channelId);
    return truncate(`🎉 Events | Boosts: ${Object.values(EVENT_KIND_INFO).map((event) => `${event.name} +${event.percent}%`).join(", ")} | Seasonal active: ${(state.activeEvents ?? []).map((id: string) => findEvent(id)?.name ?? titleCase(id)).join(", ") || "none"}`, 390);
  }

  if (action === "start") {
    if (!isMod) return "Event start is mod/broadcaster only.";
    const targetParts = [...rest];
    const maybeMinutes = targetParts[targetParts.length - 1];
    const hasMinutes = Boolean(maybeMinutes && /^\d+$/.test(maybeMinutes));
    const minutes = Math.max(1, Math.min(120, parseAmount(hasMinutes ? targetParts.pop() : undefined, 10)));
    const target = targetParts.join(" ");

    const seasonal = resolveSeasonal(target);
    if (seasonal.status === "matched") {
      const definition = findEvent(seasonal.id);
      if (!definition) return "Unknown seasonal event.";
      const state = await getChannelState(channelId);
      state.activeEvents = [...new Set([...(state.activeEvents ?? []), definition.id])];
      await setChannelState(state);
      return `✅ Seasonal event active: ${definition.name}. It stays active until !event stop ${definition.id}.`;
    }

    const kind = resolveAlias(target || "luckstorm", eventKindCandidates(), { maxScore: 0.3, ambiguityGap: 0.08 });
    if (kind.status !== "matched") return aliasSuggestionText(kind, "boost event");
    const info = EVENT_KIND_INFO[kind.match.value];
    const now = Date.now();
    const event: ChannelEvent = {
      id: `${kind.match.value}:${now}`,
      name: info.name,
      kind: kind.match.value,
      percent: info.percent,
      createdAt: now,
      expiresAt: now + minutes * 60 * 1000,
      createdBy: displayName(user),
    };
    await r.set(eventKey(channelId), event);
    return `🎉 ${event.name} started by ${event.createdBy}: +${event.percent}% final luck for ${minutes}m.`;
  }

  if (action === "stop") {
    if (!isMod) return "Event stop is mod/broadcaster only.";
    const target = normalizeAlias(rest.join(" ") || "boost");
    const state = await getChannelState(channelId);

    if (["all", "everything", "all events"].includes(target)) {
      const seasonalCount = state.activeEvents?.length ?? 0;
      state.activeEvents = [];
      await Promise.all([setChannelState(state), r.del(eventKey(channelId))]);
      return `✅ Stopped the channel boost and ${seasonalCount} seasonal event(s).`;
    }

    if (["boost", "channel", "luck", "current"].includes(target)) {
      await r.del(eventKey(channelId));
      return "✅ Channel boost event stopped. Seasonal events were left active.";
    }

    if (["seasonal", "events", "all seasonal"].includes(target)) {
      const count = state.activeEvents?.length ?? 0;
      state.activeEvents = [];
      await setChannelState(state);
      return `✅ Stopped ${count} seasonal event(s). Channel boost was left active.`;
    }

    const seasonal = resolveSeasonal(rest.join(" "));
    if (seasonal.status !== "matched") return seasonal.error ?? "Unknown seasonal event.";
    const before = state.activeEvents ?? [];
    state.activeEvents = before.filter((id: string) => id !== seasonal.id);
    await setChannelState(state);
    return before.includes(seasonal.id)
      ? `✅ Seasonal event stopped: ${findEvent(seasonal.id)?.name ?? titleCase(seasonal.id)}.`
      : "That seasonal event was not active.";
  }

  const [boost, state] = await Promise.all([activeBoost(channelId), getChannelState(channelId)]);
  const seasonal = (state.activeEvents ?? []).map((id: string) => findEvent(id)?.name ?? titleCase(id));
  if (!boost) {
    return truncate(`🎉 No channel boost active | Seasonal: ${seasonal.join(", ") || "none"} | Mods: !event start luckstorm 10 / !event stop all`, 390);
  }
  return truncate(`🎉 ${boost.name} +${boost.percent}% final luck | Created by ${boost.createdBy} | ${timeLeft(boost.expiresAt - Date.now())} left | Seasonal: ${seasonal.join(", ") || "none"}`, 390);
}
