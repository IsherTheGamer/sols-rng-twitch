import { Redis } from "@upstash/redis";
import type { NightbotUser } from "./nightbot";
import {
  formatViewerProfile,
  getViewerProfile,
  listViewerProfiles,
  type ViewerProfile,
} from "./profile";
import { getCoreState, saveCoreState } from "./core-system";
import { formatRarity, truncate } from "./format";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

type RollSource = "roll" | "token" | "potion";

interface RecentPull {
  userId: string;
  displayName: string;
  auraId: string;
  auraName: string;
  rarity: number;
  source: RollSource;
  createdAt: number;
}

interface TitleDef {
  id: string;
  name: string;
  hidden: boolean;
  hint: string;
  description: string;
}

interface TitleState {
  owned: string[];
  equipped: string | null;
  updatedAt: number;
}

interface ServerBoost {
  id: string;
  name: string;
  percent: number;
  source: string;
  createdAt: number;
  expiresAt: number;
}

interface ChatActivityState {
  windowStartedAt: number;
  messages: number;
  users: string[];
  lastTriggeredAt: number;
}

interface MerchantItem {
  id: string;
  name: string;
  price: number;
  kind: "material" | "token" | "box";
  targetId: string;
  amount: number;
  stock: number;
}

interface MerchantState {
  spawnedAt: number;
  expiresAt: number;
  stock: MerchantItem[];
}

interface NpcQuest {
  id: string;
  title: string;
  description: string;
  type: "rare_pull" | "chat_surge" | "flex_win";
  target: number;
  progress: number;
  reward: {
    materials?: Record<string, number>;
    tokens?: Record<string, number>;
    lootboxes?: Record<string, number>;
    stardust?: number;
  };
  claimedBy: Record<string, boolean>;
}

interface NpcState {
  cycleKey: string;
  quests: NpcQuest[];
}

interface FlexChallenge {
  challengerId: string;
  challengerName: string;
  targetName: string;
  createdAt: number;
}

const RECENT_MIN_RARITY = 100000;
const RARE_BOOST_MIN_RARITY = 100000000;
const CHAT_WINDOW_MS = 5 * 60 * 1000;
const CHAT_BOOST_COOLDOWN_MS = 5 * 60 * 1000;
const MERCHANT_DURATION_MS = 10 * 60 * 1000;
const FLEX_DURATION_MS = 2 * 60 * 1000;

const TITLES: TitleDef[] = [
  { id: "first_steps", name: "First Steps", hidden: false, hint: "Roll 100 normal auras.", description: "Rolled 100 normal auras." },
  { id: "rare_hunter", name: "Rare Hunter", hidden: false, hint: "Roll a 1/100k+ aura.", description: "Rolled a 1/100k+ aura." },
  { id: "millionaire", name: "Millionaire", hidden: false, hint: "Roll a 1/1M+ aura.", description: "Rolled a 1/1M+ aura." },
  { id: "void_touched", name: "Void-Touched", hidden: true, hint: "Touch the void.", description: "Rolled a 1/100M+ aura." },
  { id: "token_wizard", name: "Token Wizard", hidden: false, hint: "Use token rolls.", description: "Reached 100 token-assisted rolls." },
  { id: "level_grinder", name: "Level Grinder", hidden: false, hint: "Reach level 25.", description: "Reached level 25." },
  { id: "cosmic", name: "Cosmic", hidden: true, hint: "Go beyond.", description: "Rolled a 1/1B+ aura." },
  { id: "flex_champion", name: "Flex Champion", hidden: false, hint: "Win a flex battle.", description: "Won a flex battle." },
  { id: "community_spark", name: "Community Spark", hidden: false, hint: "Help trigger active chat.", description: "Triggered active chat boost." },
];

