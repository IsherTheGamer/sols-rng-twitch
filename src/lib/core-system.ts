import { Redis } from "@upstash/redis";
import type { NightbotUser } from "./nightbot";
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

export type CorePath =
  | "universal"
  | "safe"
  | "risk"
  | "support"
  | "biome"
  | "precision"
  | "token"
  | "anomaly";

export type CoreFocus = "main" | "sub";

export interface CoreSystemState {
  channelId: string;
  userId: string;
  displayName: string;

  coreTier: number;
  corePath: CorePath;
  coreFocus: CoreFocus;

  shdLevel: number;
  stardust: number;

  wallSeed: string;
  materials: Record<string, number>;
  components: Record<string, number>;
  frames: Record<string, number>;
  subCores: Record<string, boolean>;
  activeSubCoreId: string | null;

  reactor: ReactorState;

  activeJobs: Record<string, ActiveJob | undefined>;

  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
}

export interface ActiveJob {
  id: string;
  progress: Record<string, number>;
}

export interface ReactorDeposit {
  amount: number;
  bonusPercent: number;
  startedAt: number;
  unlockAt: number;
}

export interface ReactorState {
  level: number;
  activeDeposit: ReactorDeposit | null;
}

export interface RollHitForCore {
  aura: {
    id: string;
    name: string;
  };
  effectiveRarity: number;
}

interface RollRequirement {
  key: string;
  label: string;
  amount: number;
  type: "rarityAtLeast" | "specificAura";
  rarity?: number;
  auraId?: string;
  auraName?: string;
}

interface CraftCosts {
  stardust?: number;
  materials?: Record<string, number>;
  components?: Record<string, number>;
  frames?: Record<string, number>;
  activeRolls?: RollRequirement[];
  coreTierRequired?: number;
}

interface ComponentRecipe {
  id: string;
  name: string;
  outputAmount?: number;
  costs: CraftCosts;
}

const TOTAL_CORES = 250;
const PATH_SPLIT_CORE = 15;

const SHD_CAPS: Record<number, number> = {
  0: 500,
  1: 100000,
  2: 250000,
  3: 500000,
  4: 1000000,
  5: 2500000,
  6: 10000000,
  7: 50000000,
  8: 250000000,
  9: 1000000000,
  10: 10000000000,
};

const SHD_CORE_REQUIREMENTS: Record<number, number> = {
  1: 10,
  2: 25,
  3: 50,
  4: 75,
  5: 100,
  6: 125,
  7: 150,
  8: 175,
  9: 200,
  10: 225,
};

const REACTOR_LOCK_MS = 12 * 60 * 60 * 1000;

const MATERIAL_NAMES: Record<string, string> = {
  scrap: "Scrap",
  metal_bits: "Metal Bits",
  circuit_scrap: "Circuit Scrap",
  signal_fragment: "Signal Fragment",
  refined_alloy: "Refined Alloy",
  stabilized_flux: "Stabilized Flux",
  quantum_residue: "Quantum Residue",
  reality_thread: "Reality Thread",
  singularity_shard: "Singularity Shard",
};

const COMPONENT_RECIPES: Record<string, ComponentRecipe> = {
  basic_wire: {
    id: "basic_wire",
    name: "Basic Wire",
    costs: { materials: { scrap: 20 } },
  },
  basic_plate: {
    id: "basic_plate",
    name: "Basic Plate",
    costs: { materials: { scrap: 25, metal_bits: 5 } },
  },
  copper_wire: {
    id: "copper_wire",
    name: "Copper Wire",
    costs: { materials: { scrap: 30 }, components: { basic_wire: 2 } },
  },
  refined_plate: {
    id: "refined_plate",
    name: "Refined Plate",
    costs: { materials: { refined_alloy: 3 }, components: { basic_plate: 2 } },
  },
  basic_circuit: {
    id: "basic_circuit",
    name: "Basic Circuit",
    costs: {
      materials: { circuit_scrap: 20 },
      components: { basic_wire: 3, basic_plate: 2 },
    },
  },
  basic_resistor: {
    id: "basic_resistor",
    name: "Basic Resistor",
    costs: {
      materials: { circuit_scrap: 15, signal_fragment: 2 },
      components: { basic_wire: 1 },
    },
  },
  smd_resistor: {
    id: "smd_resistor",
    name: "SMD Resistor",
    costs: {
      materials: { circuit_scrap: 75, signal_fragment: 15 },
      components: { basic_resistor: 3 },
    },
  },
  basic_capacitor: {
    id: "basic_capacitor",
    name: "Basic Capacitor",
    costs: {
      materials: { circuit_scrap: 15 },
      components: { basic_plate: 1 },
    },
  },
  basic_transistor: {
    id: "basic_transistor",
    name: "Basic Transistor",
    costs: {
      materials: { signal_fragment: 10 },
      components: { basic_resistor: 2, basic_circuit: 1 },
    },
  },
  power_cell: {
    id: "power_cell",
    name: "Power Cell",
    costs: {
      materials: { signal_fragment: 15 },
      components: { basic_capacitor: 2, refined_plate: 2 },
    },
  },
  realignment_matrix: {
    id: "realignment_matrix",
    name: "Realignment Matrix",
    costs: {
      materials: { stabilized_flux: 100, quantum_residue: 10 },
      components: { divergence_matrix: 1, smd_resistor: 10, power_cell: 5 },
    },
  },
  stellar_regulator: {
    id: "stellar_regulator",
    name: "Stellar Regulator",
    costs: {
      materials: { signal_fragment: 250, refined_alloy: 100 },
      components: { power_cell: 3, basic_transistor: 3, smd_resistor: 5 },
    },
  },
  divergence_matrix: {
    id: "divergence_matrix",
    name: "Divergence Matrix",
    costs: {
      materials: { refined_alloy: 50, signal_fragment: 100 },
      components: { smd_resistor: 5, basic_circuit: 5, power_cell: 2 },
    },
  },
  stability_lock: {
    id: "stability_lock",
    name: "Stability Lock",
    costs: {
      materials: { stabilized_flux: 25, refined_alloy: 75 },
      components: { smd_resistor: 4, power_cell: 2 },
    },
  },
  anomaly_compressor: {
    id: "anomaly_compressor",
    name: "Anomaly Compressor",
    costs: {
      materials: { quantum_residue: 5, stabilized_flux: 50 },
      components: { smd_resistor: 6, basic_transistor: 3 },
    },
  },
  support_regulator: {
    id: "support_regulator",
    name: "Support Regulator",
    costs: {
      materials: { signal_fragment: 150, refined_alloy: 60 },
      components: { basic_circuit: 8, power_cell: 2 },
    },
  },
  biome_lens: {
    id: "biome_lens",
    name: "Biome Lens",
    costs: {
      materials: { stabilized_flux: 40, signal_fragment: 120 },
      components: { refined_plate: 8, basic_circuit: 5 },
    },
  },
  precision_filter: {
    id: "precision_filter",
    name: "Precision Filter",
    costs: {
      materials: { signal_fragment: 180, refined_alloy: 75 },
      components: { smd_resistor: 7, basic_circuit: 6 },
    },
  },
  token_amplifier: {
    id: "token_amplifier",
    name: "Token Amplifier",
    costs: {
      materials: { stabilized_flux: 40, circuit_scrap: 250 },
      components: { basic_transistor: 4, power_cell: 3 },
    },
  },
  null_processor: {
    id: "null_processor",
    name: "Null Processor",
    costs: {
      materials: { quantum_residue: 10, reality_thread: 2 },
      components: { smd_resistor: 8, basic_transistor: 5, power_cell: 4 },
    },
  },
};

