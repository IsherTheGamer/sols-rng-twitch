import { auras, biomes, potions, events, devEvents, devices } from "./data";
import { getAllTokenDefinitions, formatTokenDefinitionPage } from "./inventory";
import { truncate } from "./format";

const PAGE_SIZE = 8;

const ACTIVITY_INFO = [
  "The Activity Of Knowledge Update commands:",
  "!knowledge = view Knowledge, Research, Scanner, Merchant Marks, and Relic Shards.",
  "!research = research help. Use !research branches, !research <branch>, !research info <id>, or !research unlock <id>.",
  "!research branches = list branches. Branches: archive, crafting, core, relic, scanner, boss, market, blueprint, forecast.",
  "!scanner = view Activity scanner, rare signal, boss, event, and best-action hints.",
  "!boss = view active boss. Mods can use !boss start.",
  "!worldevent = view the current Activity world event.",
  "!forecast = semi-smart daily forecast using activity data, not exact predictions.",
  "!market = safe marketplace using Merchant Marks. Use !market buy <id>.",
  "!blueprints = view blueprint unlocks and sources.",
  "!relics = view relic catalog/owned relics. Reroll later with !relics reroll <id>.",
  "Website: /activity"
];

const COMMAND_INFO = [
  "!update [page]: latest bot update notes",
  "!info sol commands [page]: command help pages",
  "!info sol mega [page]: mega feature help",
  "!info sol activity [page]: Activity Of Knowledge help",
  "!dcalerts: Discord webhook alert settings",
  "!replay [user/page]: major rare pull replay",
  "!records: channel records and best pulls",
  "!firsts / !firsts biomes: first discoveries",
  "!aotd / !botd: aura/biome of the day",
  "!event: channel event status/start/stop",
  "!blackmarket: rare Stardust shop",
  "!pquests daily/weekly/monthly/yearly: player quests",
  "!gquests daily/weekly/monthly/yearly: global quests",
  "!lb daily/weekly/monthly/yearly rolls/best/rare/value",
  "!weeklylb: weekly leaderboard shortcut",
  "!luckdetails: full luck breakdown and best luck history",
];

const MEGA_INFO = [
  "Discord: !dcalerts test/on/off/aura/biome controls webhook alerts.",
  "Replay/records: !replay shows 100M+ pulls, !records shows best aura, most rolls, rare pulls, and rare biomes.",
  "Firsts: !firsts shows first aura discoveries, !firsts biomes shows first rare biome discoveries.",
  "Quests: !pquests and !gquests have daily, weekly, monthly, yearly periods with 3 quests each.",
  "Leaderboards: !lb all-time or period-based pages support rolls, best, rare, and value.",
  "Events: !event start luckstorm 10 creates temporary luck. !event stop ends it.",
  "Black Market: mods can use !blackmarket spawn; users buy with Stardust.",
  "Discord summary: /api/summary posts daily/weekly/monthly/yearly Discord recaps.",
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

function findAura(query: string) {
  const q = normalize(query);
  return auras.find((a) => normalize(a.id) === q || normalize(a.name) === q || normalize(a.name).replace(/_/g, "") === q.replace(/_/g, ""));
}

function findBiome(query: string) {
  const q = normalize(query);
  return biomes.find((b) => normalize(b.id) === q || normalize(b.name) === q);
}

function findPotion(query: string) {
  const q = normalize(query);
  return potions.find((p) => normalize(p.id) === q || normalize(p.name) === q || p.aliases.some((a) => normalize(a) === q));
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
    return truncate(`✨ ${aura.name} | ${rarity(aura.rarity)}${flags.length ? ` | ${flags.join(" | ")}` : ""}`, 390);
  }

  const page = /^\d+$/.test(query) ? query : pageRaw;
  return paginate([...auras].sort((a, b) => a.rarity - b.rarity), page, (a) => `${a.name} ${rarity(a.rarity)}`, "✨ Auras");
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

    return truncate(`🌍 ${biome.name} | ${chance} | BT x${biome.breakthroughMultiplier}${biome.isRareBiome ? " | Rare" : ""}`, 390);
  }

  const page = /^\d+$/.test(query) ? query : pageRaw;
  return paginate(biomes, page, (b) => `${b.name}${b.isRareBiome ? " rare" : ""}`, "🌍 Biomes");
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
    return truncate(`🧪 ${potion.name} | +${Math.floor(potion.luck).toLocaleString("en-US")} luck${extras.length ? ` | ${extras.join(" | ")}` : ""}`, 390);
  }

  const page = /^\d+$/.test(query) ? query : pageRaw;
  return paginate(potions, page, (p) => `${p.name} +${Math.floor(p.luck).toLocaleString("en-US")}`, "🧪 Potions");
}