const UPDATE_NOTES = [
  "Mega Expansion v2: added Discord alerts/settings, replay, records, first discoveries, AOTD/BOTD, channel events, black market, player/global quests, and rebuilt leaderboards.",
  "Quest expansion: !pquests and !gquests now support daily, weekly, monthly, and yearly pages with 3 quests per period.",
  "Leaderboard rework: !lb now supports all-time plus daily/weekly/monthly/yearly rolls, best, rare, and value pages. !weeklylb is a shortcut.",
  "Discord integration: !dcalerts controls alert status, aura rarity threshold, rare biome list, and test alerts. Browser admin endpoint can save per-channel webhooks.",
  "Info update: !info sol commands and !info sol mega now explain the new command systems. !solinfo works as the same alias.",
  "Event systems: !event can start temporary luck events, !blackmarket can spawn a rare Stardust shop, and !summary can post Discord recaps.",
];

function recentKey(channelId: string): string { return `social:recent:${channelId}`; }
function titleKey(channelId: string, userId: string): string { return `social:titles:${channelId}:${userId}`; }
function boostKey(channelId: string): string { return `social:boosts:${channelId}`; }
function chatKey(channelId: string): string { return `social:chat:${channelId}`; }
function merchantKey(channelId: string): string { return `social:merchant:${channelId}`; }
function npcKey(channelId: string): string { return `social:npc:${channelId}`; }
function flexKey(channelId: string): string { return `social:flex:${channelId}`; }

function getUserId(user: NightbotUser | null): string { return user?.providerId ?? "anon"; }
function getDisplayName(user: NightbotUser | null): string { return user?.displayName ?? user?.name ?? "Player"; }

function normalizeName(input: string | undefined | null): string {
  return (input ?? "").toLowerCase().trim().replace(/^@+/, "").replace(/[^a-z0-9_]/g, "");
}

function titleCase(raw: string): string {
  return raw.split(/[_\-\s:]+/g).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatAmount(value: number): string { return Math.floor(value).toLocaleString("en-US"); }

function parseAmount(raw: string | undefined | null, fallback = 1): number {
  const cleaned = String(raw ?? "").toLowerCase().replace(/,/g, "").trim();
  const match = cleaned.match(/^(\d+)(k|m|b)?$/);
  if (!match) return fallback;
  const base = Number(match[1]);
  const suffix = match[2];
  if (!Number.isFinite(base)) return fallback;
  if (suffix === "k") return base * 1000;
  if (suffix === "m") return base * 1000000;
  if (suffix === "b") return base * 1000000000;
  return base;
}

function makeUserFromProfile(profile: ViewerProfile): NightbotUser {
  return { name: normalizeName(profile.displayName) || profile.userId, displayName: profile.displayName, provider: "twitch", providerId: profile.userId, userLevel: "everyone" };
}

function addBag(bag: Record<string, number>, id: string, amount: number): void {
  if (amount <= 0) return;
  bag[id] = Math.max(0, Math.floor((bag[id] ?? 0) + amount));
}

async function findProfileByName(channelId: string, query: string): Promise<ViewerProfile | null> {
  const target = normalizeName(query);
  if (!target) return null;
  const profiles = await listViewerProfiles(channelId);
  return profiles.find((profile) => normalizeName(profile.displayName) === target) ?? profiles.find((profile) => profile.userId === query.trim()) ?? profiles.find((profile) => normalizeName(profile.displayName).includes(target)) ?? null;
}

async function getTitleState(channelId: string, userId: string): Promise<TitleState> {
  const r = getRedis();
  if (!r) return { owned: [], equipped: null, updatedAt: Date.now() };
  const data = await r.get<TitleState>(titleKey(channelId, userId));
  return { owned: Array.isArray(data?.owned) ? data.owned : [], equipped: data?.equipped ?? null, updatedAt: data?.updatedAt ?? Date.now() };
}

async function setTitleState(channelId: string, userId: string, state: TitleState): Promise<void> {
  const r = getRedis();
  if (!r) return;
  state.updatedAt = Date.now();
  await r.set(titleKey(channelId, userId), state);
}

function getTitleName(id: string | null | undefined): string {
  if (!id) return "None";
  return TITLES.find((title) => title.id === id)?.name ?? titleCase(id);
}

function unlockTitle(state: TitleState, id: string): boolean {
  if (state.owned.includes(id)) return false;
  state.owned.push(id);
  if (!state.equipped) state.equipped = id;
  return true;
}

async function refreshTitles(channelId: string, profile: ViewerProfile): Promise<{ state: TitleState; unlocked: string[] }> {
  const state = await getTitleState(channelId, profile.userId);
  const unlocked: string[] = [];
  const checks: Array<[string, boolean]> = [
    ["first_steps", profile.rolls >= 100],
    ["rare_hunter", (profile.bestAura?.rarity ?? 0) >= 100000],
    ["millionaire", (profile.bestAura?.rarity ?? 0) >= 1000000],
    ["void_touched", (profile.bestAura?.rarity ?? 0) >= 100000000],
    ["token_wizard", profile.tokenRolls >= 100],
    ["level_grinder", profile.level >= 25],
    ["cosmic", (profile.bestAura?.rarity ?? 0) >= 1000000000],
  ];
  for (const [id, ok] of checks) if (ok && unlockTitle(state, id)) unlocked.push(id);
  if (unlocked.length > 0) await setTitleState(channelId, profile.userId, state);
  return { state, unlocked };
}

async function unlockTitleForUser(channelId: string, userId: string, titleId: string): Promise<void> {
  const state = await getTitleState(channelId, userId);
  if (unlockTitle(state, titleId)) await setTitleState(channelId, userId, state);
}

async function getRecent(channelId: string): Promise<RecentPull[]> {
  const r = getRedis();
  if (!r) return [];
  return (await r.get<RecentPull[]>(recentKey(channelId))) ?? [];
}

async function setRecent(channelId: string, pulls: RecentPull[]): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(recentKey(channelId), pulls.slice(0, 50));
}