const WALL_COMPONENT_BY_PATH: Record<CorePath, string> = {
  universal: "stability_lock",
  safe: "stability_lock",
  risk: "anomaly_compressor",
  support: "support_regulator",
  biome: "biome_lens",
  precision: "precision_filter",
  token: "token_amplifier",
  anomaly: "null_processor",
};

const CORE_LUCK_TARGET_PERCENT: Record<CorePath, number> = {
  universal: 3900,
  safe: 3900,
  risk: 2200,
  support: 2500,
  biome: 2200,
  precision: 3000,
  token: 2300,
  anomaly: 2600,
};

function stateKey(channelId: string, userId: string): string {
  return `core-system:${channelId}:${userId}`;
}

function channelActivityKey(channelId: string): string {
  return `core-channel-active:${channelId}`;
}

function getUserId(user: NightbotUser | null): string {
  return user?.providerId ?? "anon";
}

function getDisplayName(user: NightbotUser | null): string {
  return user?.displayName ?? user?.name ?? "Player";
}

function makeSeed(channelId: string, userId: string): string {
  return `${channelId}:${userId}:${Date.now()}:${Math.random()}`;
}

function createDefaultCoreState(
  channelId: string,
  userId: string,
  displayName: string
): CoreSystemState {
  const now = Date.now();

  return {
    channelId,
    userId,
    displayName,
    coreTier: 0,
    corePath: "universal",
    coreFocus: "main",
    shdLevel: -1,
    stardust: 0,
    wallSeed: makeSeed(channelId, userId),
    materials: {},
    components: {},
    frames: {},
    subCores: {},
    activeSubCoreId: null,
    reactor: {
      level: 0,
      activeDeposit: null,
    },
    activeJobs: {},
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
  };
}

function normalizeCoreState(
  input: Partial<CoreSystemState> | null | undefined,
  channelId: string,
  userId: string,
  displayName: string
): CoreSystemState {
  const base = createDefaultCoreState(channelId, userId, displayName);

  if (!input) return base;

  return {
    channelId: input.channelId ?? channelId,
    userId: input.userId ?? userId,
    displayName: displayName || input.displayName || base.displayName,
    coreTier: Math.max(0, Math.floor(input.coreTier ?? 0)),
    corePath: input.corePath ?? "universal",
    coreFocus: input.coreFocus ?? "main",
    shdLevel: Math.max(-1, Math.floor(input.shdLevel ?? -1)),
    stardust: Math.max(0, Math.floor(input.stardust ?? 0)),
    wallSeed: input.wallSeed ?? base.wallSeed,
    materials: input.materials ?? {},
    components: input.components ?? {},
    frames: input.frames ?? {},
    subCores: input.subCores ?? {},
    activeSubCoreId: input.activeSubCoreId ?? null,
    reactor: {
      level: Math.max(0, Math.min(25, Math.floor(input.reactor?.level ?? 0))),
      activeDeposit: input.reactor?.activeDeposit ?? null,
    },
    activeJobs: input.activeJobs ?? {},
    createdAt: input.createdAt ?? base.createdAt,
    updatedAt: Date.now(),
    lastActiveAt: Date.now(),
  };
}

export async function getCoreState(
  channelId: string,
  user: NightbotUser | null
): Promise<CoreSystemState> {
  const userId = getUserId(user);
  const displayName = getDisplayName(user);
  const r = getRedis();

  if (!r) return createDefaultCoreState(channelId, userId, displayName);

  const data = await r.get<CoreSystemState>(stateKey(channelId, userId));

  return normalizeCoreState(data, channelId, userId, displayName);
}

export async function saveCoreState(state: CoreSystemState): Promise<void> {
  const r = getRedis();

  if (!r) return;

  const now = Date.now();
  state.updatedAt = now;
  state.lastActiveAt = now;

  await r.set(stateKey(state.channelId, state.userId), state);
  await r.set(channelActivityKey(state.channelId), now);
}

