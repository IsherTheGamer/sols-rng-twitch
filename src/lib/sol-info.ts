import { auras, biomes, potions, events, devEvents, devices } from "./data";
import { getAllTokenDefinitions, formatTokenDefinitionPage } from "./inventory";
import { truncate } from "./format";
import {
  formatBoxGuide,
  formatComponentGuide,
  formatMaterialGuide,
  formatObtainGuide,
  formatTokenSourceGuide,
  isKnownTokenGuide,
} from "./progression-info";

const PAGE_SIZE = 8;

const ACTIVITY_INFO = [
  "The Activity Of Knowledge commands:",
  "!knowledge = Knowledge, Research, Scanner, Merchant Marks, and Relic Shards.",
  "!research branches / <branch> / info <id> / unlock <id>.",
  "!scanner = activity signals, boss/event data, and best-action hints.",
  "!boss = active boss. Mods can use !boss start.",
  "!worldevent = current Activity world event.",
  "!forecast = activity-based forecast, not an exact prediction.",
  "!market = safe Merchant Marks marketplace.",
  "!blueprints = blueprint unlocks and sources.",
  "!relics = relic catalog, forge, collect, equip, info, and reroll.",
  "Website: /activity",
];

const COMMAND_INFO = [
  "!update [page]: latest changes and balance notes",
  "!info sol commands [page]: command help",
  "!info material <name>: exact obtain source",
  "!info component <name_tier>: how to craft it",
  "!info token sources [page]: Core token sources",
  "!info box <name>: box source and contents",
  "!info obtain <item>: search material/token/box/component",
  "!rollaccess add/remove/list/check: 10k allowlist, managers only",
  "!dcalerts: Discord webhook alert settings",
  "Discord: /sols info, material, leaderboard, records, firsts, alerts, rollaccess",
  "!replay [user/page]: major rare pull replay",
  "!records: channel records and best pulls",
  "!firsts / !firsts biomes: first discoveries",
  "!aotd / !botd: aura/biome of the day",
  "!event: seasonal and channel event controls",
  "!pquests and !gquests: personal/global quests",
  "!lb daily/weekly/monthly/yearly rolls/best/rare/value",
];

const MEGA_INFO = [
  "Discord: !dcalerts test/on/off/aura/biome controls webhook alerts.",
  "Discord website: /discord-test safely previews the real aura alert style.",
  "Discord /sols commands mirror read-only info/leaderboards plus admin config.",
  "Replay/records: !replay shows 100M+ pulls; !records shows server records.",
  "Firsts: !firsts shows first aura and rare-biome discoveries.",
  "Quests: !pquests and !gquests have daily, weekly, monthly, yearly periods.",
  "Leaderboards support rolls, best, rare, value, level, and pages.",
  "Black Market uses Stardust and remains Twitch-only gameplay.",
];