async function addRecentPull(channelId: string, pull: RecentPull): Promise<void> {
  const pulls = await getRecent(channelId);
  pulls.unshift(pull);
  await setRecent(channelId, pulls);
}

async function getBoosts(channelId: string): Promise<ServerBoost[]> {
  const r = getRedis();
  if (!r) return [];
  const boosts = (await r.get<ServerBoost[]>(boostKey(channelId))) ?? [];
  return boosts.filter((boost) => boost.expiresAt > Date.now());
}

async function setBoosts(channelId: string, boosts: ServerBoost[]): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(boostKey(channelId), boosts.filter((boost) => boost.expiresAt > Date.now()).slice(0, 12));
}

export async function addServerBoost(options: { channelId: string; name: string; percent: number; durationSeconds: number; source: string; }): Promise<void> {
  const boosts = await getBoosts(options.channelId);
  const now = Date.now();
  boosts.push({ id: `${normalizeName(options.name)}:${now}`, name: options.name, percent: Math.max(1, Math.min(250, Math.floor(options.percent))), source: options.source, createdAt: now, expiresAt: now + Math.max(10, options.durationSeconds) * 1000 });
  await setBoosts(options.channelId, boosts);
}

export async function getServerLuckMultiplier(channelId: string): Promise<{ percent: number; multiplier: number; label: string }> {
  const boosts = await getBoosts(channelId);
  const percent = Math.min(250, boosts.reduce((sum, boost) => sum + Math.max(0, boost.percent), 0));
  return { percent, multiplier: 1 + percent / 100, label: percent > 0 ? `+${formatAmount(percent)}% server luck` : "No server boost" };
}

export async function formatBoostStatus(channelId: string): Promise<string> {
  const boosts = await getBoosts(channelId);
  await setBoosts(channelId, boosts);
  if (boosts.length === 0) return "🌐 Server Boosts: none active.";
  const now = Date.now();
  const shown = boosts.slice(0, 5).map((boost) => {
    const left = Math.max(0, Math.ceil((boost.expiresAt - now) / 1000));
    return `${boost.name} +${boost.percent}% ${Math.floor(left / 60)}m${left % 60}s`;
  });
  const total = boosts.reduce((sum, boost) => sum + boost.percent, 0);
  return truncate(`🌐 Server Boost +${formatAmount(total)}%: ${shown.join(" | ")}`);
}