function tokenInfo(kind: string, pageRaw?: string): string {
  const mode = normalize(kind || "boosts");
  const all = getAllTokenDefinitions();
  const special = (t: (typeof all)[number]) => Boolean((t.flatLuck ?? 0) > 0 || (t.rareBiomePercentLuck ?? 0) > 0 || (t.finalLuckMultiplier ?? 1) > 1);
  const list =
    mode.includes("potion") || mode.includes("roll")
      ? all.filter((t) => t.kind === "potion")
      : mode.includes("special") || mode.includes("rare") || mode.includes("flat") || mode.includes("final")
      ? all.filter((t) => t.kind === "percent_luck" && special(t))
      : all.filter((t) => t.kind === "percent_luck" && !special(t));

  return formatTokenDefinitionPage(list, pageRaw, mode.includes("potion") ? "🧪 Potion Tokens" : mode.includes("special") ? "✨ Special Tokens" : "🎟️ Boost Tokens");
}

function coreTopic(topic: string, pageRaw?: string): string {
  const mode = normalize(topic);

  if (mode === "commands" || mode === "cmds" || mode === "new_commands") {
    return paginate(COMMAND_INFO, pageRaw, (x) => x, "🤖 Commands", 4);
  }

  if (mode === "mega" || mode === "expansion" || mode === "features") {
    return paginate(MEGA_INFO, pageRaw, (x) => x, "✨ Mega Features", 4);
  }

  if (mode === "activity" || mode === "knowledge" || mode === "research" || mode === "aok") {
    return paginate(ACTIVITY_INFO, pageRaw, (x) => x, "🧠 Activity Of Knowledge", 4);
  }

  if (mode === "paths" || mode === "path") {
    return paginate([
      "Safe: stable/easier walls", "Risk: harder/more rewards", "Support: crafting discounts", "Biome: biome/material scaling",
      "Precision: focused luck", "Token: stronger token value", "Anomaly: weird late-game scaling",
    ], pageRaw, (x) => x, "🧭 Paths", 4);
  }

  if (mode === "materials" || mode === "material") {
    return paginate([
      "Scrap", "Metal Bits", "Circuit Scrap", "Signal Fragment", "Refined Alloy", "Stabilized Flux", "Quantum Residue", "Reality Thread",
      "Singularity Shard", "Dimensional Seal", "Anomaly Matter", "Forbidden Circuit", "Debug Fragment", "Thermal Paste", "Conductive Gel", "Energy Cell",
      "Glitched Alloy", "Chrono Dust", "Void Glass", "Stellar Ink",
    ], pageRaw, (x) => x, "🧱 Materials");
  }

  if (mode === "components" || mode === "component") {
    return paginate([
      "Wire", "Cable", "Plate", "Rod", "Screw", "Bolt", "Coil", "Resistor", "SMD Resistor", "Transistor", "SMD Transistor", "Capacitor",
      "SMD Capacitor", "Diode", "SMD Diode", "Fuse", "Relay", "Sensor", "Emitter", "Lens", "Heat Sink", "Battery Cell", "Power Cell",
      "Circuit Board", "Processor", "Logic Chip", "Regulator", "Stabilizer", "Conduit", "Matrix",
    ], pageRaw, (x) => x, "⚙️ Components");
  }

  if (mode === "events" || mode === "event") return paginate(events as Array<{ name: string }>, pageRaw, (e) => e.name, "🎉 Events");
  if (mode === "dev" || mode === "devs") return paginate(devEvents as Array<{ name?: string; id: string }>, pageRaw, (d) => d.name ?? titleCase(d.id), "🛠️ Dev Biomes");
  if (mode === "devices" || mode === "device") return paginate(devices as Array<{ name: string }>, pageRaw, (d) => d.name, "📟 Devices");

  return truncate("📘 !info sol <what> [page] | what: commands, mega, activity, aura/auras, biome/biomes, potion/potions, token boosts/potions/special, paths, materials, components, events, dev, devices.", 390);
}

export function formatSolInfo(rawQuery: string): string {
  const parts = rawQuery.trim().split(/\s+/).filter(Boolean);
  if (normalize(parts[0]) === "sol") parts.shift();

  const topic = normalize(parts[0] ?? "help");
  const arg = parts[1] ?? "";
  const page = parts[2] ?? "";

  if (topic === "help" || topic === "commands" || topic === "info") return coreTopic("help");
  if (topic === "activity" || topic === "knowledge" || topic === "research" || topic === "aok") return coreTopic(topic, arg);
  if (topic === "aura" || topic === "auras") return auraInfo(arg, page);
  if (topic === "biome" || topic === "biomes") return biomeInfo(arg, page);
  if (topic === "potion" || topic === "potions") return potionInfo(arg, page);
  if (topic === "token" || topic === "tokens") return tokenInfo(arg || "boosts", page);
  if (topic === "boost" || topic === "boosts") return tokenInfo("boosts", arg);
  if (topic === "special") return tokenInfo("special", arg);
  if (["path", "paths", "material", "materials", "component", "components", "event", "events", "dev", "devs", "device", "devices", "core", "cores", "shd", "reactor", "quest", "quests"].includes(topic)) {
    return coreTopic(topic, arg);
  }

  return auraInfo(parts.join(" "));
}
