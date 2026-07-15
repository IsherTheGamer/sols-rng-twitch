import { truncate } from "./format";

interface GuideEntry {
  id: string;
  name: string;
  aliases?: string[];
  obtain: string;
  use: string;
}

const MATERIALS: GuideEntry[] = [
  {
    id: "scrap",
    name: "Scrap",
    obtain: "Every successful aura roll; Starter Boxes; early achievements and quests.",
    use: "Basic components, chassis, frames, and many early recipes.",
  },
  {
    id: "metal_bits",
    name: "Metal Bits",
    aliases: ["metal", "bits"],
    obtain: "Every successful aura roll.",
    use: "Basic components, chassis, frames, and most component families.",
  },
  {
    id: "mechanical_scrap",
    name: "Mechanical Scrap",
    aliases: ["mechanical"],
    obtain: "Guaranteed 1 every 5 successful aura rolls. It is intentionally not sold in shops.",
    use: "Early components, chassis, and frames; prevents infinite crafting from common drops.",
  },
  {
    id: "circuit_scrap",
    name: "Circuit Scrap",
    aliases: ["circuit", "circuit_scrape"],
    obtain: "Any 1/450+ aura roll; Daily Crafting quest; Starter Boxes.",
    use: "Tier 3+ components, frames, SHD upgrades, and electronics.",
  },
  {
    id: "signal_fragment",
    name: "Signal Fragment",
    aliases: ["signal"],
    obtain: "Any 1/10,000+ aura roll; daily quests; Starter/Quest Boxes; SHD achievement rewards.",
    use: "Mid-tier crafting, SHD, Stellar Regulator, and electronics.",
  },
  {
    id: "refined_alloy",
    name: "Refined Alloy",
    aliases: ["refined"],
    obtain: "Any 1/50,000+ aura roll; daily/weekly quests; Core and Quest Boxes.",
    use: "Tier 5+ crafting, special components, path systems, and SHD upgrades.",
  },
  {
    id: "stabilized_flux",
    name: "Stabilized Flux",
    aliases: ["flux"],
    obtain: "Any 1/1,000,000+ aura roll; weekly quests; Core Boxes; Million Hunter achievement.",
    use: "Tier 6+ crafting, advanced matrices, walls, and reactor upgrades.",
  },
  {
    id: "quantum_residue",
    name: "Quantum Residue",
    aliases: ["quantum"],
    obtain: "Any 1/10,000,000+ aura roll; weekly rare quest; Reactor Boxes; Million Hunter achievement.",
    use: "Tier 7+ components, path parts, SHD upgrades, and reactor upgrades.",
  },
  {
    id: "reality_thread",
    name: "Reality Thread",
    aliases: ["reality", "thread"],
    obtain: "Any 1/100,000,000+ aura roll; weekly rare quest; Reactor Boxes; occasional Black Market packs.",
    use: "Tier 8+ crafting, Realignment Matrix, SHD, and late reactor upgrades.",
  },
  {
    id: "singularity_shard",
    name: "Singularity Shard",
    aliases: ["singularity", "shard"],
    obtain: "Any 1/1,000,000,000+ aura roll; occasional Black Market packs.",
    use: "Late-game recipes and singularity-tier progression.",
  },
  {
    id: "dimensional_seal",
    name: "Dimensional Seal",
    aliases: ["seal", "dimensional"],
    obtain: "Any 1/250,000,000+ aura roll; Anomaly Boxes.",
    use: "Tier 9+ crafting and late-game progression.",
  },
  {
    id: "anomaly_matter",
    name: "Anomaly Matter",
    aliases: ["anomaly"],
    obtain: "Any 1/500,000,000+ aura roll; Anomaly Boxes; Dev Boxes.",
    use: "Tier 10 crafting, anomaly path parts, final cores, and forbidden systems.",
  },
  {
    id: "forbidden_circuit",
    name: "Forbidden Circuit",
    aliases: ["forbidden"],
    obtain: "Any 1/5,000,000,000+ aura roll; Anomaly Boxes.",
    use: "Final cores, Forbidden-tier recipes, and Null Processor systems.",
  },
  {
    id: "debug_fragment",
    name: "Debug Fragment",
    aliases: ["debug"],
    obtain: "Dev Box/admin or developer rewards only.",
    use: "Developer-exclusive and debug recipes.",
  },
  {
    id: "thermal_paste",
    name: "Thermal Paste",
    aliases: ["thermal", "paste"],
    obtain: "Special advanced reward material. It is not in the normal rarity-drop table; check event, market, blueprint, or future reward rotations.",
    use: "Stellar Regulator and advanced precision/electronic recipes.",
  },
  {
    id: "conductive_gel",
    name: "Conductive Gel",
    aliases: ["conductive", "gel"],
    obtain: "Special advanced reward material. It is not in the normal rarity-drop table; check event, market, blueprint, or future reward rotations.",
    use: "Support Regulator and advanced electronics.",
  },
  {
    id: "energy_cell",
    name: "Energy Cell",
    aliases: ["energy"],
    obtain: "Special advanced reward material. It is not in the normal rarity-drop table; check event, market, blueprint, or future reward rotations.",
    use: "Token Amplifier and power-related recipes.",
  },
  {
    id: "glitched_alloy",
    name: "Glitched Alloy",
    aliases: ["glitched"],
    obtain: "Any 1/1,000,000,000+ aura roll.",
    use: "Anomaly Compressor and glitched late-game recipes.",
  },
  {
    id: "chrono_dust",
    name: "Chrono Dust",
    aliases: ["chrono"],
    obtain: "Any 1/5,000,000+ aura roll.",
    use: "Time/chrono-flavoured advanced recipes.",
  },
  {
    id: "void_glass",
    name: "Void Glass",
    aliases: ["void"],
    obtain: "Any 1/25,000,000+ aura roll.",
    use: "Biome Lens and void-related advanced recipes.",
  },
  {
    id: "stellar_ink",
    name: "Stellar Ink",
    aliases: ["stellar", "ink"],
    obtain: "Any 1/75,000,000+ aura roll.",
    use: "Biome Lens and stellar/blueprint recipes.",
  },
];