export async function recordSocialRolls(channelId: string, user: NightbotUser | null, rolls: Array<{ aura: { id: string; name: string }; effectiveRarity: number }>, source: RollSource): Promise<string[]> {
  if (!user) return [];
  const userId = getUserId(user);
  const displayName = getDisplayName(user);
  const unlockedMessages: string[] = [];
  const rareRolls = rolls.filter((roll) => roll.effectiveRarity >= RECENT_MIN_RARITY).sort((a, b) => b.effectiveRarity - a.effectiveRarity);
  for (const roll of rareRolls.slice(0, 3)) await addRecentPull(channelId, { userId, displayName, auraId: roll.aura.id, auraName: roll.aura.name, rarity: roll.effectiveRarity, source, createdAt: Date.now() });
  const best = rareRolls[0];
  if (best) {
    await progressNpcQuest(channelId, "rare_pull", 1);
    if (best.effectiveRarity >= RARE_BOOST_MIN_RARITY) {
      const percent = Math.min(50, Math.floor(Math.log10(best.effectiveRarity) * 4));
      await addServerBoost({ channelId, name: "Rare Pull Surge", percent, durationSeconds: 5 * 60, source: `${displayName} pulled ${best.aura.name}` });
    }
  }
  const profile = await getViewerProfile(channelId, user);
  const { unlocked } = await refreshTitles(channelId, profile);
  for (const id of unlocked) unlockedMessages.push(`Title unlocked: ${getTitleName(id)}`);
  return unlockedMessages;
}

export async function formatSocialProfile(channelId: string, user: NightbotUser | null, rawTarget = ""): Promise<string> {
  const target = rawTarget.trim();
  const profile = target && normalizeName(target) ? await findProfileByName(channelId, target) : user ? await getViewerProfile(channelId, user) : null;
  if (!profile) return target ? `No profile found for ${target}. They need to roll once first.` : "Profile only works from Twitch chat unless you search a username.";
  const { state } = await refreshTitles(channelId, profile);
  return truncate(`${formatViewerProfile(profile)} | Title: ${getTitleName(state.equipped)}`);
}

export async function formatLeaderboard(channelId: string, query = ""): Promise<string> {
  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const mode = parts[0] ?? "rolls";
  const page = Math.max(1, Math.floor(parseAmount(parts[1], 1)));
  const profiles = await listViewerProfiles(channelId);
  if (profiles.length === 0) return "No leaderboard data yet. Roll first!";
  const sorted = [...profiles].sort((a, b) => {
    if (mode === "value" || mode === "total") return b.rarityTotal - a.rarityTotal;
    if (mode === "best" || mode === "roll") return (b.bestAura?.rarity ?? 0) - (a.bestAura?.rarity ?? 0);
    if (mode === "token" || mode === "potion") return (b.bestTokenAura?.rarity ?? 0) - (a.bestTokenAura?.rarity ?? 0);
    if (mode === "level" || mode === "xp") return b.xp - a.xp;
    return b.rolls + b.tokenRolls - (a.rolls + a.tokenRolls);
  });
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize).map((profile, index) => {
    const rank = (safePage - 1) * pageSize + index + 1;
    if (mode === "value" || mode === "total") return `${rank}. ${profile.displayName} ${formatAmount(profile.rarityTotal)}`;
    if (mode === "best" || mode === "roll") return `${rank}. ${profile.displayName} ${profile.bestAura ? formatRarity(profile.bestAura.rarity) : "None"}`;
    if (mode === "token" || mode === "potion") return `${rank}. ${profile.displayName} ${profile.bestTokenAura ? formatRarity(profile.bestTokenAura.rarity) : "None"}`;
    if (mode === "level" || mode === "xp") return `${rank}. ${profile.displayName} Lv.${profile.level}`;
    return `${rank}. ${profile.displayName} ${formatAmount(profile.rolls + profile.tokenRolls)} rolls`;
  });
  return truncate(`🏆 ${titleCase(mode)} LB ${safePage}/${totalPages}: ${rows.join(" | ")}`);
}