export async function touchCoreState(
  channelId: string,
  user: NightbotUser | null
): Promise<CoreSystemState> {
  const state = await getCoreState(channelId, user);
  await saveCoreState(state);
  return state;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function isWallCore(state: CoreSystemState, coreTier: number): boolean {
  if (coreTier > TOTAL_CORES) return false;
  if (coreTier > TOTAL_CORES - 5) return true;
  if (coreTier <= PATH_SPLIT_CORE) return false;

  const batchStart = 16 + Math.floor((coreTier - 16) / 10) * 10;
  const wallOffset = hashString(`${state.wallSeed}:${batchStart}`) % 10;

  return coreTier === batchStart + wallOffset;
}

function shdCapacity(level: number): number {
  return SHD_CAPS[level] ?? 0;
}

export function getShdCapacity(state: CoreSystemState): number {
  return shdCapacity(state.shdLevel);
}

function addToBag(bag: Record<string, number>, id: string, amount: number): void {
  if (amount <= 0) return;
  bag[id] = Math.max(0, Math.floor((bag[id] ?? 0) + amount));
}

function removeFromBag(
  bag: Record<string, number>,
  id: string,
  amount: number
): void {
  if (amount <= 0) return;
  bag[id] = Math.max(0, Math.floor((bag[id] ?? 0) - amount));

  if (bag[id] <= 0) {
    delete bag[id];
  }
}

function consumeBagCosts(
  bag: Record<string, number>,
  costs: Record<string, number> | undefined
): void {
  for (const [id, amount] of Object.entries(costs ?? {})) {
    removeFromBag(bag, id, amount);
  }
}

function materialName(id: string): string {
  return MATERIAL_NAMES[id] ?? titleCase(id);
}

function componentName(id: string): string {
  if (id.startsWith("chassis_")) {
    const [, path, tier] = id.split("_");
    return `${titleCase(path)} Chassis ${tier}`;
  }

  return COMPONENT_RECIPES[id]?.name ?? titleCase(id);
}

function frameName(id: string): string {
  const [, path, tier] = id.split(":");
  return `${titleCase(path)} Frame ${tier}`;
}

function titleCase(id: string): string {
  return id
    .split(/[_\-:]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAmount(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}

function formatPercent(value: number): string {
  return `+${Math.floor(value).toLocaleString("en-US")}%`;
}

function formatBag(
  bag: Record<string, number>,
  nameFn: (id: string) => string,
  max = 8
): string {
  const entries = Object.entries(bag)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (entries.length === 0) return "None";

  const shown = entries
    .slice(0, max)
    .map(([id, amount]) => `${nameFn(id)} x${formatAmount(amount)}`);
  const hidden = entries.length - shown.length;

  return hidden > 0 ? `${shown.join(", ")} (+${hidden} more)` : shown.join(", ");
}

function formatCosts(costs: CraftCosts): string {
  const parts: string[] = [];

  if (costs.stardust) parts.push(`Stardust ${formatAmount(costs.stardust)}`);

  for (const [id, amount] of Object.entries(costs.materials ?? {})) {
    parts.push(`${materialName(id)} x${formatAmount(amount)}`);
  }

  for (const [id, amount] of Object.entries(costs.components ?? {})) {
    parts.push(`${componentName(id)} x${formatAmount(amount)}`);
  }

  for (const [id, amount] of Object.entries(costs.frames ?? {})) {
    parts.push(`${frameName(id)} x${formatAmount(amount)}`);
  }

  for (const req of costs.activeRolls ?? []) {
    parts.push(`${req.label} 0/${req.amount}`);
  }

  if (costs.coreTierRequired) parts.push(`Core ${costs.coreTierRequired}`);

  return parts.length > 0 ? parts.join(", ") : "Free";
}

function getProgress(job: ActiveJob | undefined, key: string): number {
  return Math.max(0, Math.floor(job?.progress[key] ?? 0));
}

function formatRollProgress(job: ActiveJob | undefined, reqs: RollRequirement[]): string {
  if (reqs.length === 0) return "";

  return reqs
    .map((req) => `${req.label} ${getProgress(job, req.key)}/${req.amount}`)
    .join(", ");
}

function getMissingCosts(
  state: CoreSystemState,
  costs: CraftCosts,
  job?: ActiveJob
): string[] {
  const missing: string[] = [];

  if (costs.coreTierRequired && state.coreTier < costs.coreTierRequired) {
    missing.push(`Core ${state.coreTier}/${costs.coreTierRequired}`);
  }

  if (costs.stardust && state.stardust < costs.stardust) {
    missing.push(`Stardust ${formatAmount(state.stardust)}/${formatAmount(costs.stardust)}`);
  }

  for (const [id, amount] of Object.entries(costs.materials ?? {})) {
    const have = state.materials[id] ?? 0;
    if (have < amount) missing.push(`${materialName(id)} ${formatAmount(have)}/${formatAmount(amount)}`);
  }

  for (const [id, amount] of Object.entries(costs.components ?? {})) {
    const have = state.components[id] ?? 0;
    if (have < amount) missing.push(`${componentName(id)} ${formatAmount(have)}/${formatAmount(amount)}`);
  }

  for (const [id, amount] of Object.entries(costs.frames ?? {})) {
    const have = state.frames[id] ?? 0;
    if (have < amount) missing.push(`${frameName(id)} ${formatAmount(have)}/${formatAmount(amount)}`);
  }

  for (const req of costs.activeRolls ?? []) {
    const have = getProgress(job, req.key);
    if (have < req.amount) missing.push(`${req.label} ${have}/${req.amount}`);
  }

  return missing;
}

function consumeCosts(state: CoreSystemState, costs: CraftCosts): void {
  if (costs.stardust) state.stardust = Math.max(0, state.stardust - costs.stardust);

  consumeBagCosts(state.materials, costs.materials);
  consumeBagCosts(state.components, costs.components);
  consumeBagCosts(state.frames, costs.frames);
}

function normalizePathForTier(state: CoreSystemState, tier: number): CorePath {
  if (tier <= PATH_SPLIT_CORE) return "universal";
  return state.corePath;
}

function chassisId(path: CorePath, tier: number): string {
  return `chassis_${path}_${tier}`;
}

function frameId(path: CorePath, tier: number): string {
  return `frame:${path}:${tier}`;
}

function getCoreStardustCost(tier: number): number {
  if (tier <= 7) return 0;

  return Math.floor(100 * Math.pow(tier - 7, 1.4) * Math.pow(1.045, tier - 8));
}

function activeReq(key: string, label: string, rarity: number, amount: number): RollRequirement {
  return {
    key,
    label,
    amount,
    type: "rarityAtLeast",
    rarity,
  };
}

function getCoreRollRequirements(
  state: CoreSystemState,
  tier: number
): RollRequirement[] {
  const reqs: RollRequirement[] = [];

  if (tier === 5) reqs.push(activeReq("rarity_10000", "Roll any 1/10k+ aura", 10000, 1));
  if (tier === 10) reqs.push(activeReq("rarity_100000", "Roll any 1/100k+ aura", 100000, 1));
  if (tier === 15) reqs.push(activeReq("rarity_250000", "Roll any 1/250k+ aura", 250000, 1));

  if (isWallCore(state, tier)) {
    const rarity = Math.min(50000000, Math.max(50000, Math.floor(tier * tier * 250)));
    reqs.push(activeReq(`wall_rarity_${tier}`, `Wall roll ${formatRarity(rarity)}+`, rarity, 1));
  }

  return reqs;
}

function getChassisRecipe(state: CoreSystemState, tier: number): ComponentRecipe {
  const path = normalizePathForTier(state, tier);
  const scale = Math.max(1, tier);
  const group = Math.floor((tier - 1) / 25);
  const costs: CraftCosts = {
    materials: {
      scrap: 40 * scale,
      metal_bits: 8 * scale,
    },
    components: {
      basic_plate: Math.max(1, Math.ceil(tier / 3)),
      basic_wire: Math.max(1, Math.ceil(tier / 4)),
    },
  };

  if (tier >= 8) {
    costs.components = {
      ...(costs.components ?? {}),
      copper_wire: Math.ceil(tier / 5),
      refined_plate: Math.ceil(tier / 8),
    };
  }

  if (tier >= 16) {
    costs.materials = {
      ...(costs.materials ?? {}),
      refined_alloy: 10 + group * 15,
    };
    costs.components = {
      ...(costs.components ?? {}),
      basic_circuit: Math.max(1, Math.ceil(tier / 12)),
    };
  }

  return {
    id: chassisId(path, tier),
    name: `${titleCase(path)} Chassis ${tier}`,
    costs,
  };
}

function getFrameRecipe(state: CoreSystemState, tier: number): ComponentRecipe {
  const path = normalizePathForTier(state, tier);
  const costs: CraftCosts = {
    components: {
      [chassisId(path, tier)]: 1,
      basic_wire: Math.max(1, Math.ceil(tier / 3)),
      basic_plate: Math.max(1, Math.ceil(tier / 4)),
    },
    materials: {
      circuit_scrap: Math.max(5, tier * 5),
    },
  };

  if (tier >= 8) {
    costs.components = {
      ...(costs.components ?? {}),
      basic_circuit: Math.max(1, Math.ceil(tier / 10)),
    };
  }

  return {
    id: frameId(path, tier),
    name: `${titleCase(path)} Frame ${tier}`,
    costs,
  };
}

function getCoreRecipe(state: CoreSystemState, tier: number): ComponentRecipe {
  const path = normalizePathForTier(state, tier);
  const costs: CraftCosts = {
    stardust: getCoreStardustCost(tier),
    frames: {
      [frameId(path, tier)]: 1,
    },
    activeRolls: getCoreRollRequirements(state, tier),
  };

  if (isWallCore(state, tier)) {
    costs.components = {
      ...(costs.components ?? {}),
      [WALL_COMPONENT_BY_PATH[path]]: 1,
    };
  }

  return {
    id: `core_${path}_${tier}`,
    name: `${titleCase(path)} Core ${tier}`,
    costs,
  };
}

function getSubCoreRecipe(state: CoreSystemState): ComponentRecipe | null {
  const nextTier = state.coreTier + 1;

  if (nextTier > TOTAL_CORES) return null;
  if (state.corePath === "universal") return null;
  if (!isWallCore(state, nextTier)) return null;

  const path = normalizePathForTier(state, nextTier);
  const coreCost = getCoreStardustCost(nextTier);
  const rarity = Math.min(25000000, Math.max(25000, Math.floor(nextTier * nextTier * 125)));

  return {
    id: `sub_${path}_${state.coreTier}`,
    name: `${titleCase(path)} Aux Core ${state.coreTier}-A`,
    costs: {
      stardust: Math.floor(coreCost * 0.55),
      materials: {
        scrap: 80 * nextTier,
        circuit_scrap: 30 * nextTier,
        signal_fragment: Math.max(10, Math.floor(nextTier / 2)),
      },
      components: {
        smd_resistor: Math.max(1, Math.ceil(nextTier / 15)),
        power_cell: Math.max(1, Math.ceil(nextTier / 30)),
      },
      activeRolls: [
        activeReq(`sub_wall_${nextTier}`, `Aux roll ${formatRarity(rarity)}+`, rarity, 1),
      ],
    },
  };
}

function getSubCoreBonusPercent(state: CoreSystemState): number {
  let bonus = 0;

  for (const id of Object.keys(state.subCores ?? {})) {
    const rawTier = id.split("_").at(-1) ?? "0";
    const tier = Number(rawTier.split("-")[0] ?? 0);
    bonus += Math.max(10, Math.min(75, Math.floor(tier * 0.35)));
  }

  return Math.min(900, bonus);
}

function getSwitchCostScale(coreTier: number): number {
  if (coreTier >= 226) return 15;
  if (coreTier >= 201) return 12;
  if (coreTier >= 151) return 10;
  if (coreTier >= 101) return 7;
  if (coreTier >= 51) return 4;
  return 2;
}

function getPathSwitchRecipe(state: CoreSystemState, targetPath: CorePath): ComponentRecipe {
  const scale = getSwitchCostScale(state.coreTier);
  const stardustBase = Math.max(1000, getCoreStardustCost(Math.max(8, state.coreTier)));

  return {
    id: `switch_${state.corePath}_to_${targetPath}_${state.coreTier}`,
    name: `${titleCase(targetPath)} Realignment`,
    costs: {
      stardust: stardustBase * scale,
      materials: {
        refined_alloy: 25 * Math.max(1, state.coreTier) * scale,
        stabilized_flux: Math.max(10, Math.floor(state.coreTier / 2)) * scale,
      },
      components: {
        realignment_matrix: 1,
        [WALL_COMPONENT_BY_PATH[targetPath]]: Math.max(1, Math.ceil(scale / 5)),
      },
    },
  };
}

function getReactorRate(level: number): number {
  if (level <= 0) return 2;
  return Math.min(20, 2 + level * 0.72);
}

function getReactorCap(level: number): number {
  if (level <= 0) return 5000;

  return Math.min(300000000, Math.floor(5000 * Math.pow(1.55, level)));
}

function getReactorUpgradeRecipe(nextLevel: number): ComponentRecipe {
  const costs: CraftCosts = {
    stardust: Math.floor(2500 * Math.pow(1.65, nextLevel)),
    materials: {
      circuit_scrap: 75 * nextLevel,
      signal_fragment: 20 * nextLevel,
      refined_alloy: 10 * nextLevel,
    },
    components: {
      basic_circuit: Math.max(1, Math.ceil(nextLevel / 2)),
      power_cell: Math.max(1, Math.ceil(nextLevel / 4)),
    },
  };

  if (nextLevel >= 10) {
    costs.components = {
      ...(costs.components ?? {}),
      smd_resistor: Math.ceil(nextLevel / 3),
      stellar_regulator: 1,
    };
    costs.materials = {
      ...(costs.materials ?? {}),
      stabilized_flux: 25 * nextLevel,
    };
  }

  if (nextLevel >= 20) {
    costs.materials = {
      ...(costs.materials ?? {}),
      quantum_residue: 8 * nextLevel,
      reality_thread: Math.ceil(nextLevel / 2),
    };
  }

  return {
    id: `reactor_upgrade_${nextLevel}`,
    name: `Stardust Reactor Lv.${nextLevel}`,
    costs,
  };
}

function getShdCraftRecipe(): ComponentRecipe {
  return {
    id: "shd_craft",
    name: "Stellar Hard-Drive",
    costs: {
      components: {
        basic_circuit: 2,
        copper_wire: 15,
        refined_plate: 5,
      },
      materials: {
        signal_fragment: 10,
      },
      activeRolls: [
        {
          key: "shd_starlight_or_50k",
          label: "Roll Starlight or any 1/50k+ aura",
          amount: 1,
          type: "specificAura",
          auraId: "starlight",
          auraName: "starlight",
          rarity: 50000,
        },
      ],
    },
  };
}

function getShdUpgradeRecipe(nextLevel: number): ComponentRecipe {
  const coreRequired = SHD_CORE_REQUIREMENTS[nextLevel] ?? TOTAL_CORES;
  const costs: CraftCosts = {
    stardust: shdCapacity(nextLevel - 1),
    coreTierRequired: coreRequired,
    materials: {
      scrap: 250 * nextLevel,
      circuit_scrap: 100 * nextLevel,
      signal_fragment: 20 * nextLevel,
    },
    components: {
      basic_circuit: Math.max(1, nextLevel * 2),
      refined_plate: Math.max(1, nextLevel * 3),
    },
  };

  if (nextLevel >= 5) {
    costs.components = {
      ...(costs.components ?? {}),
      smd_resistor: nextLevel,
      power_cell: Math.ceil(nextLevel / 2),
    };
    costs.materials = {
      ...(costs.materials ?? {}),
      stabilized_flux: 25 * nextLevel,
    };
  }

  if (nextLevel >= 8) {
    costs.materials = {
      ...(costs.materials ?? {}),
      quantum_residue: 10 * nextLevel,
      reality_thread: nextLevel,
    };
  }

  return {
    id: `shd_upgrade_${nextLevel}`,
    name: `SHD Lv.${nextLevel}`,
    costs,
  };
}

function ensureJob(state: CoreSystemState, slot: string, recipeId: string): ActiveJob {
  const current = state.activeJobs[slot];

  if (current?.id === recipeId) return current;

  const next = { id: recipeId, progress: {} };
  state.activeJobs[slot] = next;
  return next;
}

function clearJob(state: CoreSystemState, slot: string): void {
  delete state.activeJobs[slot];
}

function matchesRequirement(req: RollRequirement, roll: RollHitForCore): boolean {
  if (req.type === "rarityAtLeast") {
    return roll.effectiveRarity >= (req.rarity ?? Number.MAX_SAFE_INTEGER);
  }

  const auraId = roll.aura.id.toLowerCase();
  const auraName = roll.aura.name.toLowerCase();
  const wantedId = (req.auraId ?? "").toLowerCase();
  const wantedName = (req.auraName ?? "").toLowerCase();

  const matchedAura =
    (wantedId && auraId === wantedId) ||
    (wantedName && auraName.includes(wantedName));

  return matchedAura || roll.effectiveRarity >= (req.rarity ?? Number.MAX_SAFE_INTEGER);
}

function progressJobWithRolls(
  job: ActiveJob | undefined,
  reqs: RollRequirement[],
  rolls: RollHitForCore[]
): void {
  if (!job || reqs.length === 0) return;

  for (const roll of rolls) {
    for (const req of reqs) {
      const current = getProgress(job, req.key);
      if (current >= req.amount) continue;
      if (!matchesRequirement(req, roll)) continue;

      job.progress[req.key] = current + 1;
    }
  }
}

function addMaterialDrops(state: CoreSystemState, roll: RollHitForCore): void {
  addToBag(state.materials, "scrap", 1);
  addToBag(state.materials, "metal_bits", 1);

  if (roll.effectiveRarity >= 1000) addToBag(state.materials, "circuit_scrap", 1);
  if (roll.effectiveRarity >= 10000) addToBag(state.materials, "signal_fragment", 1);
  if (roll.effectiveRarity >= 50000) addToBag(state.materials, "refined_alloy", 1);
  if (roll.effectiveRarity >= 1000000) addToBag(state.materials, "stabilized_flux", 1);
  if (roll.effectiveRarity >= 10000000) addToBag(state.materials, "quantum_residue", 1);
  if (roll.effectiveRarity >= 100000000) addToBag(state.materials, "reality_thread", 1);
  if (roll.effectiveRarity >= 1000000000) addToBag(state.materials, "singularity_shard", 1);
}

function getStardustGain(roll: RollHitForCore): number {
  let amount = 1;

  if (roll.effectiveRarity >= 10000) amount += 10;
  if (roll.effectiveRarity >= 100000) amount += 100;
  if (roll.effectiveRarity >= 1000000) amount += 1000;
  if (roll.effectiveRarity >= 10000000) amount += 10000;
  if (roll.effectiveRarity >= 100000000) amount += 100000;

  return amount;
}

export async function recordCoreRolls(
  channelId: string,
  user: NightbotUser | null,
  rolls: RollHitForCore[]
): Promise<CoreSystemState> {
  const state = await getCoreState(channelId, user);

  if (state.coreFocus === "main") {
    const nextTier = state.coreTier + 1;
    if (nextTier <= TOTAL_CORES && !(nextTier > PATH_SPLIT_CORE && state.corePath === "universal")) {
      const nextRecipe = getCoreRecipe(state, nextTier);
      ensureJob(state, "core", nextRecipe.id);
    }
  }

  if (state.coreFocus === "sub") {
    const subRecipe = getSubCoreRecipe(state);
    if (subRecipe && !state.subCores[subRecipe.id]) {
      ensureJob(state, "sub", subRecipe.id);
    }
  }

  const coreJob = state.activeJobs.core;
  const coreRecipe =
    coreJob && state.coreFocus === "main"
      ? getCoreRecipe(state, state.coreTier + 1)
      : null;

  const subJob = state.activeJobs.sub;
  const subRecipe =
    subJob && state.coreFocus === "sub"
      ? getSubCoreRecipe(state)
      : null;

  const shdJob = state.activeJobs.shd;
  const shdRecipe = shdJob?.id === "shd_craft" ? getShdCraftRecipe() : null;

  for (const roll of rolls) {
    addMaterialDrops(state, roll);

    if (state.shdLevel >= 0) {
      const cap = getShdCapacity(state);
      const gain = getStardustGain(roll);
      state.stardust = Math.min(cap, state.stardust + gain);
    }
  }

  if (coreRecipe) {
    progressJobWithRolls(coreJob, coreRecipe.costs.activeRolls ?? [], rolls);
  }

  if (subRecipe) {
    progressJobWithRolls(subJob, subRecipe.costs.activeRolls ?? [], rolls);
  }

  if (shdRecipe) {
    progressJobWithRolls(shdJob, shdRecipe.costs.activeRolls ?? [], rolls);
  }

  await saveCoreState(state);
  return state;
}

export function getCoreLuckBonusPercent(state: CoreSystemState): number {
  if (state.coreTier <= 0) return 0;

  const target = CORE_LUCK_TARGET_PERCENT[state.corePath] ?? CORE_LUCK_TARGET_PERCENT.universal;
  const ratio = Math.min(1, state.coreTier / TOTAL_CORES);

  return Math.floor(target * Math.pow(ratio, 1.08)) + getSubCoreBonusPercent(state);
}

export async function getViewerCoreLuck(
  channelId: string,
  user: NightbotUser | null
): Promise<{ bonusPercent: number; multiplier: number; label: string }> {
  const state = await touchCoreState(channelId, user);
  const bonusPercent = getCoreLuckBonusPercent(state);

  return {
    bonusPercent,
    multiplier: 1 + bonusPercent / 100,
    label: `${formatPercent(bonusPercent)} luck`,
  };
}

export async function craftComponent(
  channelId: string,
  user: NightbotUser | null,
  componentId: string
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const recipe = COMPONENT_RECIPES[componentId];

  if (!recipe) {
    return `Unknown component. Try: basic_wire, basic_plate, copper_wire, refined_plate, basic_circuit, smd_resistor.`;
  }

  const missing = getMissingCosts(state, recipe.costs);

  if (missing.length > 0) {
    return `${recipe.name} missing: ${missing.join(" | ")}`;
  }

  consumeCosts(state, recipe.costs);
  addToBag(state.components, recipe.id, recipe.outputAmount ?? 1);
  await saveCoreState(state);

  return `✅ Crafted ${recipe.name} x${recipe.outputAmount ?? 1}.`;
}

export async function craftNextChassis(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const tier = state.coreTier + 1;

  if (tier > TOTAL_CORES) return `You already reached the max Core.`;
  if (tier > PATH_SPLIT_CORE && state.corePath === "universal") {
    return `Choose a path first with !core choose safe/risk/support/biome/precision/token/anomaly.`;
  }

  const recipe = getChassisRecipe(state, tier);
  const missing = getMissingCosts(state, recipe.costs);

  if (missing.length > 0) return `${recipe.name} missing: ${missing.join(" | ")}`;

  consumeCosts(state, recipe.costs);
  addToBag(state.components, recipe.id, 1);
  await saveCoreState(state);

  return `✅ Crafted ${recipe.name}.`;
}

export async function craftNextFrame(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const tier = state.coreTier + 1;

  if (tier > TOTAL_CORES) return `You already reached the max Core.`;
  if (tier > PATH_SPLIT_CORE && state.corePath === "universal") {
    return `Choose a path first with !core choose safe/risk/support/biome/precision/token/anomaly.`;
  }

  const recipe = getFrameRecipe(state, tier);
  const missing = getMissingCosts(state, recipe.costs);

  if (missing.length > 0) return `${recipe.name} missing: ${missing.join(" | ")}`;

  consumeCosts(state, recipe.costs);
  addToBag(state.frames, recipe.id, 1);
  await saveCoreState(state);

  return `✅ Crafted ${recipe.name}.`;
}

export async function attemptCoreUpgrade(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const tier = state.coreTier + 1;

  if (tier > TOTAL_CORES) return `${state.displayName} already reached Core ${TOTAL_CORES}.`;
  if (tier > PATH_SPLIT_CORE && state.corePath === "universal") {
    return `Core ${tier} requires a path. Craft Divergence Matrix, then use !core choose safe/risk/support/biome/precision/token/anomaly.`;
  }
  if (tier >= 8 && state.shdLevel < 0) {
    return `Core ${tier} needs Stardust. Craft SHD first with !shd craft.`;
  }

  const recipe = getCoreRecipe(state, tier);
  const job = ensureJob(state, "core", recipe.id);
  const missing = getMissingCosts(state, recipe.costs, job);

  if (missing.length > 0) return `${recipe.name} missing: ${missing.join(" | ")}`;

  consumeCosts(state, recipe.costs);
  state.coreTier = tier;
  clearJob(state, "core");

  await saveCoreState(state);

  const bonus = getCoreLuckBonusPercent(state);
  const splitText = tier === PATH_SPLIT_CORE ? ` | Divergence unlocked: craft Divergence Matrix to choose a path.` : "";

  return `✅ Upgraded to ${recipe.name}! Core luck: ${formatPercent(bonus)}.${splitText}`;
}

export async function chooseCorePath(
  channelId: string,
  user: NightbotUser | null,
  path: string
): Promise<string> {
  const wanted = path.toLowerCase().trim() as CorePath;
  const allowed: CorePath[] = ["safe", "risk", "support", "biome", "precision", "token", "anomaly"];

  if (!allowed.includes(wanted)) {
    return `Choose: safe, risk, support, biome, precision, token, or anomaly.`;
  }

  const state = await touchCoreState(channelId, user);

  if (state.coreTier < PATH_SPLIT_CORE) {
    return `Path split unlocks at Core ${PATH_SPLIT_CORE}. Current Core: ${state.coreTier}.`;
  }

  if (state.corePath !== "universal") {
    return `You already chose ${titleCase(state.corePath)}. Path switching with Realignment Matrix comes later.`;
  }

  const cost: CraftCosts = { components: { divergence_matrix: 1 } };
  const missing = getMissingCosts(state, cost);

  if (missing.length > 0) return `Path choice missing: ${missing.join(" | ")}`;

  consumeCosts(state, cost);
  state.corePath = wanted;
  clearJob(state, "core");
  await saveCoreState(state);

  return `✅ Path chosen: ${titleCase(wanted)} Core. Future cores now follow this route.`;
}

export async function setCoreFocus(
  channelId: string,
  user: NightbotUser | null,
  focus: string
): Promise<string> {
  const wanted = focus.toLowerCase().trim();

  if (wanted !== "main" && wanted !== "sub") {
    return `Use !core focus main or !core focus sub.`;
  }

  const state = await touchCoreState(channelId, user);
  state.coreFocus = wanted;
  await saveCoreState(state);

  return `Core focus changed to ${wanted === "main" ? "Main Core" : "Sub-Core"}. Only this Core-type job auto-progresses now.`;
}

export async function attemptShdCraft(
  channelId: string,
  user: NightbotUser | null,
  totalRolls: number
): Promise<string> {
  const state = await touchCoreState(channelId, user);

  if (state.shdLevel >= 0) return `You already own SHD Lv.${state.shdLevel}.`;

  const recipe = getShdCraftRecipe();
  const job = ensureJob(state, "shd", recipe.id);
  const missing = getMissingCosts(state, recipe.costs, job);

  if (totalRolls < 250) missing.unshift(`Rolls ${totalRolls}/250`);

  if (missing.length > 0) {
    await saveCoreState(state);
    return `SHD craft missing: ${missing.join(" | ")}`;
  }

  consumeCosts(state, recipe.costs);
  state.shdLevel = 0;
  state.stardust = 0;
  clearJob(state, "shd");
  await saveCoreState(state);

  return `✅ Crafted Stellar Hard-Drive! SHD Lv.0 | Capacity: 0/500 Stardust.`;
}

export async function attemptShdUpgrade(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);

  if (state.shdLevel < 0) return `You do not own a Stellar Hard-Drive yet. Use !shd craft.`;
  if (state.shdLevel >= 10) return `SHD is already max level.`;

  const nextLevel = state.shdLevel + 1;
  const recipe = getShdUpgradeRecipe(nextLevel);
  const cap = getShdCapacity(state);

  if (state.stardust < cap) {
    return `SHD upgrade blocked: fill SHD first. Stardust ${formatAmount(state.stardust)}/${formatAmount(cap)}.`;
  }

  const missing = getMissingCosts(state, recipe.costs);

  if (missing.length > 0) return `SHD Lv.${nextLevel} missing: ${missing.join(" | ")}`;

  consumeCosts(state, recipe.costs);
  state.shdLevel = nextLevel;
  state.stardust = 0;
  await saveCoreState(state);

  return `✅ SHD upgraded to Lv.${nextLevel}! Capacity: ${formatAmount(shdCapacity(nextLevel))} Stardust.`;
}


export async function attemptSubCoreCraft(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const recipe = getSubCoreRecipe(state);

  if (!recipe) return `No Sub-Core is available right now. Sub-Cores appear when your next Core is a wall.`;
  if (state.subCores[recipe.id]) return `You already crafted ${recipe.name}.`;

  const job = ensureJob(state, "sub", recipe.id);
  const missing = getMissingCosts(state, recipe.costs, job);

  if (missing.length > 0) {
    await saveCoreState(state);
    return `${recipe.name} missing: ${missing.join(" | ")}`;
  }

  consumeCosts(state, recipe.costs);
  state.subCores[recipe.id] = true;
  state.activeSubCoreId = recipe.id;
  clearJob(state, "sub");
  await saveCoreState(state);

  return `✅ Crafted ${recipe.name}! Bonus Core luck is now active.`;
}

export async function formatSubCoreStatus(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const recipe = getSubCoreRecipe(state);

  if (!recipe) {
    return `No Sub-Core available. They appear when your next Core is one of your randomized wall cores.`;
  }

  if (state.subCores[recipe.id]) {
    return `${recipe.name} already crafted. Current Sub-Core bonus total: +${getSubCoreBonusPercent(state)}% luck.`;
  }

  const job = ensureJob(state, "sub", recipe.id);
  const missing = getMissingCosts(state, recipe.costs, job);
  await saveCoreState(state);

  const progress = formatRollProgress(job, recipe.costs.activeRolls ?? []);
  const progressText = progress ? ` | Progress: ${progress}` : "";

  return truncate(`${recipe.name} | Missing: ${missing.join(" | ")}${progressText}`);
}

export async function switchCorePath(
  channelId: string,
  user: NightbotUser | null,
  path: string
): Promise<string> {
  const wanted = path.toLowerCase().trim() as CorePath;
  const allowed: CorePath[] = ["safe", "risk", "support", "biome", "precision", "token", "anomaly"];

  if (!allowed.includes(wanted)) {
    return `Switch to: safe, risk, support, biome, precision, token, or anomaly.`;
  }

  const state = await touchCoreState(channelId, user);

  if (state.corePath === "universal") return `Choose your first path with !core choose <path>.`;
  if (state.corePath === wanted) return `You are already on ${titleCase(wanted)} path.`;

  const recipe = getPathSwitchRecipe(state, wanted);
  const missing = getMissingCosts(state, recipe.costs);

  if (missing.length > 0) return `${recipe.name} missing: ${missing.join(" | ")}`;

  consumeCosts(state, recipe.costs);
  state.corePath = wanted;
  clearJob(state, "core");
  clearJob(state, "sub");
  await saveCoreState(state);

  return `✅ Realigned to ${titleCase(wanted)} Core path. Switching cost scale was ${getSwitchCostScale(state.coreTier)}x.`;
}

export async function formatReactorStatus(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);

  if (state.shdLevel < 4) {
    return `🌌 Stardust Reactor unlocks at SHD Lv.4. Current SHD: ${state.shdLevel < 0 ? "None" : `Lv.${state.shdLevel}`}.`;
  }

  const reactor = state.reactor;
  const rate = getReactorRate(reactor.level);
  const cap = getReactorCap(reactor.level);

  if (reactor.activeDeposit) {
    const left = Math.max(0, reactor.activeDeposit.unlockAt - Date.now());
    const hours = Math.floor(left / 3600000);
    const minutes = Math.floor((left % 3600000) / 60000);
    const profit = Math.floor(reactor.activeDeposit.amount * reactor.activeDeposit.bonusPercent / 100);

    return truncate(`🌌 Reactor Lv.${reactor.level} | Active: ${formatAmount(reactor.activeDeposit.amount)} → ${formatAmount(reactor.activeDeposit.amount + profit)} | Ready in ${hours}h ${minutes}m`);
  }

  return `🌌 Reactor Lv.${reactor.level} | Rate: +${rate.toFixed(1)}% / 12h | Cap: ${formatAmount(cap)} | Use !reactor deposit <amount>.`;
}

export async function reactorDeposit(
  channelId: string,
  user: NightbotUser | null,
  amountRaw: string
): Promise<string> {
  const state = await touchCoreState(channelId, user);

  if (state.shdLevel < 4) return `Reactor unlocks at SHD Lv.4.`;
  if (state.reactor.activeDeposit) return `Your Reactor already has an active deposit. Use !reactor claim when ready.`;

  const amount = Math.floor(Number(amountRaw.replace(/,/g, "")));

  if (!Number.isFinite(amount) || amount < 100) return `Deposit at least 100 Stardust.`;
  if (amount > getReactorCap(state.reactor.level)) return `Deposit exceeds Reactor cap: ${formatAmount(getReactorCap(state.reactor.level))}.`;
  if (amount > state.stardust) return `Not enough Stardust: ${formatAmount(state.stardust)}/${formatAmount(amount)}.`;

  const rate = getReactorRate(state.reactor.level);
  state.stardust -= amount;
  state.reactor.activeDeposit = {
    amount,
    bonusPercent: rate,
    startedAt: Date.now(),
    unlockAt: Date.now() + REACTOR_LOCK_MS,
  };

  await saveCoreState(state);

  return `🌌 Deposited ${formatAmount(amount)} Stardust. Claim in 12h for ${formatAmount(amount + Math.floor(amount * rate / 100))} (+${rate.toFixed(1)}%).`;
}

export async function reactorClaim(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const deposit = state.reactor.activeDeposit;

  if (!deposit) return `No active Reactor deposit.`;
  if (Date.now() < deposit.unlockAt) {
    const left = deposit.unlockAt - Date.now();
    const hours = Math.floor(left / 3600000);
    const minutes = Math.floor((left % 3600000) / 60000);
    return `⏳ Reactor still stabilizing: ${hours}h ${minutes}m left.`;
  }

  const profit = Math.floor(deposit.amount * deposit.bonusPercent / 100);
  const total = deposit.amount + profit;
  const cap = getShdCapacity(state);
  const added = Math.max(0, Math.min(total, cap - state.stardust));
  const lost = total - added;

  state.stardust += added;
  state.reactor.activeDeposit = null;
  await saveCoreState(state);

  return lost > 0
    ? `✅ Reactor claimed ${formatAmount(added)} Stardust (+${formatAmount(profit)} profit). ${formatAmount(lost)} lost because SHD is full.`
    : `✅ Reactor claimed ${formatAmount(total)} Stardust (+${formatAmount(profit)} profit).`;
}

export async function reactorUpgrade(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);

  if (state.shdLevel < 4) return `Reactor unlocks at SHD Lv.4.`;
  if (state.reactor.level >= 25) return `Stardust Reactor is already max level.`;

  const nextLevel = state.reactor.level + 1;
  const recipe = getReactorUpgradeRecipe(nextLevel);
  const missing = getMissingCosts(state, recipe.costs);

  if (missing.length > 0) return `${recipe.name} missing: ${missing.join(" | ")}`;

  consumeCosts(state, recipe.costs);
  state.reactor.level = nextLevel;
  await saveCoreState(state);

  return `✅ Reactor upgraded to Lv.${nextLevel}! Rate: +${getReactorRate(nextLevel).toFixed(1)}% / 12h | Cap: ${formatAmount(getReactorCap(nextLevel))}.`;
}

