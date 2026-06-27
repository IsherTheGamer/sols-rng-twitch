/**
 * Generates data/auras.json from wiki-aligned definitions.
 * Run: npm run scrape-wiki
 */
import { writeFileSync } from "fs";
import { join } from "path";

export interface AuraDef {
  id: string;
  name: string;
  rarity: number;
  nativeRarity?: number | null;
  biome?: string | null;
  biomeLock?: boolean;
  noBreakthrough?: boolean;
  potion?: { id: string; rarity: number } | null;
  devBiome?: string | null;
  luckImmune?: boolean;
  event?: string | null;
  unobtainable?: boolean;
  deleted?: boolean;
  tags?: string[];
  time?: "daytime" | "nighttime" | null;
}

const auras: AuraDef[] = [];

function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim();
}

function uniqueTags(tags: string[]): string[] {
  const out: string[] = [];

  for (const rawTag of tags) {
    const tag = normalizeTag(rawTag);

    if (!tag || out.includes(tag)) continue;

    out.push(tag);
  }

  return out;
}

function buildTags(opts: Partial<AuraDef>): string[] {
  const tags = [...(opts.tags ?? [])];

  if (opts.devBiome) tags.push("dev-exclusive");
  if (opts.potion?.id) tags.push("potion-exclusive");
  if (opts.event) tags.push("event-exclusive");
  if (opts.luckImmune) tags.push("raw-luck-only");
  if (opts.unobtainable) tags.push("unobtainable");
  if (opts.deleted) tags.push("deleted");

  return uniqueTags(tags);
}

function add(
  id: string,
  name: string,
  rarity: number,
  opts: Partial<AuraDef> = {}
) {
  auras.push({
    id,
    name,
    rarity,
    nativeRarity: opts.nativeRarity ?? null,
    biome: opts.biome ?? null,
    biomeLock: opts.biomeLock ?? false,
    noBreakthrough: opts.noBreakthrough ?? false,
    potion: opts.potion ?? null,
    devBiome: opts.devBiome ?? null,
    luckImmune: opts.luckImmune ?? false,
    event: opts.event ?? null,
    unobtainable: opts.unobtainable ?? false,
    deleted: opts.deleted ?? false,
    tags: buildTags(opts),
    time: opts.time ?? null,
  });
}

function eventTags(extra: string[] = []): string[] {
  return uniqueTags(["event", ...extra]);
}

function addEventAura(
  id: string,
  name: string,
  rarity: number,
  event: string,
  opts: Partial<AuraDef> = {}
) {
  add(id, name, rarity, {
    ...opts,
    event,
    tags: eventTags(opts.tags ?? []),
  });
}

function addPurchasableEventAura(
  id: string,
  name: string,
  price: number,
  event: string,
  opts: Partial<AuraDef> = {}
) {
  add(id, name, price * 1000, {
    ...opts,
    event,
    tags: eventTags(["purchasable", ...(opts.tags ?? [])]),
  });
}

function addLimitedUnknownAura(
  id: string,
  name: string,
  event: string,
  opts: Partial<AuraDef> = {}
) {
  add(id, name, opts.rarity ?? 1, {
    ...opts,
    event,
    unobtainable: opts.unobtainable ?? true,
    tags: eventTags(["limited", "unknown-rarity", ...(opts.tags ?? [])]),
  });
}

// --- Basic ---
add("nothing", "Nothing", 1, { biome: "limbo", biomeLock: true });
add("common", "Common", 2);
add("uncommon", "Uncommon", 4);
add("good", "Good", 5);
add("natural", "Natural", 8);
add("rare", "Rare", 16);
add("divinus", "Divinus", 32, { biome: "heaven", nativeRarity: 6 });
add("crystallized", "Crystallized", 64);
add("dizzy", "Dizzy", 123);
add("rage", "Rage", 128);
add("topaz", "Topaz", 150);
add("ruby", "Ruby", 350);
add("forbidden", "Forbidden", 403, {
  biome: "cyberspace",
  nativeRarity: 202,
});
add("emerald", "Emerald", 500);
add("gilded", "Gilded", 512, {
  biome: "sandstorm",
  nativeRarity: 128,
});
add("ink", "Ink", 700);
add("jackpot", "Jackpot", 777, {
  biome: "sandstorm",
  nativeRarity: 194,
});
add("sapphire", "Sapphire", 800);
add("aquamarine", "Aquamarine", 900);
add("wind", "Wind", 900, { biome: "windy", nativeRarity: 300 });

// --- Epic ---
add("diaboli", "DIABOLI", 1004);
add("precious", "Precious", 1024);
add("hydrogen", "0H H ydrogenydrogen", 1111);
add("atomic", "Atomic", 1180);
add("glock", "Glock", 1700);
add("magnetic", "Magnetic", 2048);
add("ash", "Ash", 2300);
add("glacier", "Glacier", 2304, { biome: "snowy", nativeRarity: 768 });
add("player", "PLAYER", 3000, {
  biome: "cyberspace",
  nativeRarity: 1500,
});
add("flora", "Flora", 3700);
add("cola", "> Cola <", 3999);
add("sidereum", "Sidereum", 4096);
add("bleeding", "Bleeding", 4444);
add("flutter", "Flutter", 5000);
add("targeted", "TARGETED", 5000);
add("flushed", ":Flushed:", 6900);
add("hazard", "HAZARD", 7000, {
  biome: "corruption",
  nativeRarity: 1400,
});
add("doodle", "Doodle", 7500);
add("quartz", "Quartz", 8192);
add("honey", "Honey", 8335);
add("lost_soul", "Lost Soul", 9200);
add("atomic_ribonucleic", "Atomic:Ribonucleic", 9876);