export async function formatRecentPulls(channelId: string, query = ""): Promise<string> {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const firstIsPage = /^\d+$/.test(first);
  const target = first && !firstIsPage ? normalizeName(first) : "";
  const pageRaw = target ? parts[1] : first;
  const page = Math.max(1, Math.floor(parseAmount(pageRaw, 1)));
  let pulls = await getRecent(channelId);
  if (target) pulls = pulls.filter((pull) => normalizeName(pull.displayName) === target);
  if (pulls.length === 0) return target ? `No recent rare pulls found for ${parts[0]}.` : "No recent rare pulls yet.";
  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(pulls.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const shown = pulls.slice((safePage - 1) * pageSize, safePage * pageSize);
  return truncate(`✨ Recent ${safePage}/${totalPages}: ${shown.map((pull) => `${pull.displayName} ${pull.auraName} ${formatRarity(pull.rarity)}${pull.source !== "roll" ? " token" : ""}`).join(" | ")}`);
}

export function formatUpdateNotes(query = ""): string {
  const page = Math.max(1, Math.floor(parseAmount(query.trim().split(/\s+/)[0], 1)));
  const totalPages = UPDATE_NOTES.length;
  const safePage = Math.min(page, totalPages);
  return truncate(`🛠️ Update ${safePage}/${totalPages}: ${UPDATE_NOTES[safePage - 1]}`);
}

export async function formatTitlesCommand(channelId: string, user: NightbotUser | null, query = ""): Promise<string> {
  if (!user) return "Titles only work from Twitch chat.";
  const profile = await getViewerProfile(channelId, user);
  const { state } = await refreshTitles(channelId, profile);
  const args = query.trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "list").toLowerCase();
  if (action === "equip") {
    const wanted = normalizeName(args.slice(1).join(" "));
    const title = TITLES.find((entry) => entry.id === wanted || normalizeName(entry.name) === wanted);
    if (!title) return "Unknown title. Try !titles list.";
    if (!state.owned.includes(title.id)) return `You have not unlocked ${title.name}.`;
    state.equipped = title.id;
    await setTitleState(channelId, profile.userId, state);
    return `✅ Equipped title: ${title.name}.`;
  }
  if (action === "clear" || action === "none") {
    state.equipped = null;
    await setTitleState(channelId, profile.userId, state);
    return "✅ Title cleared.";
  }
  const owned = TITLES.filter((title) => state.owned.includes(title.id));
  const locked = TITLES.filter((title) => !state.owned.includes(title.id));
  if (action === "locked") {
    const shown = locked.slice(0, 6).map((title) => `${title.hidden ? "???" : title.name}: ${title.hint}`);
    return truncate(`🔒 Locked Titles: ${shown.join(" | ") || "None"}`);
  }
  return truncate(`🎖️ ${profile.displayName} Titles: ${owned.map((title) => title.name).join(", ") || "None"} | Equipped: ${getTitleName(state.equipped)} | Use !titles equip <title>.`);
}

function merchantStock(seed: number): MerchantItem[] {
  const stock: MerchantItem[] = [
    { id: "starter", name: "Starter Box", price: 150, kind: "box", targetId: "starter_box", amount: 1, stock: 5 },
    { id: "quest", name: "Quest Box", price: 600, kind: "box", targetId: "quest_box", amount: 1, stock: 3 },
    { id: "signal", name: "Signal Fragment Pack", price: 250, kind: "material", targetId: "signal_fragment", amount: 50, stock: 4 },
    { id: "alloy", name: "Refined Alloy Pack", price: 500, kind: "material", targetId: "refined_alloy", amount: 40, stock: 3 },
    { id: "recipe", name: "Recipe Token", price: 900, kind: "token", targetId: "recipe_token", amount: 1, stock: 2 },
    { id: "wall", name: "Wall Token", price: 1800, kind: "token", targetId: "wall_token", amount: 1, stock: 1 },
  ];
  return stock.sort((a, b) => ((seed + a.id.charCodeAt(0)) % 7) - ((seed + b.id.charCodeAt(0)) % 7)).slice(0, 4);
}

