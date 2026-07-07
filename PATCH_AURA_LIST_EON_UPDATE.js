const fs = require("fs");

function norm(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function tierTags(rarity, extra = []) {
  const tags = [];
  if (rarity >= 7500000001) tags.push("dimensional");
  else if (rarity >= 999999999) tags.push("transcendent");
  else if (rarity >= 99999999) tags.push("glorious");
  else if (rarity >= 10000000) tags.push("exalted");
  else if (rarity >= 999999) tags.push("mythic");
  else if (rarity >= 99999) tags.push("legendary");
  else if (rarity >= 10000) tags.push("unique");
  else if (rarity >= 1000) tags.push("epic");
  else tags.push("basic");

  for (const tag of extra) if (!tags.includes(tag)) tags.push(tag);
  return tags;
}

function aura(o) {
  const {
    id, name, rarity, nativeRarity = null, biome = null, biomeLock = false,
    noBreakthrough = false, potion = null, devBiome = null, luckImmune = false,
    event = null, unobtainable = false, deleted = false, tags = [], time = null,
  } = o;

  return {
    id, name, rarity, nativeRarity, biome, biomeLock, noBreakthrough,
    potion, devBiome, luckImmune, event, unobtainable, deleted,
    tags: tierTags(rarity, tags), time,
  };
}

const PATCH_AURAS = [
  aura({ id: "virtual_memory", name: "Virtual Memory", rarity: 232232232, nativeRarity: 116116116, biome: "cyberspace" }),
  aura({ id: "overture_history", name: "OVERTURE I HISTORY", rarity: 300000000 }),
  aura({ id: "maelstrom", name: "MAELSTROM", rarity: 309999999, nativeRarity: 103333333, biome: "windy" }),
  aura({ id: "dreamer", name: "d r e a m e r", rarity: 315000000, nativeRarity: 31500000, time: "nighttime" }),
  aura({ id: "perpetual", name: "«Perpetual»", rarity: 315000000 }),
  aura({ id: "lotusfall", name: "LOTUSFALL", rarity: 320000000 }),
  aura({ id: "cytokinesis", name: "CYTOKINESIS", rarity: 330400472, nativeRarity: 165200236, biome: "cyberspace" }),
  aura({ id: "orchestra", name: "O RCHESTRA", rarity: 336870912 }),
  aura({ id: "flora_evergreen", name: "Flora : Evergreen", rarity: 370073730 }),
  aura({ id: "chillsear", name: "CHILLSEAR", rarity: 375000000, nativeRarity: 125000000, biome: "snowy" }),
  aura({ id: "celestial_eclipse", name: "Celestial ✧ Eclipse", rarity: 384400000 }),
  aura({ id: "apostolos", name: "APOSTOLOS", rarity: 444000000, nativeRarity: 222000000, biome: "citadel_of_orders" }),
  aura({ id: "unknown", name: "⍰ unknown ⍰", rarity: 444444444, biome: "limbo", biomeLock: true }),
  aura({ id: "kyawthuite_remembrance", name: "Kyawthuite : Remembrance", rarity: 450000000 }),
  aura({ id: "ruins", name: "RUINS", rarity: 500000000 }),
  aura({ id: "matrix_overdrive", name: "{♢ MATRIX /◆ OVERDRIVE ♢}", rarity: 503000000, nativeRarity: 251500000, biome: "cyberspace" }),
  aura({ id: "sailor_admiral", name: "-SAILOR - ADMIRAL", rarity: 540000000, nativeRarity: 135000000, biome: "rainy" }),
  aura({ id: "elude", name: "Elude", rarity: 555555555, biome: "limbo", biomeLock: true }),
  aura({ id: "sophyra", name: "Sophyra", rarity: 570000000 }),
  aura({ id: "matrix_reality", name: "MATRIX ▫ REALITY", rarity: 601020102, nativeRarity: 300510051, biome: "cyberspace" }),
  aura({ id: "sloth", name: "Sloth", rarity: 650000000 }),
  aura({ id: "prologue", name: "PROLOGUE", rarity: 666616111, biome: "limbo", biomeLock: true }),
  aura({ id: "pythios", name: "PYTHIOS", rarity: 666666666, nativeRarity: 111111111, biome: "hell" }),
  aura({ id: "sovereign", name: "SOVEREIGN", rarity: 750000000 }),
  aura({ id: "withered_ruins", name: "⟪-WITHERED-⟫ -RUINS-", rarity: 800000000 }),
  aura({ id: "aegis", name: "﴾AEGIS﴿", rarity: 825000000, nativeRarity: 412500000, biome: "cyberspace" }),
  aura({ id: "dreamscape", name: "dreamscape", rarity: 850000000, biome: "limbo", biomeLock: true }),
  aura({ id: "ascendant", name: "ASCENDANT", rarity: 935000000, nativeRarity: 187000000, biome: "heaven" }),

  aura({ id: "manta", name: "Manta", rarity: 300000000, nativeRarity: 150000000, biome: "blazing_sun", event: "summer_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "aegis_watergun", name: "AEGIS : WATERGUN", rarity: 825000000, nativeRarity: 412500000, biome: "blazing_sun", event: "summer_2025", tags: ["event", "event-exclusive"] }),

  aura({ id: "snowball", name: "«Snowball»", rarity: 10000, nativeRarity: 5000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "star_rider_snowflake", name: "Star Rider : Snowflake", rarity: 240000, nativeRarity: 120000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "cryogenic", name: "Cryogenic", rarity: 250000, nativeRarity: 250000, biome: "aurora", biomeLock: true, luckImmune: true, event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "gingerbread", name: "Gingerbread", rarity: 3750000, nativeRarity: 1875000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "jack_frost", name: "Jack Frost", rarity: 4700000, nativeRarity: 2350000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "lost_soul_wander", name: "Lost Soul - WANDER", rarity: 9400000, nativeRarity: 4700000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "frostwood", name: "« Frostwood »", rarity: 24500000, nativeRarity: 12250000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "north_pole", name: "- North Pole -", rarity: 45000000, nativeRarity: 22500000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "sky_burst", name: "Sky Burst!", rarity: 60000000, nativeRarity: 30000000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "encase", name: "[ENCASE]", rarity: 230000000, nativeRarity: 115000000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "cryofang", name: "CryoFang", rarity: 380000000, nativeRarity: 190000000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "northern", name: "‹ NØRTHERN ›", rarity: 405000000, nativeRarity: 202500000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "eve_night", name: "Eve - Night", rarity: 424000000, nativeRarity: 212000000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "workshop", name: "Workshop", rarity: 700000000, nativeRarity: 350000000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "parol", name: "P A R O L", rarity: 760000000, nativeRarity: 380000000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "sovereign_frostveil", name: "SOVEREIGN : Frostveil", rarity: 1000000000, nativeRarity: 500000000, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "winter_garden", name: "Winter Garden", rarity: 1450012025, nativeRarity: 725006013, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),
  aura({ id: "dream_traveler", name: "Dream Traveler", rarity: 2025012025, nativeRarity: 1012506013, biome: "aurora", event: "christmas_2025", tags: ["event", "event-exclusive"] }),

  aura({ id: "symphony_bloomed", name: "Symphony : Bloomed", rarity: 375000000, event: "valentines_2026", tags: ["event", "event-exclusive"] }),

  aura({ id: "hatchwarden", name: "Hatchwarden", rarity: 40000000, event: "easter_2026", tags: ["event", "event-exclusive"] }),
  aura({ id: "emperor", name: "EMPEROR", rarity: 80000000, event: "easter_2026", tags: ["event", "event-exclusive"] }),
  aura({ id: "eggsistence", name: "Eggsistence", rarity: 307777777, event: "easter_2026", tags: ["event", "event-exclusive"] }),
  aura({ id: "revive", name: "Revive", rarity: 645000000, event: "easter_2026", tags: ["event", "event-exclusive"] }),
  aura({ id: "eggore", name: "EGGORE", rarity: 700000000, event: "easter_2026", tags: ["event", "event-exclusive"] }),
  aura({ id: "eostre", name: "E ostre", rarity: 1000000000, event: "easter_2026", tags: ["event", "event-exclusive"] }),
  aura({ id: "eggis", name: "✿EGGIS EGGIS✿", rarity: 1150000000, event: "easter_2026", tags: ["event", "event-exclusive"] }),
  aura({ id: "yolkeggy", name: "Y.O.L.K.E.G.G.Y.", rarity: 1790909090, event: "easter_2026", tags: ["event", "event-exclusive"] }),
  aura({ id: "sky_festival", name: "[ Sky Festival ]", rarity: 2000000000, event: "easter_2026", tags: ["event", "event-exclusive"] }),
];

const path = "data/auras.json";
if (!fs.existsSync(path)) {
  console.error("❌ Missing data/auras.json");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path, "utf8"));
if (!Array.isArray(data.auras)) {
  console.error("❌ data/auras.json does not contain an auras array.");
  process.exit(1);
}

const existing = new Set();
for (const a of data.auras) {
  existing.add(norm(a.id));
  existing.add(norm(a.name));
}

const added = [];
const skipped = [];
for (const entry of PATCH_AURAS) {
  const keys = [norm(entry.id), norm(entry.name)];
  if (keys.some((key) => existing.has(key))) {
    skipped.push(entry.id);
    continue;
  }
  data.auras.push(entry);
  keys.forEach((key) => existing.add(key));
  added.push(entry.id);
}

data.auras.sort((a, b) => (a.rarity - b.rarity) || String(a.name).localeCompare(String(b.name)));
data.count = data.auras.length;

fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");

console.log(`✅ Aura patch complete. Added ${added.length}, skipped ${skipped.length}.`);
if (added.length) console.log(`Added: ${added.join(", ")}`);
if (skipped.length) console.log(`Skipped existing: ${skipped.join(", ")}`);
