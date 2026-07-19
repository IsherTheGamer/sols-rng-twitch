import {
  aliasSuggestionText,
  normalizeAlias,
  resolveAlias,
  type AliasCandidate,
  type AliasResolution,
} from "./fuzzy-alias";

export type CorePathName =
  | "safe"
  | "risk"
  | "support"
  | "biome"
  | "precision"
  | "token"
  | "anomaly";

function textCandidate<T extends string>(
  id: T,
  label: string,
  aliases: readonly string[] = []
): AliasCandidate<T> {
  return { id, label, aliases, value: id };
}

export const CORE_ACTIONS = [
  textCandidate("status", "status", ["stats", "stat", "staus", "stauts", "show"]),
  textCandidate("upgrade", "upgrade", ["upg", "level", "craft core", "advance"]),
  textCandidate("recipe", "recipe", ["recepie", "recipie", "cost", "requirements", "req"]),
  textCandidate("focus", "focus", ["fokus", "target"]),
  textCandidate("choose", "choose", ["chooze", "chose", "select", "pick"]),
  textCandidate("switch", "switch", ["swap", "change path", "realign"]),
  textCandidate("tokens", "tokens", ["token list", "token guide"]),
  textCandidate("token", "token", ["tokn", "use token"]),
] as const;

export const CORE_PATHS: AliasCandidate<CorePathName>[] = [
  textCandidate("safe", "Safe", ["easy", "stable", "stability", "defensive"]),
  textCandidate("risk", "Risk", ["risky", "hard", "aggressive", "volatile"]),
  textCandidate("support", "Support", ["utility", "helper", "discount", "quest"]),
  textCandidate("biome", "Biome", ["biomes", "world", "climate"]),
  textCandidate("precision", "Precision", ["precise", "accurate", "targeting"]),
  textCandidate("token", "Token", ["tokens", "voucher", "mint"]),
  textCandidate("anomaly", "Anomaly", ["anomoly", "anomalous", "glitch", "chaos"]),
];

export const CORE_FOCUS = [
  textCandidate("main", "main", ["main core", "primary", "normal"]),
  textCandidate("sub", "sub", ["subcore", "sub core", "aux", "auxiliary"]),
] as const;

export const CORE_TOKENS = [
  textCandidate("recipe", "Recipe Token", ["recipe_token", "recipe tokens"]),
  textCandidate("path", "Path Token", ["path_token", "path tokens"]),
  textCandidate("reactor", "Reactor Token", ["reactor_token", "reactor tokens"]),
  textCandidate("crafting", "Crafting Token", ["craft", "crafting_token", "discount token"]),
  textCandidate("quest", "Quest Token", ["quest_token", "quest tokens"]),
  textCandidate("wall", "Wall Token", ["wall_token", "wall tokens"]),
  textCandidate("anomaly", "Anomaly Token", ["anomoly", "anomaly_token"]),
] as const;

export const BOXES = [
  textCandidate("starter_box", "Starter Box", ["starter", "start", "beginner box"]),
  textCandidate("core_box", "Core Box", ["core", "cores box"]),
  textCandidate("quest_box", "Quest Box", ["quest", "daily box", "weekly box"]),
  textCandidate("reactor_box", "Reactor Box", ["reactor"]),
  textCandidate("anomaly_box", "Anomaly Box", ["anomaly", "anomoly box"]),
  textCandidate("dev_box", "Dev Box", ["dev", "developer box", "admin box"]),
] as const;

export const TOKEN_ACTIONS = [
  textCandidate("list", "list", ["tokens", "show"]),
  textCandidate("boosts", "boosts", ["boost", "timed", "percent"]),
  textCandidate("special", "special", ["rare", "final", "flat"]),
  textCandidate("potions", "potions", ["potion", "roll", "rolls"]),
  textCandidate("use", "use", ["activate", "pop", "consume"]),
  textCandidate("refund", "refund", ["return", "cancel", "undo"]),
  textCandidate("give", "give", ["grant", "send", "add"]),
  textCandidate("help", "help", ["commands", "guide"]),
] as const;