const TOKENS: GuideEntry[] = [
  {
    id: "recipe_token",
    name: "Recipe Token",
    aliases: ["recipe"],
    obtain: "Weekly quests, SHD story quest, Core milestones/achievements, Core/Anomaly/Reactor Boxes, and some events.",
    use: "Advanced components, high cores, SHD, reactor upgrades, and late crafting.",
  },
  {
    id: "path_token",
    name: "Path Token",
    aliases: ["path"],
    obtain: "Core 15/path story progression, Core 15 reward, Dev Boxes, and selected progression rewards.",
    use: "Choose or switch Core paths and craft Realignment systems.",
  },
  {
    id: "reactor_token",
    name: "Reactor Token",
    aliases: ["reactor"],
    obtain: "Reactor story quest, Reactor Online achievement, and Reactor Boxes.",
    use: "Higher Stardust Reactor upgrades.",
  },
  {
    id: "crafting_token",
    name: "Crafting Token",
    aliases: ["crafting", "craft"],
    obtain: "Daily Crafting quest and Quest Boxes.",
    use: "Crafting-related bonuses and future advanced recipes.",
  },
  {
    id: "quest_token",
    name: "Quest Token",
    aliases: ["quest"],
    obtain: "Daily Rolling quest, Starter/Quest Boxes, rare quests, and path bonus chances.",
    use: "Quest and progression systems.",
  },
  {
    id: "wall_token",
    name: "Wall Token",
    aliases: ["wall"],
    obtain: "Weekly Core quest, Core milestone achievements, Core Boxes, Anomaly Boxes, and Dev Boxes.",
    use: "Randomized wall cores, Sub-Cores, and path wall components.",
  },
  {
    id: "anomaly_token",
    name: "Anomaly Token",
    aliases: ["anomaly"],
    obtain: "Anomaly Boxes and rare anomaly progression rewards.",
    use: "Null Processor and anomaly-exclusive late recipes.",
  },
];