function normalize(raw: string | undefined | null): string {
  return (raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/^!+/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleCase(raw: string): string {
  return raw
    .split(/[_\-\s:]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function rarity(value: number): string {
  return `1/${Math.floor(value).toLocaleString("en-US")}`;
}

function pageNumber(raw: string | undefined, totalPages: number): number {
  const n = Number(String(raw ?? "1").replace(/,/g, ""));
  return Math.max(1, Math.min(totalPages, Number.isFinite(n) ? Math.floor(n) : 1));
}

function paginate<T>(
  items: T[],
  rawPage: string | undefined,
  formatter: (item: T) => string,
  title: string,
  pageSize = PAGE_SIZE
): string {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = pageNumber(rawPage, totalPages);
  const shown = items.slice((page - 1) * pageSize, page * pageSize).map(formatter);
  return truncate(`${title} ${page}/${totalPages}: ${shown.join(" | ") || "None"}`, 390);
}

function splitQueryPage(parts: string[]): { query: string; page: string } {
  const copy = [...parts];
  let page = "";

  if (copy.length > 1 && /^\d+$/.test(copy[copy.length - 1])) {
    page = copy.pop() ?? "";
  }

  return { query: copy.join(" "), page };
}

function findAura(query: string) {
  const q = normalize(query);
  return auras.find(
    (a) =>
      normalize(a.id) === q ||
      normalize(a.name) === q ||
      normalize(a.name).replace(/_/g, "") === q.replace(/_/g, "")
  );
}

function findBiome(query: string) {
  const q = normalize(query);
  return biomes.find((b) => normalize(b.id) === q || normalize(b.name) === q);
}

function findPotion(query: string) {
  const q = normalize(query);
  return potions.find(
    (p) =>
      normalize(p.id) === q ||
      normalize(p.name) === q ||
      p.aliases.some((a) => normalize(a) === q)
  );
}

function auraInfo(query: string, pageRaw?: string): string {
  if (query && !/^\d+$/.test(query)) {
    const aura = findAura(query);
    if (!aura) return `Unknown aura: ${query}`;

    const flags = [
      aura.biome ? `Biome ${titleCase(aura.biome)}` : null,
      aura.event ? `Event ${titleCase(aura.event)}` : null,
      aura.devBiome ? `Dev ${titleCase(aura.devBiome)}` : null,
      aura.potion ? `Potion ${titleCase(aura.potion.id)} ${rarity(aura.potion.rarity)}` : null,
      aura.luckImmune ? "Raw luck only" : null,
      aura.unobtainable ? "Unobtainable" : null,
      aura.deleted ? "Deleted" : null,
    ].filter(Boolean);

    return truncate(
      `✨ ${aura.name} | ${rarity(aura.rarity)}${flags.length ? ` | ${flags.join(" | ")}` : ""}`,
      390
    );
  }

  const page = /^\d+$/.test(query) ? query : pageRaw;
  return paginate(
    [...auras].sort((a, b) => a.rarity - b.rarity),
    page,
    (a) => `${a.name} ${rarity(a.rarity)}`,
    "✨ Auras"
  );
}

function biomeInfo(query: string, pageRaw?: string): string {
  if (query && !/^\d+$/.test(query)) {
    const biome = findBiome(query);
    if (!biome) return `Unknown biome: ${query}`;

    const chance = biome.spawnPerSecond
      ? `Spawn/sec 1/${Math.round(1 / biome.spawnPerSecond).toLocaleString("en-US")}`
      : biome.spawnOnChange
      ? `On-change 1/${Math.round(1 / biome.spawnOnChange).toLocaleString("en-US")}`
      : biome.deviceChance
      ? `Device 1/${biome.deviceChance.toLocaleString("en-US")}`
      : biome.manualOnly || biome.devOnly
      ? "Manual/dev only"
      : "Normal pool";

    return truncate(
      `🌍 ${biome.name} | ${chance} | BT x${biome.breakthroughMultiplier}${biome.isRareBiome ? " | Rare" : ""}`,
      390
    );
  }

  const page = /^\d+$/.test(query) ? query : pageRaw;
  return paginate(
    biomes,
    page,
    (b) => `${b.name}${b.isRareBiome ? " rare" : ""}`,
    "🌍 Biomes"
  );
}

function potionInfo(query: string, pageRaw?: string): string {
  if (query && !/^\d+$/.test(query)) {
    const potion = findPotion(query);
    if (!potion) return `Unknown potion: ${query}`;

    const extras = [
      potion.clearsBuffs ? "Clears buffs" : null,
      potion.requiresEvent ? `Event ${titleCase(potion.requiresEvent)}` : null,
      potion.exclusiveAuras?.length ? `${potion.exclusiveAuras.length} exclusive aura(s)` : null,
    ].filter(Boolean);

    return truncate(
      `🧪 ${potion.name} | +${Math.floor(potion.luck).toLocaleString("en-US")} luck${extras.length ? ` | ${extras.join(" | ")}` : ""}`,
      390
    );
  }

  const page = /^\d+$/.test(query) ? query : pageRaw;
  return paginate(
    potions,
    page,
    (p) => `${p.name} +${Math.floor(p.luck).toLocaleString("en-US")}`,
    "🧪 Potions"
  );
}

function tokenInfo(kind: string, pageRaw?: string): string {
  const mode = normalize(kind || "boosts");
  const all = getAllTokenDefinitions();
  const special = (t: (typeof all)[number]) =>
    Boolean(
      (t.flatLuck ?? 0) > 0 ||
        (t.rareBiomePercentLuck ?? 0) > 0 ||
        (t.finalLuckMultiplier ?? 1) > 1
    );

  const list =
    mode.includes("potion") || mode.includes("roll")
      ? all.filter((t) => t.kind === "potion")
      : mode.includes("special") ||
        mode.includes("rare") ||
        mode.includes("flat") ||
        mode.includes("final")
      ? all.filter((t) => t.kind === "percent_luck" && special(t))
      : all.filter((t) => t.kind === "percent_luck" && !special(t));

  return formatTokenDefinitionPage(
    list,
    pageRaw,
    mode.includes("potion")
      ? "🧪 Potion Tokens"
      : mode.includes("special")
      ? "✨ Special Tokens"
      : "🎟️ Boost Tokens"
  );
}

function coreTopic(topic: string, query = "", pageRaw = ""): string {
  const mode = normalize(topic);

  if (mode === "commands" || mode === "cmds" || mode === "new_commands") {
    return paginate(COMMAND_INFO, pageRaw || query, (x) => x, "🤖 Commands", 4);
  }

  if (mode === "mega" || mode === "expansion" || mode === "features") {
    return paginate(MEGA_INFO, pageRaw || query, (x) => x, "✨ Mega Features", 4);
  }

  if (["activity", "knowledge", "research", "aok"].includes(mode)) {
    return paginate(ACTIVITY_INFO, pageRaw || query, (x) => x, "🧠 Activity Of Knowledge", 4);
  }

  if (mode === "paths" || mode === "path") {
    return paginate(
      [
        "Safe: stable/easier walls",
        "Risk: harder/more rewards",
        "Support: crafting discounts",
        "Biome: biome/material scaling",
        "Precision: focused luck",
        "Token: stronger token value",
        "Anomaly: weird late-game scaling",
      ],
      pageRaw || query,
      (x) => x,
      "🧭 Paths",
      4
    );
  }

  if (mode === "materials" || mode === "material") return formatMaterialGuide(query, pageRaw);
  if (mode === "components" || mode === "component") return formatComponentGuide(query, pageRaw);
  if (mode === "boxes" || mode === "box") return formatBoxGuide(query, pageRaw);
  if (["obtain", "source", "sources", "how", "get"].includes(mode)) {
    return formatObtainGuide(query, pageRaw);
  }

  if (mode === "events" || mode === "event") {
    return paginate(events as Array<{ name: string }>, pageRaw || query, (e) => e.name, "🎉 Events");
  }

  if (mode === "dev" || mode === "devs") {
    return paginate(
      devEvents as Array<{ name?: string; id: string }>,
      pageRaw || query,
      (d) => d.name ?? titleCase(d.id),
      "🛠️ Dev Biomes"
    );
  }

  if (mode === "devices" || mode === "device") {
    return paginate(
      devices as Array<{ name: string }>,
      pageRaw || query,
      (d) => d.name,
      "📟 Devices"
    );
  }

  return truncate(
    "📘 !info <what> [name/page] | commands, mega, activity, aura, biome, potion, token boosts/potions/special/sources, paths, materials, components, boxes, obtain, events, dev, devices.",
    390
  );
}

export function formatSolInfo(rawQuery: string): string {
  const parts = rawQuery.trim().split(/\s+/).filter(Boolean);
  if (normalize(parts[0]) === "sol") parts.shift();

  const topic = normalize(parts.shift() ?? "help");
  const { query, page } = splitQueryPage(parts);

  if (topic === "help" || topic === "info") return coreTopic("help");
  if (topic === "commands" || topic === "cmds") return coreTopic("commands", query, page);
  if (["mega", "features", "expansion"].includes(topic)) return coreTopic("mega", query, page);
  if (["activity", "knowledge", "research", "aok"].includes(topic)) {
    return coreTopic(topic, query, page);
  }

  if (topic === "aura" || topic === "auras") return auraInfo(query, page);
  if (topic === "biome" || topic === "biomes") return biomeInfo(query, page);
  if (topic === "potion" || topic === "potions") return potionInfo(query, page);

  if (topic === "token" || topic === "tokens") {
    const first = normalize(query.split(/\s+/)[0] ?? "");

    if (["source", "sources", "obtain", "how", "get"].includes(first)) {
      const remainder = query.split(/\s+/).slice(1).join(" ");
      return formatTokenSourceGuide(remainder, page);
    }

    if (isKnownTokenGuide(query)) return formatTokenSourceGuide(query, page);
    return tokenInfo(query || "boosts", page);
  }

  if (topic === "boost" || topic === "boosts") return tokenInfo("boosts", query || page);
  if (topic === "special") return tokenInfo("special", query || page);

  if (
    [
      "path",
      "paths",
      "material",
      "materials",
      "component",
      "components",
      "box",
      "boxes",
      "obtain",
      "source",
      "sources",
      "how",
      "get",
      "event",
      "events",
      "dev",
      "devs",
      "device",
      "devices",
      "core",
      "cores",
      "shd",
      "reactor",
      "quest",
      "quests",
    ].includes(topic)
  ) {
    return coreTopic(topic, query, page);
  }

  return auraInfo([topic, query].filter(Boolean).join(" "));
}