export const RESEARCH_ACTIONS = [
  textCandidate("guide", "guide", ["help", "how"]),
  textCandidate("branches", "branches", ["branch", "tree", "paths"]),
  textCandidate("next", "next", ["recommend", "recommended", "best"]),
  textCandidate("info", "info", ["detail", "details", "inspect"]),
  textCandidate("unlock", "unlock", ["buy", "research", "learn"]),
  textCandidate("archive", "archive", ["knowledge", "memory"]),
  textCandidate("crafting", "crafting", ["craft", "workshop"]),
  textCandidate("core", "core", ["cores", "mapping"]),
  textCandidate("relic", "relic", ["relics"]),
  textCandidate("scanner", "scanner", ["scan"]),
  textCandidate("boss", "boss", ["hunter", "damage"]),
  textCandidate("market", "market", ["shop", "merchant"]),
  textCandidate("blueprint", "blueprint", ["blueprints", "bp"]),
  textCandidate("forecast", "forecast", ["prediction", "predict"]),
] as const;

export const BLUEPRINT_ACTIONS = [
  textCandidate("list", "list", ["status", "show"]),
  textCandidate("guide", "guide", ["help", "how"]),
  textCandidate("info", "info", ["detail", "details", "inspect"]),
  textCandidate("assemble", "assemble", ["unlock", "build", "craft", "make"]),
] as const;

export const RELIC_ACTIONS = [
  textCandidate("guide", "guide", ["help", "how"]),
  textCandidate("list", "list", ["show", "inventory"]),
  textCandidate("forge", "forge", ["craft", "make", "create"]),
  textCandidate("info", "info", ["detail", "details", "inspect"]),
  textCandidate("equip", "equip", ["wear", "use"]),
  textCandidate("unequip", "unequip", ["remove", "take off"]),
  textCandidate("upgrade", "upgrade", ["level", "level up"]),
  textCandidate("reroll", "reroll", ["reforge", "roll rarity", "change rarity"]),
] as const;

export const BOSS_ACTIONS = [
  textCandidate("status", "status", ["show", "info"]),
  textCandidate("start", "start", ["spawn", "begin", "summon"]),
  textCandidate("beacon", "beacon", ["becon", "boss beacon", "signal"]),
] as const;

export const INFO_TOPICS = [
  textCandidate("help", "help", ["info"]),
  textCandidate("start", "start", ["begin", "beginner"]),
  textCandidate("currencies", "currencies", ["currency", "money"]),
  textCandidate("commands", "commands", ["cmds", "command"]),
  textCandidate("activity", "activity", ["knowledge", "aok"]),
  textCandidate("research", "research"),
  textCandidate("relics", "relics", ["relic"]),
  textCandidate("blueprints", "blueprints", ["blueprint", "bp"]),
  textCandidate("auras", "auras", ["aura"]),
  textCandidate("biomes", "biomes", ["biome"]),
  textCandidate("potions", "potions", ["potion"]),
  textCandidate("tokens", "tokens", ["token"]),
  textCandidate("boosts", "boosts", ["boost"]),
  textCandidate("special", "special"),
  textCandidate("paths", "paths", ["path"]),
  textCandidate("materials", "materials", ["material", "mats"]),
  textCandidate("components", "components", ["component", "parts"]),
  textCandidate("boxes", "boxes", ["box"]),
  textCandidate("obtain", "obtain", ["source", "sources", "how", "get"]),
  textCandidate("events", "events", ["event"]),
  textCandidate("dev", "dev", ["devs", "developer"]),
  textCandidate("devices", "devices", ["device"]),
  textCandidate("core", "core", ["cores"]),
  textCandidate("shd", "shd", ["hard drive", "stellar hard drive"]),
  textCandidate("reactor", "reactor"),
  textCandidate("quests", "quests", ["quest"]),
] as const;

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

const FAMILY_ALIASES: Partial<Record<(typeof COMPONENT_FAMILIES)[number], string[]>> = {
  smd_resistor: ["smd resistor", "small resistor"],
  smd_transistor: ["smd transistor", "small transistor"],
  smd_capacitor: ["smd capacitor", "small capacitor"],
  smd_diode: ["smd diode", "small diode"],
  heat_sink: ["heat sink", "heatsink"],
  battery_cell: ["battery cell", "battery"],
  power_cell: ["power cell", "powercell"],
  circuit_board: ["circuit board", "circuit bored", "board", "circuit"],
  logic_chip: ["logic chip", "chip"],
};

const TIER_NAMES = [
  "basic",
  "copper",
  "refined",
  "stabilized",
  "quantum",
  "reality",
  "singularity",
  "dimensional",
  "anomaly",
  "forbidden",
] as const;