const BOXES: GuideEntry[] = [
  {
    id: "starter_box",
    name: "Starter Box",
    aliases: ["starter"],
    obtain: "First Hundred achievement, SHD story/achievement, and beginner rewards.",
    use: "Contains Scrap, Circuit Scrap, Signal Fragments, and a Quest Token.",
  },
  {
    id: "core_box",
    name: "Core Box",
    aliases: ["core"],
    obtain: "Every 10th Core, weekly Core/roll quests, Core 50 achievement, and progression rewards.",
    use: "Contains Refined Alloy, Stabilized Flux, Recipe Tokens, and possible Wall Tokens.",
  },
  {
    id: "quest_box",
    name: "Quest Box",
    aliases: ["quest"],
    obtain: "Daily Rare Hunt, 10,000-roll achievement, and quest rewards.",
    use: "Contains Signal Fragments, Refined Alloy, Quest Tokens, and Crafting Tokens.",
  },
  {
    id: "reactor_box",
    name: "Reactor Box",
    aliases: ["reactor"],
    obtain: "Reactor story quest, Reactor Online achievement, and reactor rewards.",
    use: "Contains Quantum Residue, Reality Thread, Reactor Token, and possible Recipe Token.",
  },
  {
    id: "anomaly_box",
    name: "Anomaly Box",
    aliases: ["anomaly"],
    obtain: "Core 100 story/achievement, Dev Boxes, and late progression.",
    use: "Contains Anomaly Matter, Dimensional Seals, Forbidden Circuits, Anomaly Token, and Recipe Tokens.",
  },
  {
    id: "dev_box",
    name: "Dev Box",
    aliases: ["dev", "developer"],
    obtain: "Developer/admin rewards only.",
    use: "Contains Debug Fragments, Anomaly Matter, several tokens, and an Anomaly Box.",
  },
];

const COMPONENT_FAMILIES = [
  "wire",
  "cable",
  "plate",
  "rod",
  "screw",
  "bolt",
  "coil",
  "resistor",
  "smd_resistor",
  "transistor",
  "smd_transistor",
  "capacitor",
  "smd_capacitor",
  "diode",
  "smd_diode",
  "fuse",
  "relay",
  "sensor",
  "emitter",
  "lens",
  "heat_sink",
  "battery_cell",
  "power_cell",
  "circuit_board",
  "processor",
  "logic_chip",
  "regulator",
  "stabilizer",
  "conduit",
  "matrix",
] as const;

