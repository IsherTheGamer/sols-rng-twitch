import { Redis } from "@upstash/redis";
import type { NextApiRequest } from "next";
import type { AuraDef } from "../types/data";
import type { NightbotUser } from "./nightbot";
import { getViewerProfile, listViewerProfiles } from "./profile";
import { getCoreState, saveCoreState } from "./core-system";
import { formatRarity, truncate } from "./format";
import { addServerBoost, getServerLuckMultiplier } from "./social-system";
import { findEvent, events } from "./data";
import { getChannelState, setChannelState } from "./state";
import { getGlobalRolls, getGlobalLuck, getNextLuckMilestone } from "./global-stats";

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function clean(input: string | undefined | null): string {
  return (input ?? "").trim();
}

function norm(input: string | undefined | null): string {
  return clean(input).toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9_]/g, "");
}

function titleCase(input: string): string {
  return input.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}

function parseAmount(raw: string | undefined | null, fallback = 1): number {
  const value = clean(raw).toLowerCase().replace(/,/g, "");
  const match = value.match(/^(\d+)(k|m|b)?$/);
  if (!match) return fallback;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return fallback;
  if (match[2] === "k") return base * 1000;
  if (match[2] === "m") return base * 1000000;
  if (match[2] === "b") return base * 1000000000;
  return base;
}

function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function weekKey(now = Date.now()): string {
  const d = new Date(now);
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}

function yearKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 4);
}

function periodKey(period: QuestPeriod, now = Date.now()): string {
  if (period === "daily") return todayKey(now);
  if (period === "weekly") return weekKey(now);
  if (period === "monthly") return monthKey(now);
  return yearKey(now);
}

function getUserId(user: NightbotUser | null): string {
  return user?.providerId ?? "anon";
}

function getDisplayName(user: NightbotUser | null): string {
  return user?.displayName ?? user?.name ?? "Player";
}

export type QuestPeriod = "daily" | "weekly" | "monthly" | "yearly";
type QuestMetric = "rolls" | "rare" | "ultra" | "tokens" | "stardust";

interface DiscordSettings {
  enabled: boolean;
  webhookUrl?: string;
  minAuraRarity: number;
  rareBiomes: string[];
  updatedAt: number;
}

interface PeriodStats {
  key: string;
  rolls: number;
  rarePulls: number;
  ultraPulls: number;
  rarityTotal: number;
  bestAura?: { name: string; rarity: number; user: string };
  users: Record<string, { id: string; name: string; rolls: number; rarePulls: number; bestAura?: { name: string; rarity: number } }>;
  updatedAt: number;
}

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

interface RecordsState {
  bestAura?: ReplayPull;
  biggestToday?: ReplayPull;
  mostRollsUser?: { userId: string; userName: string; rolls: number };
  totalRarePulls: number;
  rareBiomes: Record<string, number>;
  updatedAt: number;
}

interface FirstState {
  auras: Record<string, ReplayPull>;
  biomes: Record<string, { biomeId: string; biomeName: string; channelName: string; createdAt: number }>;
}

interface ChannelEvent {
  id: string;
  name: string;
  kind: "luckstorm" | "biome_frenzy" | "meteor" | "stardust" | "festival";
  percent: number;
  createdAt: number;
  expiresAt: number;
  createdBy: string;
}

interface BlackMarketItem {
  id: string;
  name: string;
  price: number;
  kind: "token" | "box" | "material";
  targetId: string;
  amount: number;
  stock: number;
}

interface BlackMarketState {
  spawnedAt: number;
  expiresAt: number;
  stock: BlackMarketItem[];
}

const PERIODS: QuestPeriod[] = ["daily", "weekly", "monthly", "yearly"];
const GLOBAL_QUEST_COMPLETIONS_KEY = "mega:gquest-completions";
const DEFAULT_RARE_BIOMES = ["glitched", "dreamspace", "singularity", "cyberspace", "aurora", "graveyard", "pumpkin_moon", "blazing_sun", "abnormality", "blood_rain", "red_full_moon"];
const AOTD = ["Archangel", "Abyssal Hunter", "Matrix", "Overture", "Bloodlust", "Sovereign", "Symphony", "Apostolos", "Radiant", "Chromatic Genesis", "Ruins", "Gargantua"];
const BOTD = ["starfall", "hell", "corruption", "glitched", "dreamspace", "aurora", "graveyard", "pumpkin_moon", "blazing_sun", "cyberspace", "singularity", "snowy"];

function kDiscord(channelId: string): string { return `mega:discord:${channelId}`; }
function kStats(channelId: string, period: QuestPeriod, key: string): string { return `mega:stats:${channelId}:${period}:${key}`; }
function kGlobalStats(period: QuestPeriod, key: string): string { return `mega:gstats:${period}:${key}`; }
function kReplay(channelId: string): string { return `mega:replay:${channelId}`; }
function kRecords(channelId: string): string { return `mega:records:${channelId}`; }
function kFirsts(channelId: string): string { return `mega:firsts:${channelId}`; }
function kEvent(channelId: string): string { return `mega:event:${channelId}`; }
function kBlack(channelId: string): string { return `mega:blackmarket:${channelId}`; }
function kQuestClaim(channelId: string, userId: string, scope: "player" | "global", period: QuestPeriod, key: string): string { return `mega:qclaim:${channelId}:${userId}:${scope}:${period}:${key}`; }
function kLuckHistory(channelId: string, userId: string): string { return `mega:luck:${channelId}:${userId}`; }

function defaultDiscordSettings(): DiscordSettings {
  return {
    enabled: (process.env.DISCORD_ALERTS_ENABLED ?? "true").toLowerCase() !== "false",
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    minAuraRarity: parseAmount(process.env.DISCORD_MIN_AURA_RARITY, 100000000),
    rareBiomes: (process.env.DISCORD_RARE_BIOMES ?? DEFAULT_RARE_BIOMES.join(",")).split(",").map(norm).filter(Boolean),
    updatedAt: 0,
  };
}