export async function formatReactorRecipe(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);

  if (state.shdLevel < 4) return `Reactor unlocks at SHD Lv.4.`;
  if (state.reactor.level >= 25) return `Reactor is max level.`;

  const recipe = getReactorUpgradeRecipe(state.reactor.level + 1);
  return truncate(`${recipe.name}: ${formatCosts(recipe.costs)}`);
}

export function normalizeCraftId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function formatCoreStatus(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const nextTier = Math.min(TOTAL_CORES, state.coreTier + 1);
  const bonus = getCoreLuckBonusPercent(state);
  const wall = isWallCore(state, nextTier) ? " | Next is a wall | Sub-Core available" : "";
  const pathText = titleCase(state.corePath);

  if (nextTier > PATH_SPLIT_CORE && state.corePath === "universal") {
    return truncate(`${state.displayName} | Core ${state.coreTier}/${TOTAL_CORES} | Path ready. Craft Divergence Matrix, then !core choose safe/risk/support/biome/precision/token/anomaly.`);
  }

  const recipe = getCoreRecipe(state, nextTier);
  const job = ensureJob(state, "core", recipe.id);
  const missing = getMissingCosts(state, recipe.costs, job);
  await saveCoreState(state);

  const missingText = missing.length > 0 ? ` | Missing: ${missing.join(" | ")}` : ` | Ready: !core upgrade`;

  return truncate(`${state.displayName} | ${pathText} Core ${state.coreTier}/${TOTAL_CORES} | Luck ${formatPercent(bonus)} | Focus: ${state.coreFocus}${wall}${missingText}`);
}