async function getMerchant(channelId: string): Promise<MerchantState | null> {
  const r = getRedis();
  if (!r) return null;
  const state = await r.get<MerchantState>(merchantKey(channelId));
  if (!state || state.expiresAt <= Date.now()) return null;
  return state;
}

async function setMerchant(channelId: string, merchant: MerchantState | null): Promise<void> {
  const r = getRedis();
  if (!r) return;
  if (!merchant) { await r.del(merchantKey(channelId)); return; }
  await r.set(merchantKey(channelId), merchant);
}

export async function formatMerchant(channelId: string, user: NightbotUser | null, query = ""): Promise<string> {
  const args = query.trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "status").toLowerCase();
  if (action === "spawn") {
    const now = Date.now();
    await setMerchant(channelId, { spawnedAt: now, expiresAt: now + MERCHANT_DURATION_MS, stock: merchantStock(now) });
    return "🧙 Merchant spawned! Use !merchant to see stock.";
  }
  const merchant = await getMerchant(channelId);
  if (!merchant) return "🧙 No merchant active. A mod can use !merchant spawn.";
  if (action === "buy") {
    if (!user) return "Merchant buy only works from Twitch chat.";
    const itemQuery = normalizeName(args[1]);
    const amount = Math.max(1, Math.min(10, Math.floor(parseAmount(args[2], 1))));
    const item = merchant.stock.find((entry) => entry.id === itemQuery || normalizeName(entry.name) === itemQuery);
    if (!item) return `Merchant does not sell that. Stock: ${merchant.stock.map((entry) => entry.id).join(", ")}`;
    if (item.stock < amount) return `${item.name} stock ${item.stock}/${amount}.`;
    const state = await getCoreState(channelId, user);
    const cost = item.price * amount;
    if (state.stardust < cost) return `Need ${formatAmount(cost)} Stardust. You have ${formatAmount(state.stardust)}.`;
    state.stardust -= cost;
    item.stock -= amount;
    const totalAmount = item.amount * amount;
    if (item.kind === "material") addBag(state.materials, item.targetId, totalAmount);
    if (item.kind === "token") addBag(state.tokens, item.targetId, totalAmount);
    if (item.kind === "box") addBag(state.lootboxes, item.targetId, totalAmount);
    await saveCoreState(state);
    await setMerchant(channelId, merchant);
    return `✅ Bought ${item.name} x${amount} for ${formatAmount(cost)} Stardust.`;
  }
  const left = Math.max(0, Math.ceil((merchant.expiresAt - Date.now()) / 1000));
  const stock = merchant.stock.filter((item) => item.stock > 0).map((item) => `${item.id}: ${item.name} ${formatAmount(item.price)}sd stock ${item.stock}`).join(" | ");
  return truncate(`🧙 Merchant ${Math.floor(left / 60)}m${left % 60}s: ${stock || "Sold out"}`);
}

function getCycleKey(): string { return new Date().toISOString().slice(0, 10); }

function defaultNpcState(): NpcState {
  return { cycleKey: getCycleKey(), quests: [
    { id: "rare_hunt", title: "Community Rare Hunt", description: "Channel rolls 5 auras at 1/100k+", type: "rare_pull", target: 5, progress: 0, reward: { lootboxes: { starter_box: 1 }, materials: { signal_fragment: 25 } }, claimedBy: {} },
    { id: "chat_surge", title: "Chat Surge", description: "Trigger active chat 2 times", type: "chat_surge", target: 2, progress: 0, reward: { tokens: { quest_token: 1 }, materials: { circuit_scrap: 100 } }, claimedBy: {} },
    { id: "flex_arena", title: "Flex Arena", description: "Finish 3 flex battles", type: "flex_win", target: 3, progress: 0, reward: { lootboxes: { quest_box: 1 } }, claimedBy: {} },
  ] };
}