const PATH_COMPONENT_IDS = [
  "stability_buffer",
  "stability_lock",
  "quantum_anchor",
  "reality_bastion",
  "singularity_seal",
  "absolute_lock",
  "volatile_capacitor",
  "risk_compressor",
  "chaos_engine",
  "rupture_core",
  "singularity_overdrive",
  "cataclysm_drive",
  "support_relay",
  "support_regulator",
  "logistics_matrix",
  "restoration_hub",
  "quantum_coordinator",
  "celestial_network",
  "biome_sensor",
  "biome_lens",
  "climate_resonator",
  "dimensional_ecoscope",
  "worldseed_prism",
  "omnibiome_array",
  "targeting_filter",
  "precision_filter",
  "probability_calibrator",
  "reality_sieve",
  "singularity_scope",
  "absolute_predictor",
  "token_socket",
  "token_amplifier",
  "voucher_encoder",
  "token_reactor",
  "infinite_ledger",
  "sovereign_mint",
  "instability_buffer",
  "anomaly_compressor",
  "rift_decoder",
  "null_processor",
  "paradox_engine",
  "forbidden_singularity",
] as const;

const SPECIAL_COMPONENTS = [
  "divergence_matrix",
  "realignment_matrix",
  "stellar_regulator",
] as const;

function titleCase(value: string): string {
  return value
    .split(/[_\-\s:]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildCraftCandidates(): AliasCandidate<string>[] {
  const generated = COMPONENT_FAMILIES.flatMap((family) =>
    TIER_NAMES.map((tierName, index) => {
      const tier = index + 1;
      const id = `${family}_${tier}`;
      const familyNames = [titleCase(family), ...(FAMILY_ALIASES[family] ?? [])];
      const aliases = familyNames.flatMap((familyName) => [
        `${tierName} ${familyName}`,
        `${familyName} ${tierName}`,
        `${familyName} tier ${tier}`,
        `tier ${tier} ${familyName}`,
        `${familyName} ${tier}`,
      ]);

      return {
        id,
        label: `${titleCase(tierName)} ${titleCase(family)}`,
        aliases,
        value: id,
      } satisfies AliasCandidate<string>;
    })
  );

  const path = PATH_COMPONENT_IDS.map((id) => ({
    id,
    label: titleCase(id),
    aliases: [id.replace(/_/g, " ")],
    value: id,
  }));

  const special = SPECIAL_COMPONENTS.map((id) => ({
    id,
    label: titleCase(id),
    aliases: [id.replace(/_/g, " ")],
    value: id,
  }));

  return [...generated, ...path, ...special];
}

export const CRAFT_ITEMS = buildCraftCandidates();

export function resolveTextAlias<T extends string>(
  raw: string,
  candidates: readonly AliasCandidate<T>[],
  subject: string,
  options: { strict?: boolean } = {}
): { value?: T; error?: string; corrected?: boolean } {
  const resolution = resolveAlias(raw, candidates, {
    ambiguityGap: options.strict ? 0.075 : 0.055,
    maxScore: options.strict ? 0.28 : undefined,
  });

  if (resolution.status === "matched") {
    return {
      value: resolution.match.value,
      corrected: resolution.corrected,
    };
  }

  return {
    error: aliasSuggestionText(resolution, subject),
  };
}

export function resolveCraftItem(raw: string): {
  value?: string;
  error?: string;
  corrected?: boolean;
} {
  const normalized = normalizeAlias(raw);

  if (normalized === "chassis" || normalized === "core chassis") {
    return { value: "chassis", corrected: normalized !== "chassis" };
  }
  if (normalized === "frame" || normalized === "core frame") {
    return { value: "frame", corrected: normalized !== "frame" };
  }

  return resolveTextAlias(raw, CRAFT_ITEMS, "crafting item", { strict: true });
}

export function resolveCorePath(raw: string) {
  return resolveTextAlias(raw, CORE_PATHS, "Core path", { strict: true });
}

export function resolveCoreFocus(raw: string) {
  return resolveTextAlias(raw, CORE_FOCUS, "Core focus", { strict: true });
}

export function resolveCoreToken(raw: string) {
  return resolveTextAlias(raw, CORE_TOKENS, "Core token", { strict: true });
}

export function resolveBox(raw: string) {
  return resolveTextAlias(raw, BOXES, "box", { strict: true });
}