export async function getMegaDiscordSettings(channelId: string): Promise<DiscordSettings> {
  const r = getRedis();
  const base = defaultDiscordSettings();
  if (!r) return base;
  const data = await r.get<Partial<DiscordSettings>>(kDiscord(channelId));
  return {
    ...base,
    ...data,
    rareBiomes: Array.isArray(data?.rareBiomes) && data.rareBiomes.length > 0 ? data.rareBiomes.map(norm).filter(Boolean) : base.rareBiomes,
    minAuraRarity: Math.max(1, Number(data?.minAuraRarity ?? base.minAuraRarity)),
    webhookUrl: data?.webhookUrl ?? base.webhookUrl,
  };
}

async function saveDiscordSettings(channelId: string, settings: DiscordSettings): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(kDiscord(channelId), { ...settings, updatedAt: Date.now() });
}

async function postDiscord(
  channelId: string,
  payload: Record<string, unknown>,
  settingsOverride?: DiscordSettings
): Promise<void> {
  const settings =
    settingsOverride ?? (await getMegaDiscordSettings(channelId));
  if (!settings.enabled || !settings.webhookUrl) return;
  try {
    const res = await fetch(settings.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Sols RNG Alerts", allowed_mentions: { parse: [] }, ...payload }),
    });
    if (!res.ok) console.error("Discord alert failed", res.status, await res.text());
  } catch (err) {
    console.error("Discord alert error", err);
  }
}

function channelUrl(channelName?: string | null): string {
  const name = norm(channelName);
  return name ? `https://twitch.tv/${name}` : "Unknown";
}

export async function formatDcAlerts(channelId: string, channelName: string | null | undefined, query: string, isMod: boolean): Promise<string> {
  const args = query.trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "status").toLowerCase();
  const settings = await getMegaDiscordSettings(channelId);

  if (action === "test") {
    if (!isMod) return "Discord alert test is mod/broadcaster only.";
    await postDiscord(channelId, { embeds: [{ title: "✅ Sols RNG Discord Test", description: `Alerts connected for ${norm(channelName) || channelId}\n${channelUrl(channelName)}`, color: 0x3498db, timestamp: new Date().toISOString() }] });
    return "Discord test alert sent.";
  }

  if (["on", "off"].includes(action)) {
    if (!isMod) return "Discord alert settings are mod/broadcaster only.";
    settings.enabled = action === "on";
    await saveDiscordSettings(channelId, settings);
    return `Discord alerts ${settings.enabled ? "ON" : "OFF"}.`;
  }

  if (action === "aura") {
    if (!isMod) return "Discord alert settings are mod/broadcaster only.";
    const rarity = parseAmount(args[1], settings.minAuraRarity);
    settings.minAuraRarity = Math.max(1, rarity);
    await saveDiscordSettings(channelId, settings);
    return `Discord aura alerts now require ${formatRarity(settings.minAuraRarity)}+.`;
  }

  if (action === "biome") {
    if (!isMod) return "Discord alert settings are mod/broadcaster only.";
    const biome = norm(args[1]);
    const mode = (args[2] ?? "on").toLowerCase();
    if (!biome) return `Rare biomes: ${settings.rareBiomes.join(", ")}`;
    const set = new Set(settings.rareBiomes);
    if (mode === "off" || mode === "remove") set.delete(biome);
    else set.add(biome);
    settings.rareBiomes = [...set];
    await saveDiscordSettings(channelId, settings);
    return `Discord rare biomes: ${settings.rareBiomes.join(", ")}`;
  }

  return truncate(`Discord alerts: ${settings.enabled ? "ON" : "OFF"} | Aura ${formatRarity(settings.minAuraRarity)}+ | Biomes: ${settings.rareBiomes.slice(0, 8).join(", ")}${settings.rareBiomes.length > 8 ? "..." : ""} | !dcalerts test/aura/biome/on/off`);
}

export async function setDiscordWebhookFromAdmin(req: NextApiRequest, channelId: string): Promise<string> {
  const secret = process.env.CRON_SECRET;
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!secret || token !== secret) return "Discord admin locked. Use ?token=CRON_SECRET.";
  const webhook = typeof req.query.webhook === "string" ? req.query.webhook.trim() : "";
  const settings = await getMegaDiscordSettings(channelId);
  if (webhook) settings.webhookUrl = webhook;
  if (typeof req.query.enabled === "string") settings.enabled = !["0", "false", "off", "no"].includes(req.query.enabled.toLowerCase());
  await saveDiscordSettings(channelId, settings);
  return `Discord webhook ${webhook ? "saved" : "unchanged"} for ${channelId}. Enabled=${settings.enabled}.`;
}

function createStats(period: QuestPeriod, key: string): PeriodStats {
  return { key: `${period}:${key}`, rolls: 0, rarePulls: 0, ultraPulls: 0, rarityTotal: 0, users: {}, updatedAt: Date.now() };
}

async function getStats(key: string, period: QuestPeriod, periodValue: string): Promise<PeriodStats> {
  const r = getRedis();
  if (!r) return createStats(period, periodValue);
  return (await r.get<PeriodStats>(key)) ?? createStats(period, periodValue);
}

async function saveStats(key: string, stats: PeriodStats): Promise<void> {
  const r = getRedis();
  if (!r) return;
  stats.updatedAt = Date.now();
  await r.set(key, stats);
}