// --- Unique ---
add("dreamspace_star1", "★", 100, {
  biome: "dreamspace",
  biomeLock: true,
  noBreakthrough: true,
  tags: ["unique"],
});
add("undead", "Undead", 12000, { biome: "hell", nativeRarity: 2000 });
add("corrosive", "Corrosive", 12000, {
  biome: "corruption",
  nativeRarity: 2400,
});
add("kawaii", "Kawaii", 12300);
add("rage_heated", "Rage : Heated", 12800);
add("leak", "L E A K", 14000);
add("powered", "Powered", 16384);
add("crowned", "Crowned", 20000, {
  biome: "sandstorm",
  nativeRarity: 5000,
});
add("marsh", "Marsh", 25000);
add("copper", "COPPER", 29000);
add("watt", "WATT", 32768);
add("aquatic", "Aquatic", 40000);
add("solar", "Solar", 50000, { time: "daytime", nativeRarity: 5000 });
add("lunar", "Lunar", 50000, { time: "nighttime", nativeRarity: 5000 });
add("starlight", "STARLIGHT", 50000, {
  biome: "starfall",
  nativeRarity: 10000,
});
add("star_rider", "Star Rider", 50000, {
  biome: "starfall",
  nativeRarity: 10000,
});
add("pleiades", "Pleiades", 65358, {
  biome: "singularity",
  biomeLock: true,
  noBreakthrough: true,
});
add("flushed_lobotomy", "Flushed : Lobotomy", 69000);
add("hazard_rays", "HAZARD : RAYS", 70000, {
  biome: "corruption",
  nativeRarity: 14000,
});
add("nautilus", "Nautilus", 70000);
add("permafrost", "Permafrost", 73500, {
  biome: "snowy",
  nativeRarity: 24500,
});
add("pulsar", "Pulsar", 83345, {
  biome: "singularity",
  biomeLock: true,
  noBreakthrough: true,
});
add("constella", "Constella", 86988, {
  biome: "singularity",
  biomeLock: true,
  noBreakthrough: true,
});
add("flow", "✿ Flow ✿", 87000, { biome: "windy", nativeRarity: 29000 });
add("stormal", "Stormal", 90000, { biome: "windy", nativeRarity: 30000 });

// --- Legendary ---
add("dreamspace_star2", "★★", 1000, {
  biome: "dreamspace",
  biomeLock: true,
  noBreakthrough: true,
  tags: ["legendary"],
});
add("fault", "FAULT", 3000, {
  biome: "glitched",
  biomeLock: true,
  noBreakthrough: true,
});
add("exotic", "Exotic", 99999);
add("diaboli_void", "DIABOLI ▽ VOID", 100400);
add("comet", "COMET", 120000, {
  biome: "singularity",
  nativeRarity: 24000,
});
add("divinus_angel", "Divinus : Angel", 120000, {
  biome: "heaven",
  nativeRarity: 24000,
});
add("jade", "Jade", 125000);
add("spectre", "Spectre", 140000);
add("jazz", "Jazz", 160000);
add("aether", "Aether", 180000);
add("bounded", "BOUNDED", 200000);
add("lantern", "Lantern", 333333, { biome: "limbo", biomeLock: true });
add("celestial", "Celestial", 350000);
add("vortex", "Vortex", 399999, { biome: "windy", nativeRarity: 133333 });
add("terror", "TERROR", 400000);
add("hope", "HOPE", 488725, { biome: "heaven", nativeRarity: 97745 });
add("raven", "Raven", 500000, { biome: "limbo", biomeLock: true });
add("warlock", "Warlock", 666000);
add("undead_devil", "UNDEAD : DEVIL", 666666, {
  biome: "hell",
  nativeRarity: 111111,
});
add("kyawthuite", "Kyawthuite", 850000);