export async function formatShdStatus(
  channelId: string,
  user: NightbotUser | null,
  totalRolls: number
): Promise<string> {
  const state = await touchCoreState(channelId, user);

  if (state.shdLevel < 0) {
    const recipe = getShdCraftRecipe();
    const job = ensureJob(state, "shd", recipe.id);
    const missing = getMissingCosts(state, recipe.costs, job);
    if (totalRolls < 250) missing.unshift(`Rolls ${totalRolls}/250`);
    await saveCoreState(state);

    return truncate(`💾 No SHD. Craft missing: ${missing.join(" | ")}`);
  }

  const cap = getShdCapacity(state);
  const next = state.shdLevel < 10 ? ` | Next: Lv.${state.shdLevel + 1} requires full SHD` : " | Max level";

  return truncate(`💾 SHD Lv.${state.shdLevel} | Stardust: ${formatAmount(state.stardust)}/${formatAmount(cap)}${next}`);
}

export async function formatComponentsStatus(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);

  return truncate(
    `Materials: ${formatBag(state.materials, materialName, 5)} | Components: ${formatBag(
      state.components,
      componentName,
      5
    )} | Frames: ${formatBag(state.frames, frameName, 3)}`
  );
}

export async function formatCraftRecipe(
  channelId: string,
  user: NightbotUser | null,
  rawId: string
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const id = normalizeCraftId(rawId);

  if (id === "chassis") {
    const recipe = getChassisRecipe(state, state.coreTier + 1);
    return truncate(`${recipe.name}: ${formatCosts(recipe.costs)}`);
  }

  if (id === "frame") {
    const recipe = getFrameRecipe(state, state.coreTier + 1);
    return truncate(`${recipe.name}: ${formatCosts(recipe.costs)}`);
  }

  const recipe = COMPONENT_RECIPES[id];

  if (!recipe) return `Unknown recipe.`;

  return truncate(`${recipe.name}: ${formatCosts(recipe.costs)}`);
}