function normalize(input: string | undefined | null): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/^!+/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleCase(input: string): string {
  return input
    .split(/[_\-\s:]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findEntry(entries: GuideEntry[], raw: string): GuideEntry | undefined {
  const q = normalize(raw);
  if (!q) return undefined;

  return entries.find((entry) => {
    const names = [entry.id, entry.name, ...(entry.aliases ?? [])].map(normalize);
    return names.includes(q) || names.some((name) => name.replace(/_/g, "") === q.replace(/_/g, ""));
  });
}

function parsePage(raw: string | undefined | null, totalPages: number): number {
  const n = Number(String(raw ?? "1").replace(/,/g, ""));
  return Math.max(1, Math.min(totalPages, Number.isFinite(n) ? Math.floor(n) : 1));
}

function formatEntry(entry: GuideEntry, icon: string): string {
  return truncate(`${icon} ${entry.name} | Obtain: ${entry.obtain} | Used for: ${entry.use}`, 390);
}

function formatPage(entries: GuideEntry[], pageRaw: string | undefined, title: string, icon: string): string {
  const pageSize = 3;
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const page = parsePage(pageRaw, totalPages);
  const shown = entries.slice((page - 1) * pageSize, page * pageSize);
  return truncate(
    `${title} ${page}/${totalPages}: ${shown.map((entry) => `${entry.name} — ${entry.obtain}`).join(" | ")}`,
    390
  );
}

export function formatMaterialGuide(query = "", pageRaw = "1"): string {
  if (query && !/^\d+$/.test(query)) {
    const entry = findEntry(MATERIALS, query);
    if (!entry) return `Unknown material: ${query}. Try !info materials or !info obtain <item>.`;
    return formatEntry(entry, "🧱");
  }

  return formatPage(MATERIALS, /^\d+$/.test(query) ? query : pageRaw, "🧱 Material Sources", "🧱");
}

export function formatTokenSourceGuide(query = "", pageRaw = "1"): string {
  if (query && !/^\d+$/.test(query)) {
    const entry = findEntry(TOKENS, query);
    if (!entry) return `Unknown Core token: ${query}. Try !info token sources.`;
    return formatEntry(entry, "🎟️");
  }

  return formatPage(TOKENS, /^\d+$/.test(query) ? query : pageRaw, "🎟️ Token Sources", "🎟️");
}

export function isKnownTokenGuide(query: string): boolean {
  return Boolean(findEntry(TOKENS, query));
}

export function formatBoxGuide(query = "", pageRaw = "1"): string {
  if (query && !/^\d+$/.test(query)) {
    const entry = findEntry(BOXES, query);
    if (!entry) return `Unknown box: ${query}. Try !info boxes.`;
    return formatEntry(entry, "📦");
  }

  return formatPage(BOXES, /^\d+$/.test(query) ? query : pageRaw, "📦 Box Sources", "📦");
}

function normalizeComponentId(query: string): { id: string; family: string; tier: number } | null {
  const id = normalize(query);
  if (!id) return null;

  const match = id.match(/^(.+?)_(\d+)$/);
  const rawFamily = match?.[1] ?? id;
  const family = COMPONENT_FAMILIES.find(
    (candidate) =>
      normalize(candidate) === normalize(rawFamily) ||
      normalize(titleCase(candidate)) === normalize(rawFamily)
  );

  if (!family) return null;

  return {
    id: `${family}_${Math.max(1, Math.min(10, Number(match?.[2] ?? 1)))}`,
    family,
    tier: Math.max(1, Math.min(10, Number(match?.[2] ?? 1))),
  };
}

export function formatComponentGuide(query = "", pageRaw = "1"): string {
  if (query && !/^\d+$/.test(query)) {
    const parsed = normalizeComponentId(query);
    if (!parsed) {
      return `Unknown component family: ${query}. Try !info components or !craft recipe <component>_<tier>.`;
    }

    const output =
      parsed.tier <= 5
        ? "Tiers 1-5 normally make x2 per batch."
        : parsed.tier <= 7
        ? "Tiers 6-7 make x1 but have a built-in duplicate-batch chance."
        : "Late tiers make x1 and may require Recipe Tokens.";

    return truncate(
      `⚙️ ${titleCase(parsed.id)} | Obtain: craft with !craft recipe ${parsed.id}. Higher tiers usually require the previous tier plus rarity materials. ${output}`,
      390
    );
  }

  const entries = COMPONENT_FAMILIES.map((family) => ({
    id: family,
    name: titleCase(family),
    obtain: `Craft with !craft recipe ${family}_1; use _2 through _10 for higher tiers.`,
    use: "Core, frame, SHD, reactor, path, and advanced crafting recipes.",
  }));

  return formatPage(entries, /^\d+$/.test(query) ? query : pageRaw, "⚙️ Component Sources", "⚙️");
}

export function formatObtainGuide(query = "", pageRaw = "1"): string {
  const q = query.trim();

  if (!q || /^\d+$/.test(q)) {
    return truncate(
      "🔎 Obtain Guide: !info material <name> | !info component <name_tier> | !info token sources [page] | !info box <name> | Example: !info material circuit_scrap",
      390
    );
  }

  const material = findEntry(MATERIALS, q);
  if (material) return formatEntry(material, "🧱");

  const token = findEntry(TOKENS, q);
  if (token) return formatEntry(token, "🎟️");

  const box = findEntry(BOXES, q);
  if (box) return formatEntry(box, "📦");

  const component = normalizeComponentId(q);
  if (component) return formatComponentGuide(q, pageRaw);

  return `No obtain guide found for ${q}. Try its exact ID with underscores.`;
}