// --- Mythic ---
add("dreamspace_star3", "★★★", 10000, {
  biome: "dreamspace",
  biomeLock: true,
  noBreakthrough: true,
  tags: ["mythic"],
});
add("arcane", "Arcane", 1000000);
add("starlight_kunzite", "STARLIGHT : KUNZITE", 1000000, {
  biome: "starfall",
  nativeRarity: 200000,
});
add("gothic", "ゴシック", 1000001, { biome: "limbo", biomeLock: true });
add("magnetic_reverse", "Magnetic : Reverse Polarity", 1024000);
add("undefined", "Undefined", 1111000, {
  biome: "null",
  nativeRarity: 1111,
});
add("rage_brawler", "Rage : Brawler", 1280000);
add("symbiosis", "symbiosis", 1331201, {
  biome: "corruption",
  nativeRarity: 266240,
});
add("astral", "Astral", 1336000, {
  biome: "starfall",
  nativeRarity: 267200,
});
add("cosmos", "Cosmos", 1520000);
add("archmage", "Archmage", 1766000);
add("respawn", "Respawn", 1999999, {
  biome: "cyberspace",
  nativeRarity: 999999,
});
add("gravitational", "Gravitational", 2000000);
add("unbound", "UNBOUND", 2000000);
add("buggify", "Buggify", 2000000);
add("flowed", "-FLOWED-", 2121121, {
  biome: "null",
  nativeRarity: 2121,
});
add("virtual", "Virtual", 2500000, {
  biome: "cyberspace",
  nativeRarity: 1250000,
});
add("vega", "Vega", 2580000, {
  biome: "singularity",
  biomeLock: true,
  noBreakthrough: true,
});
add("parasite", "ParaSITE", 3000000, {
  biome: "corruption",
  nativeRarity: 600000,
});
add("orion", "Orion", 3000000, {
  biome: "starfall",
  nativeRarity: 600000,
});
add("apatite", "Apatite", 3133133);
add("savior", "Savior", 3200000);
add("shift_lock", "Shift lock", 3325000, {
  biome: "null",
  nativeRarity: 3325,
});
add("evanescent", "Evanescent", 3360000, {
  biome: "rainy",
  nativeRarity: 840000,
});
add("alice", "《 Alice 》", 3500000);
add("bejeweled", "Bejeweled", 3600000);
add("aquatic_flame", "Aquatic : Flame", 4000000);
add("poseidon", "Poseidon", 4000000, {
  biome: "rainy",
  nativeRarity: 1000000,
});
add("metabytes", "METABYTES", 4000000, {
  biome: "cyberspace",
  nativeRarity: 2000000,
});
add("wraith", "WRAITH", 4100000);
add("zeus", "Zeus", 4500000);
add("solar_solstice", "Solar : Solstice", 5000000, {
  time: "daytime",
  nativeRarity: 500000,
});
add("galaxy", "Galaxy", 5000000, {
  biome: "singularity",
  nativeRarity: 1000000,
});
add("lunar_full_moon", "Lunar : Full Moon", 5000000, {
  time: "nighttime",
  nativeRarity: 500000,
});
add("anima", "Anima", 5730000, { biome: "limbo", biomeLock: true });
add("twilight", "Twilight", 6000000, {
  time: "nighttime",
  nativeRarity: 600000,
});
add("astronaut", "ASTRONAUT", 6117186, {
  biome: "singularity",
  biomeLock: true,
  noBreakthrough: true,
});
add("origin", "Origin", 6500000);
add("hades", "Hades", 6666666, { biome: "hell", nativeRarity: 1111111 });
add("celestial_divine", "« CELESTIAL ✰ DIVINE »", 7000000);
add("anubis", "Anubis", 7200000, {
  biome: "sandstorm",
  nativeRarity: 1800000,
});
add("refraction", "Refraction", 7242000);
add("faith", "+Faith+", 7250000, {
  biome: "heaven",
  nativeRarity: 1450000,
});
add("hyper_volt", "Hyper-Volt", 7500000);
add("velocity", "VELOCITY", 7630000);
add("nautilus_lost", "Nautilus : Lost", 7700000);
add("divinus_guardian", "Divinus : Guardian", 7777777, {
  biome: "heaven",
  nativeRarity: 1555555,
});
add("outlaw", "OUTLAW", 8000000, {
  biome: "sandstorm",
  nativeRarity: 2000000,
});
add("harnessed", "⌊ HARNESSED ⌉", 8500000);
add("nihility", "[ Nihility ]", 9000000, {
  biome: "null",
  nativeRarity: 9000,
});
add("helios", "Helios", 9000000);
add("stargazer", "☆ Stargazer ☆", 9200000, {
  biome: "starfall",
  nativeRarity: 1840000,
});
add("amethyst", "Amethyst", 9333700);