function updateStats(stats: PeriodStats, userId: string, userName: string, results: Array<{ aura: AuraDef; effectiveRarity: number }>): void {
  const user = stats.users[userId] ?? { id: userId, name: userName, rolls: 0, rarePulls: 0 };
  user.name = userName;
  user.rolls += results.length;
  stats.rolls += results.length;
  for (const result of results) {
    stats.rarityTotal += result.effectiveRarity;
    const rare = result.effectiveRarity >= 100000;
    const ultra = result.effectiveRarity >= 100000000;
    if (rare) { stats.rarePulls++; user.rarePulls++; }
    if (ultra) stats.ultraPulls++;
    if (!stats.bestAura || result.effectiveRarity > stats.bestAura.rarity) stats.bestAura = { name: result.aura.name, rarity: result.effectiveRarity, user: userName };
    if (!user.bestAura || result.effectiveRarity > user.bestAura.rarity) user.bestAura = { name: result.aura.name, rarity: result.effectiveRarity };
  }
  stats.users[userId] = user;
}

async function updateRecords(
  channelId: string,
  userId: string,
  userName: string,
  channelName: string,
  results: Array<{ aura: AuraDef; effectiveRarity: number }>,
  source: "roll" | "potion" | "token",
  profileRolls: number
): Promise<void> {
  const r = getRedis();
  if (!r) return;

  const recordKey = kRecords(channelId);
  const firstKey = kFirsts(channelId);
  const replayKey = kReplay(channelId);

  const [recordRaw, firstRaw, replayRaw] = (await r.mget(
    recordKey,
    firstKey,
    replayKey
  )) as [RecordsState | null, FirstState | null, ReplayPull[] | null];

  const records =
    recordRaw ?? {
      totalRarePulls: 0,
      rareBiomes: {},
      updatedAt: Date.now(),
    };

  const firsts = firstRaw ?? { auras: {}, biomes: {} };
  const replay = replayRaw ?? [];
  const today = todayKey();

  for (const result of results) {
    if (!firsts.auras[result.aura.id]) {
      firsts.auras[result.aura.id] = {
        id: `${Date.now()}:${result.aura.id}:first`,
        userId,
        userName,
        auraId: result.aura.id,
        auraName: result.aura.name,
        rarity: result.effectiveRarity,
        channelName,
        source,
        createdAt: Date.now(),
      };
    }

    if (result.effectiveRarity >= 100000) {
      records.totalRarePulls++;
    }

    if (result.effectiveRarity >= 100000000) {
      const pull: ReplayPull = {
        id: `${Date.now()}:${result.aura.id}:${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        userId,
        userName,
        auraId: result.aura.id,
        auraName: result.aura.name,
        rarity: result.effectiveRarity,
        channelName,
        source,
        createdAt: Date.now(),
      };

      replay.unshift(pull);

      if (!records.bestAura || pull.rarity > records.bestAura.rarity) {
        records.bestAura = pull;
      }

      if (
        !records.biggestToday ||
        todayKey(records.biggestToday.createdAt) !== today ||
        pull.rarity > records.biggestToday.rarity
      ) {
        records.biggestToday = pull;
      }
    }
  }

  if (
    !records.mostRollsUser ||
    profileRolls > records.mostRollsUser.rolls
  ) {
    records.mostRollsUser = {
      userId,
      userName,
      rolls: profileRolls,
    };
  }

  records.updatedAt = Date.now();

  await r.mset({
    [replayKey]: replay.slice(0, 100),
    [recordKey]: records,
    [firstKey]: firsts,
  });
}

export async function recordMegaRolls(options: { channelId: string; channelName?: string | null; user: NightbotUser | null; results: Array<{ aura: AuraDef; effectiveRarity: number }>; source?: "roll" | "potion" | "token"; estimatedLuck?: number; profileRolls?: number; }): Promise<void> {
  if (!options.user) return;
  const r = getRedis();
  if (!r) return;
  const userId = getUserId(options.user);
  const userName = getDisplayName(options.user);
  const channelName = norm(options.channelName) || options.channelId;
  const source = options.source ?? "roll";

  const statEntries = PERIODS.flatMap((period) => {
    const pkey = periodKey(period);

    return [
      {
        key: kStats(options.channelId, period, pkey),
        period,
        pkey,
        userId,
        userName,
      },
      {
        key: kGlobalStats(period, pkey),
        period,
        pkey,
        userId: `${options.channelId}:${userId}`,
        userName: `${channelName}/${userName}`,
      },
    ];
  });

  const statValues = (await r.mget(
    ...statEntries.map((entry) => entry.key)
  )) as Array<PeriodStats | null>;

  const statWrites: Record<string, PeriodStats> = {};

  for (let index = 0; index < statEntries.length; index++) {
    const entry = statEntries[index];
    const stats =
      statValues[index] ?? createStats(entry.period, entry.pkey);

    updateStats(
      stats,
      entry.userId,
      entry.userName,
      options.results
    );

    stats.updatedAt = Date.now();
    statWrites[entry.key] = stats;
  }

  await r.mset(statWrites);

  await updateRecords(
    options.channelId,
    userId,
    userName,
    channelName,
    options.results,
    source,
    options.profileRolls ?? 0
  );

  const best = Math.max(...options.results.map((r) => r.effectiveRarity), 0);
  const estimated = options.estimatedLuck ?? 0;
  if (estimated > 0) {
    const key = kLuckHistory(options.channelId, userId);
    const old = (await r.get<{ bestLuck: number; bestAura: number; updatedAt: number }>(key)) ?? { bestLuck: 0, bestAura: 0, updatedAt: 0 };
    if (estimated > old.bestLuck || best > old.bestAura) await r.set(key, { bestLuck: Math.max(old.bestLuck, estimated), bestAura: Math.max(old.bestAura, best), updatedAt: Date.now() });
  }

  const discordSettings = await getMegaDiscordSettings(options.channelId);
  const top = options.results
    .filter((x) => x.effectiveRarity >= discordSettings.minAuraRarity)
    .sort((a, b) => b.effectiveRarity - a.effectiveRarity)
    .slice(0, 3);

  for (const hit of top) {
    await sendMegaDiscordAuraAlert({
      channelId: options.channelId,
      channelName,
      displayName: userName,
      aura: hit.aura,
      effectiveRarity: hit.effectiveRarity,
      source,
      settings: discordSettings,
    });
  }
}

export async function sendMegaDiscordAuraAlert(options: { channelId: string; channelName?: string | null; displayName: string; aura: AuraDef; effectiveRarity: number; source: "roll" | "potion" | "token"; tierId?: string; settings?: DiscordSettings; }): Promise<void> {
  const settings =
    options.settings ?? (await getMegaDiscordSettings(options.channelId));
  if (options.effectiveRarity < settings.minAuraRarity && options.tierId !== "dev-exclusive") return;
  const channel = norm(options.channelName) || options.channelId;
  await postDiscord(
    options.channelId,
    {
      embeds: [
        {
          title:
            options.tierId === "dev-exclusive"
              ? "📌 DEV-EXCLUSIVE Aura Pulled!"
              : "🌌 Rare Aura Pulled!",
          description: `**${options.displayName}** ${
            options.source === "potion" ? "popped and got" : "rolled"
          } **${options.aura.name}**`,
          color:
            options.tierId === "dev-exclusive"
              ? 0xffd700
              : 0x9b59b6,
          fields: [
            {
              name: "Aura",
              value: options.aura.name,
              inline: true,
            },
            {
              name: "Rarity",
              value: formatRarity(options.effectiveRarity),
              inline: true,
            },
            {
              name: "Player",
              value: options.displayName,
              inline: true,
            },
            {
              name: "Twitch Channel",
              value: `${channel}\n${channelUrl(channel)}`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    },
    settings
  );
}

export async function recordMegaBiome(options: { channelId: string; channelName?: string | null; biomeId: string; timeOfDay?: string | null; expiresAt?: number; }): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const settings = await getMegaDiscordSettings(options.channelId);
  const biomeId = norm(options.biomeId);
  if (!settings.rareBiomes.includes(biomeId)) return;
  const dupKey = `mega:lastbiome:${options.channelId}`;
  const marker = `${biomeId}:${options.expiresAt ?? 0}`;
  if ((await r.get<string>(dupKey)) === marker) return;
  await r.set(dupKey, marker, { ex: 60 * 60 * 6 });

  const firsts = (await r.get<FirstState>(kFirsts(options.channelId))) ?? { auras: {}, biomes: {} };
  if (!firsts.biomes[biomeId]) firsts.biomes[biomeId] = { biomeId, biomeName: titleCase(biomeId), channelName: norm(options.channelName) || options.channelId, createdAt: Date.now() };
  await r.set(kFirsts(options.channelId), firsts);
  const records = (await r.get<RecordsState>(kRecords(options.channelId))) ?? { totalRarePulls: 0, rareBiomes: {}, updatedAt: Date.now() };
  records.rareBiomes[biomeId] = (records.rareBiomes[biomeId] ?? 0) + 1;
  records.updatedAt = Date.now();
  await r.set(kRecords(options.channelId), records);

  const channel = norm(options.channelName) || options.channelId;
  await postDiscord(options.channelId, { embeds: [{ title: "🌍 Rare Biome Spawned!", description: `**${titleCase(biomeId)}** spawned in **${channel}**`, color: 0x2ecc71, fields: [ { name: "Biome", value: titleCase(biomeId), inline: true }, { name: "Time", value: options.timeOfDay ? titleCase(options.timeOfDay) : "Unknown", inline: true }, { name: "Twitch Channel", value: `${channel}\n${channelUrl(channel)}`, inline: false } ], timestamp: new Date().toISOString() }] });
}

function questsFor(period: QuestPeriod, scope: "player" | "global"): Array<{ id: string; name: string; metric: QuestMetric; target: number; reward: string }> {
  const mult = period === "daily" ? 1 : period === "weekly" ? 7 : period === "monthly" ? 30 : 365;
  const scale = scope === "global" ? 10 : 1;
  return [
    { id: `${period}_rolls`, name: `${titleCase(period)} Roller`, metric: "rolls", target: 100 * mult * scale, reward: scope === "global" ? `+10% server luck event` : `${100 * mult} Stardust` },
    { id: `${period}_rare`, name: `${titleCase(period)} Rare Hunt`, metric: "rare", target: Math.max(3, 5 * mult * scale), reward: scope === "global" ? `Black Market spawn chance` : `Quest Box x${Math.max(1, Math.floor(mult / 3))}` },
    { id: `${period}_ultra`, name: `${titleCase(period)} Miracle`, metric: "ultra", target: Math.max(1, Math.floor(mult / 7) * scale), reward: scope === "global" ? `+25% server luck 10m` : `Recipe Token x1` },
  ];
}

function metricValue(stats: PeriodStats, metric: QuestMetric, userId?: string): number {
  if (userId) {
    const user = stats.users[userId];
    if (!user) return 0;
    if (metric === "rolls") return user.rolls;
    if (metric === "rare") return user.rarePulls;
    if (metric === "ultra") return (user.bestAura?.rarity ?? 0) >= 100000000 ? 1 : 0;
  }
  if (metric === "rolls") return stats.rolls;
  if (metric === "rare") return stats.rarePulls;
  if (metric === "ultra") return stats.ultraPulls;
  return 0;
}

export async function formatPlayerQuests(channelId: string, user: NightbotUser | null, query: string): Promise<string> {
  if (!user) return "Player quests only work from Twitch chat.";
  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const period = (PERIODS.includes(parts[0] as QuestPeriod) ? parts[0] : "daily") as QuestPeriod;
  const key = periodKey(period);
  const stats = await getStats(kStats(channelId, period, key), period, key);
  const list = questsFor(period, "player");
  const userId = getUserId(user);
  if (parts[1] === "claim") return claimQuest(channelId, user, "player", period, key, stats, list);
  const shown = list.map((q) => `${q.name} ${Math.min(metricValue(stats, q.metric, userId), q.target)}/${q.target} → ${q.reward}`).join(" | ");
  return truncate(`🧾 ${titleCase(period)} Player Quests: ${shown} | !pquests ${period} claim`);
}

export async function formatGlobalQuests(channelId: string, user: NightbotUser | null, query: string): Promise<string> {
  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const period = (PERIODS.includes(parts[0] as QuestPeriod) ? parts[0] : "daily") as QuestPeriod;
  const key = periodKey(period);
  const stats = await getStats(kGlobalStats(period, key), period, key);
  const list = questsFor(period, "global");
  if (parts[1] === "claim") return claimQuest(channelId, user, "global", period, key, stats, list);
  const shown = list.map((q) => `${q.name} ${Math.min(metricValue(stats, q.metric), q.target)}/${q.target} → ${q.reward}`).join(" | ");
  return truncate(`🌐 ${titleCase(period)} Global Quests: ${shown} | !gquests ${period} claim`);
}

type MegaQuestClaimDef = {
  id: string;
  name: string;
  metric: QuestMetric;
  target: number;
  reward: string;
};

function addCoreReward(
  bag: Record<string, number>,
  id: string,
  amount: number
): void {
  if (amount <= 0) return;
  bag[id] = (bag[id] ?? 0) + amount;
}

function grantPlayerMegaQuestReward(
  core: Awaited<ReturnType<typeof getCoreState>>,
  quest: MegaQuestClaimDef,
  period: QuestPeriod
): string {
  const mult =
    period === "daily"
      ? 1
      : period === "weekly"
      ? 7
      : period === "monthly"
      ? 30
      : 365;

  if (quest.metric === "rolls") {
    const amount = 100 * mult;
    core.stardust += amount;
    core.stats.stardustCollected += amount;
    return `${fmt(amount)} Stardust`;
  }

  if (quest.metric === "rare") {
    const amount = Math.max(1, Math.floor(mult / 3));
    addCoreReward(core.lootboxes, "quest_box", amount);
    return `Quest Box x${amount}`;
  }

  addCoreReward(core.tokens, "recipe_token", 1);
  return "Recipe Token x1";
}

async function activateGlobalMegaQuestReward(
  r: NonNullable<ReturnType<typeof getRedis>>,
  channelId: string,
  period: QuestPeriod,
  key: string,
  quest: MegaQuestClaimDef
): Promise<string> {
  const activationKey = `mega:global-reward:${period}:${key}:${quest.id}`;
  const activated = await r.set(activationKey, "1", {
    nx: true,
    ex: 60 * 60 * 24 * 370,
  });

  if (!activated) {
    return `${quest.reward} (already activated; contribution recorded)`;
  }

  if (quest.metric === "rolls") {
    await addServerBoost({
      channelId,
      name: `${titleCase(period)} Global Quest`,
      percent: 10,
      durationSeconds: 10 * 60,
      source: "global quest reward",
    });

    return "+10% server luck for 10m";
  }

  if (quest.metric === "rare") {
    const now = Date.now();
    await setBlack(channelId, {
      spawnedAt: now,
      expiresAt: now + 5 * 60 * 1000,
      stock: blackStock(now),
    });

    return "Black Market spawned for 5m";
  }

  await addServerBoost({
    channelId,
    name: `${titleCase(period)} Global Miracle`,
    percent: 25,
    durationSeconds: 10 * 60,
    source: "global quest reward",
  });

  return "+25% server luck for 10m";
}

async function claimQuest(
  channelId: string,
  user: NightbotUser | null,
  scope: "player" | "global",
  period: QuestPeriod,
  key: string,
  stats: PeriodStats,
  list: MegaQuestClaimDef[]
): Promise<string> {
  if (!user) return "Claim only works from Twitch chat.";

  const r = getRedis();
  if (!r) return "Quest database is not connected.";

  const userId = getUserId(user);
  const done = list.filter(
    (quest) =>
      metricValue(
        stats,
        quest.metric,
        scope === "player" ? userId : undefined
      ) >= quest.target
  );

  if (done.length === 0) return "No completed quests to claim yet.";

  const claimedKey = kQuestClaim(channelId, userId, scope, period, key);
  const claimed = new Set((await r.get<string[]>(claimedKey)) ?? []);
  const fresh = done.filter((quest) => !claimed.has(quest.id));

  if (fresh.length === 0) {
    return `Already claimed completed ${scope} ${period} quests.`;
  }

  const core = await getCoreState(channelId, user);
  const rewardLines: string[] = [];

  for (const quest of fresh) {
    claimed.add(quest.id);

    if (scope === "player") {
      rewardLines.push(
        `${quest.name}: ${grantPlayerMegaQuestReward(core, quest, period)}`
      );
    } else {
      await r.incrby(GLOBAL_QUEST_COMPLETIONS_KEY, 1);
      rewardLines.push(
        `${quest.name}: ${await activateGlobalMegaQuestReward(
          r,
          channelId,
          period,
          key,
          quest
        )}`
      );
    }
  }

  await saveCoreState(core);
  await r.set(claimedKey, [...claimed]);

  return truncate(
    `✅ Claimed ${fresh.length} ${scope} ${period} quest reward(s) | ${rewardLines.join(
      " | "
    )}`
  );
}

export async function formatReplay(channelId: string, query: string): Promise<string> {
  const r = getRedis();
  if (!r) return "Replay database is not connected.";
  const parts = query.trim().split(/\s+/).filter(Boolean);
  const target = /^\d+$/.test(parts[0] ?? "") ? "" : norm(parts[0]);
  const page = Math.max(1, parseAmount(target ? parts[1] : parts[0], 1));
  let pulls = (await r.get<ReplayPull[]>(kReplay(channelId))) ?? [];
  if (target) pulls = pulls.filter((p) => norm(p.userName) === target);
  if (pulls.length === 0) return target ? `No major replay pulls for ${target}.` : "No major replay pulls yet.";
  const size = 4;
  const total = Math.max(1, Math.ceil(pulls.length / size));
  const safe = Math.min(page, total);
  return truncate(`🎬 Rare Replay ${safe}/${total}: ${pulls.slice((safe - 1) * size, safe * size).map((p) => `${p.userName} ${p.auraName} ${formatRarity(p.rarity)}`).join(" | ")}`);
}

export async function formatRecords(channelId: string): Promise<string> {
  const r = getRedis();
  if (!r) return "Records database is not connected.";
  const rec = (await r.get<RecordsState>(kRecords(channelId))) ?? { totalRarePulls: 0, rareBiomes: {}, updatedAt: Date.now() };
  const biomeTop = Object.entries(rec.rareBiomes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${titleCase(id)} x${n}`).join(", ") || "None";
  return truncate(`🏛️ Records: Best ${rec.bestAura ? `${rec.bestAura.auraName} ${formatRarity(rec.bestAura.rarity)} by ${rec.bestAura.userName}` : "None"} | Most Rolls ${rec.mostRollsUser ? `${rec.mostRollsUser.userName} ${fmt(rec.mostRollsUser.rolls)}` : "None"} | Rare Pulls ${fmt(rec.totalRarePulls)} | Biomes ${biomeTop}`);
}

export async function formatFirsts(channelId: string, query: string): Promise<string> {
  const r = getRedis();
  if (!r) return "Firsts database is not connected.";
  const firsts = (await r.get<FirstState>(kFirsts(channelId))) ?? { auras: {}, biomes: {} };
  const mode = query.trim().toLowerCase().split(/\s+/)[0] ?? "auras";
  if (mode.startsWith("bio")) {
    const rows = Object.values(firsts.biomes).slice(-6).reverse().map((b) => `${b.biomeName} in ${b.channelName}`);
    return truncate(`🌍 First Biomes: ${rows.join(" | ") || "None yet"}`);
  }
  const rows = Object.values(firsts.auras).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6).map((p) => `${p.auraName} by ${p.userName}`);
  return truncate(`🥇 First Discoveries: ${rows.join(" | ") || "None yet"}`);
}

function dailyIndex(seed: string, len: number): number {
  let n = 0;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return n % len;
}

export function formatAuraOfDay(): string {
  const key = todayKey();
  const aura = AOTD[dailyIndex(key, AOTD.length)];
  return `🌟 Aura of the Day: ${aura} | Event flavor bonus today. Full chance boost can be added later in roll-engine.`;
}

export function formatBiomeOfDay(): string {
  const key = todayKey();
  const biome = BOTD[dailyIndex(key, BOTD.length)];
  return `🌍 Biome of the Day: ${titleCase(biome)} | Watch for boosted event/quest bonuses today.`;
}

function blackStock(seed: number): BlackMarketItem[] {
  const all: BlackMarketItem[] = [
    { id: "void_box", name: "Void Box", price: 25000, kind: "box", targetId: "anomaly_box", amount: 1, stock: 2 },
    { id: "reactor_token", name: "Reactor Token", price: 40000, kind: "token", targetId: "reactor_token", amount: 1, stock: 1 },
    { id: "anomaly_token", name: "Anomaly Token", price: 65000, kind: "token", targetId: "anomaly_token", amount: 1, stock: 1 },
    { id: "matrix_pack", name: "Matrix Pack", price: 12000, kind: "material", targetId: "reality_thread", amount: 25, stock: 3 },
    { id: "singularity_pack", name: "Singularity Pack", price: 50000, kind: "material", targetId: "singularity_shard", amount: 5, stock: 2 },
  ];
  return all.sort((a, b) => ((seed + a.id.length) % 11) - ((seed + b.id.length) % 11)).slice(0, 4);
}

async function getBlack(channelId: string): Promise<BlackMarketState | null> {
  const r = getRedis();
  if (!r) return null;
  const state = await r.get<BlackMarketState>(kBlack(channelId));
  if (!state || state.expiresAt <= Date.now()) return null;
  return state;
}
async function setBlack(channelId: string, state: BlackMarketState | null): Promise<void> {
  const r = getRedis();
  if (!r) return;
  if (!state) await r.del(kBlack(channelId)); else await r.set(kBlack(channelId), state);
}

export async function formatBlackMarket(channelId: string, user: NightbotUser | null, query: string, isMod: boolean): Promise<string> {
  const args = query.trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "status").toLowerCase();
  if (action === "spawn") {
    if (!isMod) return "Black Market spawn is mod/broadcaster only.";
    const now = Date.now();
    await setBlack(channelId, { spawnedAt: now, expiresAt: now + 5 * 60 * 1000, stock: blackStock(now) });
    return "🕶️ Black Market spawned for 5m. Use !blackmarket.";
  }
  const state = await getBlack(channelId);
  if (!state) return "🕶️ No Black Market active. Mods can use !blackmarket spawn.";
  if (action === "buy") {
    if (!user) return "Black Market buy only works from Twitch chat.";
    const id = norm(args[1]);
    const amount = Math.max(1, Math.min(3, parseAmount(args[2], 1)));
    const item = state.stock.find((x) => x.id === id || norm(x.name) === id);
    if (!item) return `Not sold. Stock: ${state.stock.map((x) => x.id).join(", ")}`;
    if (item.stock < amount) return `${item.name} stock ${item.stock}/${amount}.`;
    const core = await getCoreState(channelId, user);
    const cost = item.price * amount;
    if (core.stardust < cost) return `Need ${fmt(cost)} Stardust. You have ${fmt(core.stardust)}.`;
    core.stardust -= cost;
    item.stock -= amount;
    if (item.kind === "material") core.materials[item.targetId] = (core.materials[item.targetId] ?? 0) + item.amount * amount;
    if (item.kind === "token") core.tokens[item.targetId] = (core.tokens[item.targetId] ?? 0) + item.amount * amount;
    if (item.kind === "box") core.lootboxes[item.targetId] = (core.lootboxes[item.targetId] ?? 0) + item.amount * amount;
    await saveCoreState(core);
    await setBlack(channelId, state);
    return `✅ Bought ${item.name} x${amount} for ${fmt(cost)} Stardust.`;
  }
  const left = Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000));
  return truncate(`🕶️ Black Market ${Math.floor(left / 60)}m${left % 60}s: ${state.stock.filter((x) => x.stock > 0).map((x) => `${x.id}: ${x.name} ${fmt(x.price)}sd stock ${x.stock}`).join(" | ") || "Sold out"}`);
}