async function getNpcState(channelId: string): Promise<NpcState> {
  const r = getRedis();
  const current = defaultNpcState();
  if (!r) return current;
  const saved = await r.get<NpcState>(npcKey(channelId));
  if (!saved || saved.cycleKey !== current.cycleKey) return current;
  return { cycleKey: saved.cycleKey, quests: current.quests.map((quest) => { const old = saved.quests.find((entry) => entry.id === quest.id); return { ...quest, progress: Math.max(0, Math.min(quest.target, old?.progress ?? 0)), claimedBy: old?.claimedBy ?? {} }; }) };
}

async function setNpcState(channelId: string, state: NpcState): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(npcKey(channelId), state);
}

async function progressNpcQuest(channelId: string, type: NpcQuest["type"], amount: number): Promise<void> {
  const state = await getNpcState(channelId);
  for (const quest of state.quests) if (quest.type === type) quest.progress = Math.min(quest.target, quest.progress + amount);
  await setNpcState(channelId, state);
}

export async function formatNpc(channelId: string, user: NightbotUser | null, query = ""): Promise<string> {
  const args = query.trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "status").toLowerCase();
  const state = await getNpcState(channelId);
  if (action === "claim") {
    if (!user) return "NPC claim only works from Twitch chat.";
    const userId = getUserId(user);
    const ready = state.quests.filter((quest) => quest.progress >= quest.target && !quest.claimedBy[userId]);
    if (ready.length === 0) return "No NPC quest rewards ready to claim.";
    const core = await getCoreState(channelId, user);
    for (const quest of ready) {
      quest.claimedBy[userId] = true;
      if (quest.reward.stardust) core.stardust += quest.reward.stardust;
      for (const [id, amount] of Object.entries(quest.reward.materials ?? {})) addBag(core.materials, id, amount);
      for (const [id, amount] of Object.entries(quest.reward.tokens ?? {})) addBag(core.tokens, id, amount);
      for (const [id, amount] of Object.entries(quest.reward.lootboxes ?? {})) addBag(core.lootboxes, id, amount);
    }
    await saveCoreState(core);
    await setNpcState(channelId, state);
    return `✅ Claimed ${ready.length} NPC quest reward(s).`;
  }
  return truncate(`🧑‍🚀 NPC Quests: ${state.quests.map((quest) => `${quest.progress >= quest.target ? "🎁" : "🔸"} ${quest.title} ${quest.progress}/${quest.target}`).join(" | ")} | Use !npc claim.`);
}

export async function recordChatActivity(channelId: string, user: NightbotUser | null): Promise<string> {
  if (!user) return "Active chat only works from Twitch chat.";
  const r = getRedis();
  if (!r) return "Active chat database is not connected.";
  const now = Date.now();
  const userId = getUserId(user);
  const saved = await r.get<ChatActivityState>(chatKey(channelId));
  const expired = !saved || saved.windowStartedAt + CHAT_WINDOW_MS < now;
  const state: ChatActivityState = expired ? { windowStartedAt: now, messages: 0, users: [], lastTriggeredAt: saved?.lastTriggeredAt ?? 0 } : saved;
  state.messages += 1;
  if (!state.users.includes(userId)) state.users.push(userId);
  const triggered = now - state.lastTriggeredAt >= CHAT_BOOST_COOLDOWN_MS && (state.users.length >= 5 || state.messages >= 12);
  if (triggered) {
    state.lastTriggeredAt = now;
    state.windowStartedAt = now;
    state.messages = 0;
    state.users = [];
    await addServerBoost({ channelId, name: "Active Chat", percent: 12, durationSeconds: 5 * 60, source: "chat activity" });
    await progressNpcQuest(channelId, "chat_surge", 1);
    await unlockTitleForUser(channelId, userId, "community_spark");
  }
  await r.set(chatKey(channelId), state);
  return triggered ? "🔥 Active Chat triggered! +12% server luck for 5m." : `💬 Active Chat: ${state.users.length}/5 users or ${state.messages}/12 pings.`;
}