// --- Exalted ---
add("starscourge", "STARSCOURGE", 10000000, {
  biome: "starfall",
  nativeRarity: 2000000,
});
add("sharkyn", "SHARKYN", 10000000, {
  biome: "rainy",
  nativeRarity: 2500000,
});
add("guardian", "GUARDIAN", 10000000);
add("melodic", "Melodic", 11300000);
add("sailor", "Sailor", 12000000, {
  biome: "rainy",
  nativeRarity: 3000000,
});
add("hurricane", "Hurricane", 13500000, {
  biome: "windy",
  nativeRarity: 4500000,
});
add("sirius", "Sirius", 14000000, {
  biome: "starfall",
  nativeRarity: 2800000,
});
add("arcane_legacy", "A r c a n e : Legacy", 15000000);
add("icarus", "ICARUS", 15660000, {
  biome: "heaven",
  nativeRarity: 3132000,
});
add("lullaby", "Lullaby", 17000000, {
  time: "nighttime",
  nativeRarity: 1700000,
});
add("chromatic", "CHROMATIC", 20000000);
add("plasma", "PLASMA", 20600000);
add("oculus", "Oculus", 23233340, {
  biome: "heaven",
  nativeRarity: 4646668,
});
add("aviator", "★ AVIATOR ★", 24000000, {
  biome: "windy",
  nativeRarity: 8000000,
});
add("rubybrimstone", "RUBYBRIMSTONE", 24060000);
add("apotheosis", "APOTHEOSIS", 24691356);
add("centurion", "CENTURION", 25000000, {
  biome: "singularity",
  biomeLock: true,
  noBreakthrough: true,
});
add("blizzard", "Blizzard", 27315000, {
  biome: "snowy",
  nativeRarity: 9105000,
});
add("arcane_dark", "ARCANE : DARK", 30000000);
add("flora_florest", "Flora : Florest", 32800000);
add("ethereal", "Ethereal", 35000000);
add("fatal_error", "FATAL ERROR", 40413000, {
  biome: "cyberspace",
  nativeRarity: 20206500,
});
add("juxtaposition", "{J u x t a p o s i t i o n}", 40440400, {
  biome: "limbo",
  biomeLock: true,
});
add("overseer", "Overseer", 45000000);
add("exotic_apex", "Exotic : APEX", 49999500);
add("matrix", "Matrix", 50000000, {
  biome: "cyberspace",
  nativeRarity: 25000000,
});
add("runic", "Runic", 50000000);
add("sentinel", "[ S E N T I N E L ]", 60000000);
add("twilight_iridescent", "Twilight : Iridescent Memory", 60000000, {
  time: "nighttime",
  nativeRarity: 6000000,
});
add("antivirus", "ANTIVIRUS", 62500000, {
  biome: "cyberspace",
  nativeRarity: 31250000,
});
add("dominion", "Dominion", 70000000, {
  biome: "heaven",
  nativeRarity: 14000000,
});
add("starborn", "Starborn", 72000000, {
  biome: "starfall",
  nativeRarity: 14400000,
});
add("melodic_serenade", "♬ Melodic : Serenade ♪", 77000000, {
  time: "nighttime",
  nativeRarity: 7700000,
});
add("sailor_dutchman", "Sailor : Flying Dutchman", 80000000, {
  biome: "rainy",
  nativeRarity: 20000000,
});
add("carriage", "Carriage", 80000000);
add("aquaria", "Aquaria", 80000000, {
  biome: "rainy",
  nativeRarity: 20000000,
});
add("virtual_full_control", "VIRTUAL // FULL CONTROL", 80000000, {
  biome: "cyberspace",
  nativeRarity: 40000000,
});
add("harnessed_elements", "⌊ HARNESSED : ELEMENTS ⌉", 85000000);
add("virtual_worldwide", "Virtual : WorldWide", 87500000, {
  biome: "cyberspace",
  nativeRarity: 43750000,
});
add("nucleus", "[-] Nucleus [+]", 92118000);

// --- Glorious ---
add("chromatic_genesis", "CHROMATIC : GENESIS", 99999999);
add("starscourge_radiant", "STARSCOURGE : RADIANT", 100000000, {
  biome: "starfall",
  nativeRarity: 20000000,
});
add("spectraflow", "◇ Spectraflow ◇", 100000000);
add("lily", "Lily", 112000000);
add("overture", "Overture", 150000000);
add("symphony", "Symphony", 175000000);
add("twilight_withering", "- Twilight -Withering Grace", 180000000, {
  time: "nighttime",
  nativeRarity: 18000000,
});
add("felled", "♱ FELLED ♱", 180000000, {
  biome: "hell",
  nativeRarity: 30000000,
});
add("impeached", "IMPEACHED", 200000000, {
  biome: "corruption",
  nativeRarity: 40000000,
});
add("raven_plague", "Raven : Plague", 200000000, {
  biome: "limbo",
  biomeLock: true,
});
add("lumenpool", "~ Lumenpool ~", 220000000, {
  biome: "rainy",
  nativeRarity: 55000000,
});
add("hypervolt_storm", "HYPERVOLT : E V E R - S T O R M", 225000000);
add("virtual_memory", "Virtual Memory", 232232232, {
  biome: "cyberspace",
  nativeRarity: 116116116,
});
add("astral_zodiac", "Astral : Zodiac", 267200000, {
  biome: "starfall",
  nativeRarity: 53440000,
});
add("prophecy", "PROPHECY", 275649430, {
  biome: "heaven",
  nativeRarity: 55129886,
});
add("exotic_void", "Exotic◇Void", 299999999);
add("overture_history", "OVERTURE I HISTORY", 300000000);
add("bloodlust", "+ B L O O D L U S T +", 300000000, {
  biome: "hell",
  nativeRarity: 50000000,
});
add("maelstrom", "MAELSTROM", 309999999, {
  biome: "windy",
  nativeRarity: 103333333,
});
add("dreamer", "d r e a m e r", 315000000, {
  time: "nighttime",
  nativeRarity: 31500000,
});
add("perpetual", "«Perpetual»", 315000000);
add("lotusfall", "LOTUSFALL", 320000000);
add("cytokinesis", "CYTOKINESIS", 330400472, {
  biome: "cyberspace",
  nativeRarity: 165200236,
});
add("orchestra", "ORCHESTRA", 336870912);
add("archangel", "ARCHANGEL", 350000000, {
  biome: "heaven",
  nativeRarity: 70000000,
});
add("atlas", "ATLAS", 360000000, {
  biome: "sandstorm",
  nativeRarity: 90000000,
});
add("flora_evergreen", "Flora : Evergreen", 370073730);
add("chillsear", "CHILLSEAR", 375000000, {
  biome: "snowy",
  nativeRarity: 125000000,
});
add("celestial_eclipse", "Celestial Eclipse", 384400000);
add("abyssal_hunter", "Abyssal Hunter", 400000000, {
  biome: "rainy",
  nativeRarity: 100000000,
});
add("gargantua", "GARGANTUA", 430000000, {
  biome: "singularity",
  nativeRarity: 86000000,
});
add("apostolos", "APOSTOLOS", 444000000, {
  biome: "citadel_of_orders",
  nativeRarity: 222000000,
});
add("unknown", "⍰ unknown ⍰", 444444444, {
  biome: "limbo",
  biomeLock: true,
});
add("kyawthuite_remembrance", "Kyawthuite : Remembrance", 450000000);
add("ruins", "RUINS", 500000000);
add("matrix_overdrive", "{♢ MATRIX /◆ OVERDRIVE ♢}", 503000000, {
  biome: "cyberspace",
  nativeRarity: 251500000,
});
add("sailor_admiral", "-SAILOR - ADMIRAL", 540000000, {
  biome: "rainy",
  nativeRarity: 135000000,
});
add("elude", "Elude", 555555555, { biome: "limbo", biomeLock: true });