export async function formatCoreRecipe(
  channelId: string,
  user: NightbotUser | null
): Promise<string> {
  const state = await touchCoreState(channelId, user);
  const tier = state.coreTier + 1;

  if (tier > TOTAL_CORES) return `Max Core reached.`;
  if (tier > PATH_SPLIT_CORE && state.corePath === "universal") {
    return `Next Core needs a path. Craft Divergence Matrix, then !core choose <path>.`;
  }

  const recipe = getCoreRecipe(state, tier);
  const job = ensureJob(state, "core", recipe.id);
  await saveCoreState(state);

  const rollProgress = formatRollProgress(job, recipe.costs.activeRolls ?? []);
  const rollText = rollProgress ? ` | Progress: ${rollProgress}` : "";

  return truncate(`${recipe.name}: ${formatCosts(recipe.costs)}${rollText}`);
}


export async function craftByIdAmount(
  channelId: string,
  user: NightbotUser | null,
  rawId: string,
  rawAmount: number
): Promise<string> {
  const batches = Math.max(1, Math.min(10000, Math.floor(rawAmount || 1)));
  const id = normalizeCraftId(rawId);

  if (id === "chassis" || id === "frame") {
    if (batches > 1) {
      return `${titleCase(id)} can only be crafted one at a time because it follows your next Core tier.`;
    }

    return craftById(channelId, user, rawId);
  }

  const state = await touchCoreState(channelId, user);
  const recipe = COMPONENT_RECIPES[id];

  if (!recipe) {
    return `Unknown component. Try: basic_wire, basic_plate, copper_wire, refined_plate, basic_circuit, smd_resistor.`;
  }

  const scaleBag = (
    bag: Record<string, number> | undefined
  ): Record<string, number> | undefined => {
    if (!bag) return undefined;

    return Object.fromEntries(
      Object.entries(bag).map(([key, value]) => [key, value * batches])
    );
  };

  const scaledCosts: CraftCosts = {
    stardust: recipe.costs.stardust
      ? recipe.costs.stardust * batches
      : undefined,
    materials: scaleBag(recipe.costs.materials),
    components: scaleBag(recipe.costs.components),
    frames: scaleBag(recipe.costs.frames),
    coreTierRequired: recipe.costs.coreTierRequired,
    activeRolls: recipe.costs.activeRolls?.map((req) => ({
      ...req,
      amount: req.amount * batches,
    })),
  };

  const missing = getMissingCosts(state, scaledCosts);

  if (missing.length > 0) {
    return `${recipe.name} x${formatAmount(batches)} missing: ${missing.join(" | ")}`;
  }

  consumeCosts(state, scaledCosts);

  const outputAmount = (recipe.outputAmount ?? 1) * batches;
  addToBag(state.components, recipe.id, outputAmount);

  await saveCoreState(state);

  return `✅ Crafted ${recipe.name} x${formatAmount(outputAmount)}.`;
}

export async function craftById(
  channelId: string,
  user: NightbotUser | null,
  rawId: string
): Promise<string> {
  const id = normalizeCraftId(rawId);

  if (id === "chassis") return craftNextChassis(channelId, user);
  if (id === "frame") return craftNextFrame(channelId, user);

  return craftComponent(channelId, user, id);
}