function findSeasonalEventForCommand(raw: string) {
  const q = clean(raw);
  if (!q) return undefined;
  return findEvent(q) ?? findEvent(q.replace(/_/g, " "));
}

function seasonalEventName(id: string): string {
  return findEvent(id)?.name ?? titleCase(id);
}

function seasonalEventIdsLabel(ids: string[]): string {
  if (ids.length === 0) return "none";
  return ids.map(seasonalEventName).join(", ");
}

function seasonalEventListText(): string {
  return events.map((event) => event.id).join(", ");
}

async function activateSeasonalEvent(channelId: string, user: NightbotUser | null, raw: string, isMod: boolean): Promise<string> {
  if (!isMod) return "Seasonal event activation is mod/broadcaster only.";
  const event = findSeasonalEventForCommand(raw);
  if (!event) {
    return `Unknown seasonal event. Try: ${events.slice(-8).map((e) => e.id).join(", ")}`;
  }
  const state = await getChannelState(channelId);
  const set = new Set(state.activeEvents ?? []);
  const alreadyActive = set.has(event.id);
  set.add(event.id);
  state.activeEvents = [...set];
  await setChannelState(state);
  const biomes = event.eventBiomes?.length ? ` | Event biomes: ${event.eventBiomes.join(", ")}` : "";
  return `${alreadyActive ? "✅ Already active" : "✅ Event activated"}: ${event.name} | Event auras enabled${biomes}. Use !event stop ${event.id} to disable.`;
}