// --- Transcendent / higher ---
add(
  "nyctophobia",
  "N̥Y̰C̷T̠O͂Ò͈̩̀P͕̹̝̣̘̍H͋O̯̐̎̋B̢Ȋ̡̦̀̀̒Ǎ̝͚",
  1011111010,
  { tags: ["transcendent"] }
);
add("pixelation", "▣ PIXELATION ▣", 1073741824, {
  tags: ["transcendent"],
});
add("luminosity", "[ LUMINOSITY ]", 1200000000, {
  tags: ["transcendent"],
});
add("breakthrough_aura", "BREAKTHROUGH", 1999999999, {
  tags: ["transcendent"],
  biome: "null",
  biomeLock: true,
  noBreakthrough: true,
});
add("equinox", "『EQUINOX』", 2500000000, {
  tags: ["transcendent"],
});
add("master_hand", "MASTER-HAND", 12500000000, {
  tags: ["dimensional"],
});

// --- Rare biome exclusives ---
add("glitch", "GLITCH", 12210110, {
  biome: "glitched",
  biomeLock: true,
  noBreakthrough: true,
});
add("oppression", "[oppRESsioN]", 220000000, {
  biome: "glitched",
  biomeLock: true,
  noBreakthrough: true,
});
add("borealis", "Borealis", 13333333, {
  biome: "dreamspace",
  biomeLock: true,
  noBreakthrough: true,
});
add("dreammetric", "Dreammetric", 320000000, {
  biome: "dreamspace",
  biomeLock: true,
  noBreakthrough: true,
});
add("meta", "meta", 10000, {
  biome: "cyberspace",
  biomeLock: true,
  noBreakthrough: true,
  luckImmune: true,
});
add("illusionary", "illusionary", 10000000, {
  biome: "cyberspace",
  biomeLock: true,
  noBreakthrough: true,
  luckImmune: true,
  tags: ["challenged+"],
});
add("projection", "Projection", 197000000, {
  biome: "singularity",
  biomeLock: true,
  noBreakthrough: true,
});
add("point_zero", "POINT : ZERO", 521121900, {
  biome: "singularity",
  biomeLock: true,
  noBreakthrough: true,
});
add("astraios", "ASTRAIOS", 1750000000, {
  biome: "singularity",
  biomeLock: true,
  noBreakthrough: true,
});
add("leviathan", "LEVIATHAN", 1730400000, {
  biome: "rainy",
  biomeLock: true,
  noBreakthrough: true,
  tags: ["challenged+"],
});
add("monarch", "MONARCH", 3000000000, {
  biome: "corruption",
  biomeLock: true,
  noBreakthrough: true,
  tags: ["challenged+"],
});

// --- Potion exclusives ---
add("memory", "Memory", 100, {
  potion: { id: "oblivion", rarity: 100 },
  luckImmune: true,
});

add("oblivion_aura", "OBLIVION", 2000, {
  potion: { id: "oblivion", rarity: 2000 },
  luckImmune: true,
});

add("neferkhaf", "Neferkhaf", 10000000, {
  potion: { id: "dune", rarity: 50000 },
  luckImmune: true,
});

add("eden", "Eden", 999999999, {
  potion: { id: "void_heart", rarity: 200 },
  luckImmune: true,
  tags: ["challenged+"],
});

add(
  "fragments_of_the_red_crimson_moon_1",
  "Fragments Of The Crimson Moon",
  1000,
  {
    potion: { id: "red_fragment_i", rarity: 1000 },
    luckImmune: true,
  }
);

add(
  "fragments_of_the_red_crimson_moon_2",
  "Fragments Of The Crimson Moon",
  100,
  {
    potion: { id: "red_fragment_ii", rarity: 100 },
    luckImmune: true,
  }
);

add("another_realm", "ANOTHER REALM", 2945160000, {
  potion: { id: "xyz_potion", rarity: 5454 },
  luckImmune: true,
});

add("mastermind", "MASTERMIND", 2837090000, {
  potion: { id: "axis_potion", rarity: 5353 },
  luckImmune: true,
});

add("edict", "EDICT", 2862250000, {
  potion: { id: "word_potion", rarity: 5350 },
  luckImmune: true,
});

add("red_full_moon_aura", "RED FULL MOON", 2344496400, {
  potion: { id: "chaos_potion", rarity: 4842 },
  luckImmune: true,
});

add("abomination_aura", "ABOMINATION", 2343528000, {
  potion: { id: "chaos_potion", rarity: 4840 },
  luckImmune: true,
});