export async function activateRaidBoost(channelId: string, user: NightbotUser | null, query = ""): Promise<string> {
  const viewers = Math.max(1, Math.floor(parseAmount(query.trim().split(/\s+/)[0], 10)));
  const percent = Math.min(100, 15 + Math.floor(viewers / 4));
  await addServerBoost({ channelId, name: "Raid Boost", percent, durationSeconds: 15 * 60, source: `${getDisplayName(user)} raid command` });
  return `🚨 Raid Boost activated: +${percent}% server luck for 15m. Welcome raiders!`;
}

export async function formatFlex(channelId: string, user: NightbotUser | null, query = ""): Promise<string> {
  if (!user) return "Flex battle only works from Twitch chat.";
  const r = getRedis();
  if (!r) return "Flex database is not connected.";
  const args = query.trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "status").toLowerCase();
  const key = flexKey(channelId);
  const current = await r.get<FlexChallenge>(key);
  if (action === "challenge") {
    const target = normalizeName(args.slice(1).join(" "));
    if (!target) return "Use !flex challenge <user>.";
    const challenge: FlexChallenge = { challengerId: getUserId(user), challengerName: getDisplayName(user), targetName: target, createdAt: Date.now() };
    await r.set(key, challenge);
    return `⚔️ ${challenge.challengerName} challenged ${target}! ${target}, use !flex accept.`;
  }
  if (action === "cancel") {
    if (!current) return "No flex challenge to cancel.";
    if (current.challengerId !== getUserId(user)) return "Only the challenger can cancel this flex battle.";
    await r.del(key);
    return "Flex challenge cancelled.";
  }
  if (action === "accept") {
    if (!current) return "No active flex challenge.";
    if (current.createdAt + FLEX_DURATION_MS < Date.now()) { await r.del(key); return "That flex challenge expired."; }
    const accepterName = normalizeName(getDisplayName(user));
    if (accepterName !== current.targetName && normalizeName(user.name) !== current.targetName) return `This challenge is for ${current.targetName}.`;
    const challenger = await findProfileByName(channelId, current.challengerName);
    const accepter = await getViewerProfile(channelId, user);
    if (!challenger) { await r.del(key); return "Challenger profile not found anymore."; }
    const challengerBest = challenger.bestAura?.rarity ?? 0;
    const accepterBest = accepter.bestAura?.rarity ?? 0;
    const winner = accepterBest >= challengerBest ? accepter : challenger;
    const loser = accepterBest >= challengerBest ? challenger : accepter;
    const winnerUser = winner.userId === getUserId(user) ? user : makeUserFromProfile(winner);
    const winnerCore = await getCoreState(channelId, winnerUser);
    addBag(winnerCore.lootboxes, "starter_box", 1);
    addBag(winnerCore.tokens, "quest_token", 1);
    await saveCoreState(winnerCore);
    await unlockTitleForUser(channelId, winner.userId, "flex_champion");
    await progressNpcQuest(channelId, "flex_win", 1);
    await r.del(key);
    return truncate(`⚔️ Flex Battle: ${challenger.displayName} ${challenger.bestAura ? formatRarity(challengerBest) : "None"} vs ${accepter.displayName} ${accepter.bestAura ? formatRarity(accepterBest) : "None"} — ${winner.displayName} wins! ${loser.displayName} gets cooked.`);
  }
  if (!current) return "⚔️ No flex challenge active. Use !flex challenge <user>.";
  const left = Math.max(0, Math.ceil((current.createdAt + FLEX_DURATION_MS - Date.now()) / 1000));
  return `⚔️ Pending: ${current.challengerName} vs ${current.targetName}. ${current.targetName}, use !flex accept. Expires in ${left}s.`;
}