async function deactivateSeasonalEvent(channelId: string, raw: string, isMod: boolean): Promise<string> {
  if (!isMod) return "Seasonal event stop is mod/broadcaster only.";
  const state = await getChannelState(channelId);
  const target = clean(raw).toLowerCase();
  if (target === "all" || target === "seasonal" || target === "events" || target === "all_events") {
    const count = state.activeEvents?.length ?? 0;
    state.activeEvents = [];
    await setChannelState(state);
    return `✅ Stopped ${count} seasonal event(s).`;
  }
  const event = findSeasonalEventForCommand(raw);
  if (!event) return "Unknown seasonal event. Use !event list.";
  const before = state.activeEvents ?? [];
  state.activeEvents = before.filter((id) => id !== event.id);
  await setChannelState(state);
  return before.includes(event.id)
    ? `✅ Event disabled: ${event.name}.`
    : `${event.name} was not active.`;
}

export async function formatChannelEvent(channelId: string, user: NightbotUser | null, query: string, isMod: boolean): Promise<string> {
  const r = getRedis();
  if (!r) return "Event database is not connected.";

  const args = query.trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "status").toLowerCase();

  // Old compatibility: !event summer_2025, !event halloween_2025, etc.
  // This activates seasonal aura/event IDs in ChannelState.activeEvents.
  const directSeasonal = findSeasonalEventForCommand(query);
  if (directSeasonal && !["status", "start", "stop", "end", "off", "disable", "list", "events", "seasonal"].includes(action)) {
    return activateSeasonalEvent(channelId, user, query, isMod);
  }

  if (action === "list" || action === "events" || action === "seasonal") {
    const state = await getChannelState(channelId);
    return truncate(`🎉 Seasonal Events | Active: ${seasonalEventIdsLabel(state.activeEvents ?? [])} | Available: ${seasonalEventListText()}`, 390);
  }

  if (action === "start") {
    if (!isMod) return "Event start is mod/broadcaster only.";

    const target = args.slice(1).join(" ");
    const seasonal = findSeasonalEventForCommand(target);

    if (seasonal) {
      return activateSeasonalEvent(channelId, user, target, isMod);
    }

    const kind = (args[1] ?? "luckstorm").toLowerCase() as ChannelEvent["kind"];
    const mins = Math.max(1, Math.min(120, parseAmount(args[2], 10)));
    const percent = kind === "luckstorm" ? 25 : kind === "festival" ? 15 : 10;
    const event: ChannelEvent = { id: `${kind}:${Date.now()}`, name: titleCase(kind), kind, percent, createdAt: Date.now(), expiresAt: Date.now() + mins * 60 * 1000, createdBy: getDisplayName(user) };
    await r.set(kEvent(channelId), event);
    return `🎉 Event started: ${event.name} +${event.percent}% for ${mins}m.`;
  }

  if (action === "on" || action === "enable" || action === "activate") {
    return activateSeasonalEvent(channelId, user, args.slice(1).join(" "), isMod);
  }

  if (action === "stop" || action === "end" || action === "off" || action === "disable") {
    if (!isMod) return "Event stop is mod/broadcaster only.";

    const target = args.slice(1).join(" ");
    if (target) {
      const seasonal = findSeasonalEventForCommand(target);
      if (seasonal || ["all", "seasonal", "events", "all_events"].includes(target.toLowerCase())) {
        return deactivateSeasonalEvent(channelId, target, isMod);
      }
    }

    await r.del(kEvent(channelId));
    return "🎉 Channel event stopped.";
  }

  const state = await getChannelState(channelId);
  const seasonalText = `Seasonal: ${seasonalEventIdsLabel(state.activeEvents ?? [])}`;
  const event = await getActiveChannelEvent(channelId);

  if (!event) {
    return truncate(`🎉 No channel boost event active. ${seasonalText}. Mods: !event summer_2025 OR !event start luckstorm 10`, 390);
  }

  const left = Math.ceil((event.expiresAt - Date.now()) / 1000);
  return truncate(`🎉 Boost Event: ${event.name} +${event.percent}% | ${Math.floor(left / 60)}m${left % 60}s left | ${seasonalText}`, 390);
}