// --- Dev biome auras ---
add("prowler", "Prowler", 540000, {
  devBiome: "hyperspace_realm",
  biomeLock: true,
  noBreakthrough: true,
});

add("clockwork", "CLOCKWORK", 530000, {
  devBiome: "nulls_existence",
  biomeLock: true,
  noBreakthrough: true,
});

add("attorney", "ATTORNEY", 270000, {
  devBiome: "citadel_of_orders",
  biomeLock: true,
  noBreakthrough: true,
});

add("verdict", "VERDICT", 700000, {
  devBiome: "citadel_of_orders",
  biomeLock: true,
  noBreakthrough: true,
});

// --- Event auras: Valentines 2024 ---
addLimitedUnknownAura("divinus_love", "Divinus : Love", "valentines_2024");
addLimitedUnknownAura("flushed_heart_eye", "Flushed : Heart Eye", "valentines_2024");
addLimitedUnknownAura("celestial_cupid", "Celestial : Cupid", "valentines_2024");
addLimitedUnknownAura("blossom", "Blossom", "valentines_2024");

// --- Event auras: April Fools 2024 ---
addEventAura("defined", "Defined", 2222000, "april_fools_2024", {
  biome: "null",
  nativeRarity: 2222,
  deleted: true,
});

addEventAura("kromat1k", "Kromat1k", 40000000, "april_fools_2024");

addEventAura("im_peach", "i'm peach", 400000000, "april_fools_2024");

// --- Event auras: Summer 2024 ---
addEventAura("watermelon", "Watermelon", 320000, "summer_2024");

addEventAura("starfish_rider", "Starfish Rider", 250000, "summer_2024", {
  biome: "starfall",
  nativeRarity: 25000,
});

addEventAura("shard_surfer", "《 Shard┃Surfer 》", 225000000, "summer_2024", {
  biome: "snowy",
  nativeRarity: 75000000,
});

addLimitedUnknownAura("surfer", "Surfer", "summer_2024");

// --- Event auras: RIA 2024 ---
addEventAura("innovator", "INNOVATOR", 30000000, "ria_2024");

// --- Event auras: Halloween 2024 ---
addEventAura("pump", "PUMP", 200000, "halloween_2024", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("lunar_nightfall", "Lunar ☾ Nightfall", 3000000, "halloween_2024", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("vital", "Vital", 6000000, "halloween_2024", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("moonflower", "Moonflower", 10000000, "halloween_2024", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("cryptfire", "『Cryptfire』", 21000000, "halloween_2024", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("soul_hunter", "SOUL HUNTER", 40000000, "halloween_2024", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("dullahan", "DULLAHAN", 72000000, "halloween_2024", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("nightmare_sky", "》 NIGHTMARE SKY 《", 190000000, "halloween_2024", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("harvester", "〖HARVESTER〗", 666000000, "halloween_2024", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("apostolos_veil", "APOSTOLOS : VEIL", 800000000, "halloween_2024", {
  biomeLock: true,
  noBreakthrough: true,
  tags: ["glorious"],
});

// --- Event auras: Winter 2025 ---
addEventAura("wonderland", "Wonderland", 12000000, "winter_2025", {
  biome: "snowy",
  nativeRarity: 4000000,
});

addEventAura("santa_frost", "Santa-Frost", 45000000, "winter_2025", {
  biome: "snowy",
  nativeRarity: 15000000,
});

addEventAura("winter_fantasy", "< Winter Fantasy >", 72000000, "winter_2025", {
  biome: "snowy",
  nativeRarity: 24000000,
});

addEventAura("express", "Express", 90000000, "winter_2025", {
  biome: "snowy",
  nativeRarity: 30000000,
});

addEventAura("abominable", "{ABOMINABLE}", 120000000, "winter_2025", {
  biome: "snowy",
  nativeRarity: 40000000,
});

addEventAura("atlas_yuletide", "ATLAS:YULETIDE", 510000000, "winter_2025", {
  biome: "snowy",
  nativeRarity: 170000000,
});

addLimitedUnknownAura("frozen", "Frozen", "winter_2025");
addLimitedUnknownAura("frigid", "+ Frigid +", "winter_2025");

// --- Event auras: April Fools 2025 ---
addEventAura("pukeko", "pukeko", 3198, "april_fools_2025");
addEventAura("troll", ":Troll:", 1000000, "april_fools_2025");
addEventAura("onion", "Onion", 8000000, "april_fools_2025");
addEventAura("glock_of_the_sky", "the glock of the sky", 170000000, "april_fools_2025");

// --- Event auras: Easter 2025 ---
addLimitedUnknownAura("windy_egg", "Windy Egg", "easter_2025");
addLimitedUnknownAura("snowy_egg", "Snowy Egg", "easter_2025");
addLimitedUnknownAura("rainy_egg", "Rainy Egg", "easter_2025");
addLimitedUnknownAura("sandstorm_egg", "Sandstorm Egg", "easter_2025");
addLimitedUnknownAura("hellfire_egg", "Hellfire Egg", "easter_2025");
addLimitedUnknownAura("starfall_egg", "Starfall Egg", "easter_2025");
addLimitedUnknownAura("corruption_egg", "Corruption Egg", "easter_2025");
addLimitedUnknownAura("null_egg", "Null Egg", "easter_2025");
addLimitedUnknownAura("glitched_egg", "Glitched Egg", "easter_2025");

// --- Event auras: Summer 2025 ---
addEventAura("manta", "Manta", 300000000, "summer_2025", {
  biome: "blazing_sun",
  nativeRarity: 150000000,
});

addEventAura("aegis_watergun", "AEGIS : WATERGUN", 825000000, "summer_2025", {
  biome: "blazing_sun",
  nativeRarity: 412500000,
});

// Purchasables: rarity = price * 1000
addPurchasableEventAura("bubble", "Bubble", 500, "summer_2025");

addPurchasableEventAura("parasol", "Parasol", 750, "summer_2025");

addPurchasableEventAura("bioluminescent", "Bioluminescent", 200, "summer_2025", {
  tags: ["pearl-clams"],
});

// SandBasket is Limited on the aura list; current wiki snippet does not expose a normal rarity.
// I kept your earlier 3,500 conversion-style placeholder but made it purchasable/event-tagged.
addPurchasableEventAura("sandbasket", "SandBasket", 3500, "summer_2025", {
  tags: ["placeholder-price"],
});

addLimitedUnknownAura("life_guard", "Life-Guard", "summer_2025", {
  tags: ["purchasable"],
});

addLimitedUnknownAura("ink_paintballgun", "Ink : PaintballGun", "summer_2025", {
  tags: ["purchasable"],
});

// --- Event auras: Season II ---
addLimitedUnknownAura("scorpion", "Scorpion", "season_ii");

// --- Event auras: Halloween 2025 ---
addEventAura("pump_trickster", "Pump : Trickster", 600000, "halloween_2025", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("celestial_wicked", "Celestial : WICKED", 1500000, "halloween_2025", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("lunar_cultist", "Lunar : Cultist", 2000000, "halloween_2025", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("headless", "Headless", 3200000, "halloween_2025", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("werewolf", "Werewolf", 3600000, "halloween_2025", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("shucks", "SHUCKS", 4460000, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("oni", "Oni", 6666666, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("sinister", "Sinister", 15000000, "halloween_2025", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("headless_horseman", "H E A D L E S S H O R S E M A N", 32000000, "halloween_2025", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("reaper", "Reaper", 66000000, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("runic_accursed", "RUNIC ACCURSED", 82000000, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("bloodgarden", "Bloodgarden", 88000000, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("grief", "GRIEF", 88250000, "halloween_2025", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("crimson", "├ CRIMSON ┤", 120000000, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("graveborn", "GRAVEBORN", 290000000, "halloween_2025", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("afterparty", "A F T E R P A R T Y", 440000000, "halloween_2025", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("phantasma", "Phantasma", 462000000, "halloween_2025", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("apocalypse", "A POCALYPSE", 624000000, "halloween_2025", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("wraith_light", "W:R:A:I:T:H / L:I:G:H:T", 695000000, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("malediction", "MALEDICTION", 730000000, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("banshee", "〔BANSHEE〕", 730000000, "halloween_2025", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("ravage", "RAVAGE", 930000000, "halloween_2025", {
  biome: "graveyard",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("arachnophobia", "<ARACHNOPHOBIA>", 940000000, "halloween_2025", {
  biome: "pumpkin_moon",
  biomeLock: true,
  noBreakthrough: true,
});

addEventAura("lamenthyr", "LAMENTHYR", 1000000000, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
  tags: ["transcendent"],
});

addEventAura("erebus", "Erebus", 1200000000, "halloween_2025", {
  biome: "blood_rain",
  biomeLock: true,
  noBreakthrough: true,
  tags: ["transcendent"],
});

addLimitedUnknownAura("veinweaver", "Veinweaver", "halloween_2025");
addLimitedUnknownAura("dreadsea", "∙DREADSEA∙", "halloween_2025");
addLimitedUnknownAura("carousel", "CAROUSEL", "halloween_2025");
addLimitedUnknownAura("lament", "LAMENT", "halloween_2025");
addLimitedUnknownAura("thaneborne", "THANEBORNE", "halloween_2025");

// --- Event auras: Season III ---
addLimitedUnknownAura("slaughter", "Slaughter", "season_iii");

// --- Event auras: Christmas 2025 ---
addEventAura("snowball", "«Snowball»", 10000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 5000,
});

addEventAura("star_rider_snowflake", "Star Rider : Snowflake", 240000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 120000,
});

addEventAura("cryogenic", "Cryogenic", 250000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 250000,
  luckImmune: true,
});

addEventAura("gingerbread", "Gingerbread", 3750000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 1875000,
});

addEventAura("jack_frost", "Jack Frost", 4700000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 2350000,
});

addEventAura("lost_soul_wander", "Lost Soul - WANDER", 9400000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 4700000,
});

addEventAura("frostwood", "« Frostwood »", 24500000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 12250000,
});

addEventAura("north_pole", "- North Pole -", 45000000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 22500000,
});

addEventAura("sky_burst", "Sky Burst!", 60000000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 30000000,
});

addEventAura("encase", "[ENCASE]", 230000000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 115000000,
});

addEventAura("cryofang", "CryoFang", 380000000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 190000000,
});

addEventAura("northern", "‹ NØRTHERN ›", 405000000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 202500000,
});

addEventAura("eve_night", "Eve - Night", 424000000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 212000000,
});

addEventAura("workshop", "Workshop", 700000000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 350000000,
});

addEventAura("parol", "P A R O L", 760000000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 380000000,
});

addEventAura("sovereign_frostveil", "SOVEREIGN : Frostveil", 1000000000, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 500000000,
  tags: ["transcendent"],
});

addEventAura("winter_garden", "Winter Garden", 1450012025, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 725006013,
  tags: ["transcendent"],
});

addEventAura("dream_traveler", "Dream Traveler", 2025012025, "christmas_2025", {
  biome: "aurora",
  nativeRarity: 1012506013,
  tags: ["transcendent"],
});

addLimitedUnknownAura("present", "Present", "christmas_2025");
addLimitedUnknownAura("skyforge", "SKYFORGE", "christmas_2025");
addLimitedUnknownAura("christmastide", "Christmastide", "christmas_2025");
addLimitedUnknownAura("eisveil", "Eisveil", "christmas_2025", {
  unobtainable: true,
});

// --- Event auras: Season IV / Valentines 2026 / Season V ---
addLimitedUnknownAura("reina", "Reina", "season_iv");

addEventAura("symphony_bloomed", "Symphony : Bloomed", 375000000, "valentines_2026");

addLimitedUnknownAura("velvet", "Velvet", "valentines_2026");

addLimitedUnknownAura("blood_demon", "血の悪魔", "season_v");

// --- Event auras: Easter 2026 ---
addEventAura("hatchwarden", "Hatchwarden", 40000000, "easter_2026");
addEventAura("emperor", "EMPEROR", 80000000, "easter_2026");
addEventAura("eggsistence", "Eggsistence", 307777777, "easter_2026");
addEventAura("revive", "Revive", 645000000, "easter_2026");
addEventAura("eggore", "EGGORE", 700000000, "easter_2026");

addEventAura("eostre", "E ostre", 1000000000, "easter_2026", {
  tags: ["transcendent"],
});

addEventAura("eggis", "✿EGGIS EGGIS✿", 1150000000, "easter_2026", {
  tags: ["transcendent"],
});

addEventAura("yolkegg", "Y.O.L.K.E.G.G.", 1790909090, "easter_2026", {
  tags: ["transcendent"],
});

addEventAura("sky_festival", "[ Sky Festival ]", 2000000000, "easter_2026", {
  tags: ["transcendent"],
});

addLimitedUnknownAura("egger", "Egger", "easter_2026");
addLimitedUnknownAura("easter_isles", "easter isles", "easter_2026");
addLimitedUnknownAura("aeroquest", "Aeroquest", "easter_2026");
addLimitedUnknownAura("rabbit_invasion", "Rabbit Invasion", "easter_2026");
addLimitedUnknownAura("scavenger", "Scavenger!", "easter_2026");

// --- Event auras: April Fools 2026 ---
addEventAura("burger", "BURGER", 676767, "april_fools_2026");
addEventAura("your_did_it", "your did it", 1234567, "april_fools_2026");
addEventAura("kidnapped", "KIDNAPPED", 2000000, "april_fools_2026");

addEventAura(
  "very_small_sewage_rat",
  "Very Small Sewage Rat That's About 3.082 Studs Long",
  20070629,
  "april_fools_2026"
);

addEventAura("pukeko_jumping", "Pukeko : Jumping", 31980000, "april_fools_2026");

addEventAura("aether_disappointment", "Aether : Disappointment", 33333330, "april_fools_2026", {
  biome: "heaven",
  nativeRarity: 6666666,
});

addEventAura("bloated_exe", "bloated.exe", 67676767, "april_fools_2026");

addEventAura("imcrine", "IMCRINE", 250000000, "april_fools_2026", {
  biome: "corruption",
  nativeRarity: 50000000,
  deleted: true,
});

addEventAura("doodle_abyssal_hunter", "Doodle : Abyssal Hunter", 400000000, "april_fools_2026");
addEventAura("surfer_symphony", "Surfer : Symphony", 600000000, "april_fools_2026");

addEventAura("ramenpool", "Ramenpool", 630000000, "april_fools_2026", {
  biome: "rainy",
  nativeRarity: 157500000,
});

addEventAura("system_workshop", "System Workshop:", 650000000, "april_fools_2026", {
  biome: "aurora",
  nativeRarity: 325000000,
});

addEventAura("pukeko_god", "P. U. K. E. K. O. G. O. D.", 1000000000, "april_fools_2026", {
  tags: ["transcendent"],
});

addEventAura("a_fools_experience", "A fool's experience...", 1000000000, "april_fools_2026", {
  tags: ["transcendent"],
});

addEventAura("you_are_an_idiot", "『YOU ARE AN IDIOT』", 2500000000, "april_fools_2026", {
  tags: ["transcendent"],
});

// --- Event auras: Season VI ---
addLimitedUnknownAura("zilch", "zilch.", "season_vi");

// --- Unobtainable / dev exclusive ---
add("sol_dev", "Sol", 1, {
  unobtainable: true,
  tags: ["dev-exclusive"],
});

const outPath = join(process.cwd(), "data", "auras.json");

writeFileSync(
  outPath,
  JSON.stringify({ version: "1.0", count: auras.length, auras }, null, 2)
);

console.log(`Written ${auras.length} auras to ${outPath}`);