export async function getActiveChannelEvent(channelId: string): Promise<ChannelEvent | null> {
  const r = getRedis();
  if (!r) return null;
  const event = await r.get<ChannelEvent>(kEvent(channelId));
  if (!event || event.expiresAt <= Date.now()) return null;
  return event;
}

export async function getMegaLuckMultiplier(channelId: string): Promise<{ percent: number; multiplier: number; label: string }> {
  const event = await getActiveChannelEvent(channelId);
  if (!event || !["luckstorm", "biome_frenzy", "festival"].includes(event.kind)) {
    return { percent: 0, multiplier: 1, label: "No mega event luck" };
  }
  return { percent: event.percent, multiplier: 1 + event.percent / 100, label: `${event.name} +${event.percent}%` };
}

export async function formatWeeklyLeaderboard(channelId: string, query: string): Promise<string> {
  return formatMegaLeaderboard(channelId, `weekly ${query}`.trim());
}

export async function formatMegaLeaderboard(channelId: string, query: string): Promise<string> {
  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const period = (PERIODS.includes(parts[0] as QuestPeriod) ? parts[0] : "all") as QuestPeriod | "all";
  const mode = period === "all" ? (parts[0] ?? "rolls") : (parts[1] ?? "rolls");
  const pageRaw = period === "all" ? parts[1] : parts[2];
  const page = Math.max(1, parseAmount(pageRaw, 1));
  let rows: Array<{ name: string; rolls: number; rarePulls: number; value: number; best?: { name: string; rarity: number } }> = [];
  if (period === "all") {
    const profiles = await listViewerProfiles(channelId);
    rows = profiles.map((p) => ({ name: p.displayName, rolls: p.rolls + p.tokenRolls, rarePulls: 0, value: p.rarityTotal, best: p.bestAura ? { name: p.bestAura.auraName, rarity: p.bestAura.rarity } : undefined }));
  } else {
    const stats = await getStats(kStats(channelId, period, periodKey(period)), period, periodKey(period));
    rows = Object.values(stats.users).map((u) => ({ name: u.name, rolls: u.rolls, rarePulls: u.rarePulls, value: u.bestAura?.rarity ?? 0, best: u.bestAura }));
  }
  if (rows.length === 0) return "No leaderboard data yet.";
  rows.sort((a, b) => mode === "best" ? (b.best?.rarity ?? 0) - (a.best?.rarity ?? 0) : mode === "rare" ? b.rarePulls - a.rarePulls : mode === "value" ? b.value - a.value : b.rolls - a.rolls);
  const size = 5;
  const total = Math.max(1, Math.ceil(rows.length / size));
  const safe = Math.min(page, total);
  const shown = rows.slice((safe - 1) * size, safe * size).map((r, i) => {
    const rank = (safe - 1) * size + i + 1;
    if (mode === "best") return `${rank}. ${r.name} ${r.best ? `${r.best.name} ${formatRarity(r.best.rarity)}` : "None"}`;
    if (mode === "rare") return `${rank}. ${r.name} ${fmt(r.rarePulls)} rare`;
    if (mode === "value") return `${rank}. ${r.name} ${fmt(r.value)}`;
    return `${rank}. ${r.name} ${fmt(r.rolls)} rolls`;
  });
  return truncate(`🏆 ${period === "all" ? "All-Time" : titleCase(period)} ${titleCase(mode)} LB ${safe}/${total}: ${shown.join(" | ")}`);
}

export async function formatLuckDetails(channelId: string, user: NightbotUser | null): Promise<string> {
  if (!user) return "Luck details only work from Twitch chat.";
  const globalRolls = await getGlobalRolls();
  const globalLuck = getGlobalLuck(globalRolls + 1);
  const server = await getServerLuckMultiplier(channelId);
  const mega = await getMegaLuckMultiplier(channelId);
  const core = await import("./core-system").then((m) => m.getViewerCoreLuck(channelId, user));
  const estimated = globalLuck * core.multiplier * server.multiplier * mega.multiplier;
  const r = getRedis();
  const hist = r ? await r.get<{ bestLuck: number; bestAura: number }>(kLuckHistory(channelId, getUserId(user))) : null;
  const milestone = getNextLuckMilestone(globalRolls);
  return truncate(`🍀 Luck Details: estimated x${fmt(estimated)} | Global x${globalLuck.toFixed(1)} | Core ${core.label} | Server +${server.percent}% | Event +${mega.percent}% | Best Luck x${fmt(hist?.bestLuck ?? 0)} | Next global x${milestone.nextLuck.toFixed(1)} in ${fmt(milestone.remaining)} rolls`);
}

export async function postDiscordSummary(channelId: string, channelName: string, period: QuestPeriod): Promise<string> {
  const stats = await getStats(kStats(channelId, period, periodKey(period)), period, periodKey(period));
  const rows = Object.values(stats.users).sort((a, b) => b.rolls - a.rolls).slice(0, 5).map((u, i) => `${i + 1}. ${u.name} ${fmt(u.rolls)} rolls`).join("\n") || "No rollers yet";
  await postDiscord(channelId, { embeds: [{ title: `📊 ${titleCase(period)} Sols RNG Summary`, description: `Channel: **${channelName}**\n${channelUrl(channelName)}`, color: 0x5865f2, fields: [ { name: "Rolls", value: fmt(stats.rolls), inline: true }, { name: "Rare Pulls", value: fmt(stats.rarePulls), inline: true }, { name: "Best Aura", value: stats.bestAura ? `${stats.bestAura.name} ${formatRarity(stats.bestAura.rarity)} by ${stats.bestAura.user}` : "None", inline: false }, { name: "Top Rollers", value: rows, inline: false } ], timestamp: new Date().toISOString() }] });
  return `${titleCase(period)} Discord summary sent for ${channelName}.`;
}
