const fs = require("fs");

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.mkdirSync(require("path").dirname(path), { recursive: true });
  fs.writeFileSync(path, content);
}

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) fail(`Could not find block for ${label}`);
  return source.replace(needle, replacement);
}

const sourceDir = process.argv[2] || ".";

/* ============================================================
   CORE SYSTEM REWORK
============================================================ */
const corePath = "src/lib/core-system.ts";
let core = read(corePath);

if (!core.includes(`import { getGlobalRolls } from "./global-stats";`)) {
  core = core.replace(
    `import { formatRarity, truncate } from "./format";`,
    `import { formatRarity, truncate } from "./format";\nimport { getGlobalRolls } from "./global-stats";`
  );
}

if (!core.includes(`import { getViewerProfile } from "./profile";`)) {
  core = core.replace(
    `import { getGlobalRolls } from "./global-stats";`,
    `import { getGlobalRolls } from "./global-stats";\nimport { getViewerProfile } from "./profile";`
  );
}

const helperMarker = 'function tieredComponentName(id: string): string {\n' +
'  const match = id.match(/^(.+)_(\\d+)$/);\n' +
'  if (!match) return titleCase(id);\n' +
'  const family = match[1];\n' +
'  const tier = Math.max(1, Math.min(10, Number(match[2])));\n' +
'  return `${TIER_NAMES[tier - 1] ?? `Tier ${tier}`} ${titleCase(family)}`;\n' +
'}';

const helperBlock = helperMarker + `

const TIER_6_7_DOUBLE_CHANCE = 0.25;
const SHD_LEVEL_8_DUPLICATE_CHANCE = 0.10;
const GLOBAL_25K_DUPLICATE_CHANCE = 0.01;
const GLOBAL_25K_DUPLICATE_ROLLS_REQUIRED = 25000;

const LEVEL_MATERIAL_BONUS_STEP = 50;
const LEVEL_MATERIAL_BONUS_PER_STEP = 0.001;
const GLOBAL_QUEST_MATERIAL_BONUS_STEP = 100;
const GLOBAL_QUEST_MATERIAL_BONUS_PER_STEP = 0.001;
const GLOBAL_QUEST_COMPLETIONS_KEY = "mega:gquest-completions";

const CORE_NAME_ADJECTIVES = [
  "Dawn", "Ember", "Azure", "Verdant", "Crimson", "Silver", "Golden", "Obsidian", "Astral", "Nova",
  "Prismatic", "Echo", "Radiant", "Silent", "Storm", "Frost", "Solar", "Lunar", "Void", "Celestial",
  "Arcane", "Quantum", "Stellar", "Nebula", "Eclipse"
] as const;

const CORE_NAME_NOUNS = [
  "Spark", "Anchor", "Prism", "Engine", "Relay", "Beacon", "Circuit", "Crown", "Heart", "Lens",
  "Forge", "Spire", "Gate", "Pulse", "Matrix", "Reactor", "Nexus", "Vessel", "Signal", "Star"
] as const;

function getComponentTier(id: string): number {
  const match = id.match(/_(\\d+)$/);
  return Math.max(1, Math.min(10, Number(match?.[1] ?? 1)));
}

function getBaseComponentOutputAmount(tier: number): number {
  if (tier <= 5) return 2;
  return 1;
}

function getCorePartName(path: CorePath, tier: number, part: "Core" | "Frame" | "Chassis"): string {
  const safeTier = Math.max(1, Math.floor(tier || 1));
  const adjective = CORE_NAME_ADJECTIVES[(safeTier - 1) % CORE_NAME_ADJECTIVES.length];
  const noun = CORE_NAME_NOUNS[Math.floor((safeTier - 1) / CORE_NAME_ADJECTIVES.length) % CORE_NAME_NOUNS.length];
  const pathPrefix = path === "universal" ? "" : \`\${titleCase(path)} \`;
  return \`\${pathPrefix}\${adjective} \${noun} \${part}\`;
}

function getLevelMaterialMultiplier(level: number): number {
  const steps = Math.floor(Math.max(0, level) / LEVEL_MATERIAL_BONUS_STEP);
  return 1 + steps * LEVEL_MATERIAL_BONUS_PER_STEP;
}

function getGlobalQuestMaterialMultiplier(completed: number): number {
  const steps = Math.floor(Math.max(0, completed) / GLOBAL_QUEST_MATERIAL_BONUS_STEP);
  return 1 + steps * GLOBAL_QUEST_MATERIAL_BONUS_PER_STEP;
}

async function getGlobalQuestCompletions(): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  const value = await r.get<number>(GLOBAL_QUEST_COMPLETIONS_KEY);
  return Math.max(0, Math.floor(value ?? 0));
}

function getMaterialComponentDuplicateChance(
  state: CoreSystemState,
  globalRolls: number
): number {
  let chance = 0;
  if (state.shdLevel >= 8) chance += SHD_LEVEL_8_DUPLICATE_CHANCE;
  if (globalRolls >= GLOBAL_25K_DUPLICATE_ROLLS_REQUIRED) chance += GLOBAL_25K_DUPLICATE_CHANCE;
  return Math.min(0.95, chance);
}

function getCraftDoubleChance(
  state: CoreSystemState,
  globalRolls: number,
  tier: number
): number {
  let chance = getMaterialComponentDuplicateChance(state, globalRolls);
  if (tier === 6 || tier === 7) chance += TIER_6_7_DOUBLE_CHANCE;
  return Math.min(0.95, chance);
}

function rollBonusBatches(batches: number, chance: number): number {
  if (chance <= 0) return 0;
  let bonus = 0;
  for (let i = 0; i < batches; i++) {
    if (Math.random() < chance) bonus += 1;
  }
  return bonus;
}

function formatUsedCosts(costs: CraftCosts): string {
  const parts: string[] = [];
  if (costs.stardust) parts.push(\`\${formatAmount(costs.stardust)} Stardust\`);
  for (const [id, amount] of Object.entries(costs.materials ?? {})) parts.push(\`\${formatAmount(amount)} \${materialName(id)}\`);
  for (const [id, amount] of Object.entries(costs.components ?? {})) parts.push(\`\${formatAmount(amount)} \${componentName(id)}\`);
  for (const [id, amount] of Object.entries(costs.frames ?? {})) parts.push(\`\${formatAmount(amount)} \${frameName(id)}\`);
  for (const [id, amount] of Object.entries(costs.tokens ?? {})) parts.push(\`\${formatAmount(amount)} \${tokenName(id)}\`);
  return parts.length > 0 ? parts.join(", ") : "Free";
}`;

if (!core.includes("TIER_6_7_DOUBLE_CHANCE")) {
  core = replaceOnce(core, helperMarker, helperBlock, "core helper block");
}

core = core.replace(
  /outputAmount:\s*tier\s*<=\s*3\s*\?\s*4\s*:\s*tier\s*<=\s*6\s*\?\s*2\s*:\s*1,/g,
  `outputAmount: getBaseComponentOutputAmount(tier),`
);
core = core.replace(
  /outputAmount:\s*tier\s*<=\s*3\s*\?\s*2\s*:\s*1,/g,
  `outputAmount: getBaseComponentOutputAmount(tier),`
);

core = core.replace(
  /return `\$\{titleCase\(path\)\} Chassis \$\{tier\}`;/,
  `return getCorePartName(path as CorePath, Number(tier), "Chassis");`
);
core = core.replace(
  /return `\$\{titleCase\(path\)\} Frame \$\{tier\}`;/,
  `return getCorePartName(path as CorePath, Number(tier), "Frame");`
);
core = core.replace(/name: `\$\{titleCase\(path\)\} Chassis \$\{tier\}`,/g, `name: getCorePartName(path, tier, "Chassis"),`);
core = core.replace(/name: `\$\{titleCase\(path\)\} Frame \$\{tier\}`,/g, `name: getCorePartName(path, tier, "Frame"),`);
core = core.replace(/name: `\$\{titleCase\(path\)\} Core \$\{tier\}`,/g, `name: getCorePartName(path, tier, "Core"),`);

const oldMaterialBlock = `function materialDropMultiplier(state: CoreSystemState): number {
  return getPathModifiers(state).materialMultiplier;
}

function addMaterialDrops(state: CoreSystemState, roll: RollHitForCore): void {
  const mult = materialDropMultiplier(state);
  const add = (id: string, amount: number) => {
    const value = Math.max(1, Math.floor(amount * mult));
    addToBag(state.materials, id, value);
    state.stats.materialsCollected += value;
  };`;

const newMaterialBlock = `function materialDropMultiplier(
  state: CoreSystemState,
  profileLevel = 0,
  globalQuestCompletions = 0
): number {
  return (
    getPathModifiers(state).materialMultiplier *
    getLevelMaterialMultiplier(profileLevel) *
    getGlobalQuestMaterialMultiplier(globalQuestCompletions)
  );
}

function addMaterialDrops(
  state: CoreSystemState,
  roll: RollHitForCore,
  duplicateChance = 0,
  materialMultiplier = materialDropMultiplier(state)
): void {
  const mult = materialMultiplier;
  const add = (id: string, amount: number) => {
    let value = Math.max(1, Math.floor(amount * mult));
    if (duplicateChance > 0 && Math.random() < duplicateChance) value *= 2;
    addToBag(state.materials, id, value);
    state.stats.materialsCollected += value;
  };`;

if (core.includes(oldMaterialBlock)) {
  core = core.replace(oldMaterialBlock, newMaterialBlock);
}

const oldRecordStart = `export async function recordCoreRolls(
  channelId: string,
  user: NightbotUser | null,
  rolls: RollHitForCore[]
): Promise<CoreSystemState> {
  const state = await getCoreState(channelId, user);`;

const newRecordStart = `export async function recordCoreRolls(
  channelId: string,
  user: NightbotUser | null,
  rolls: RollHitForCore[]
): Promise<CoreSystemState> {
  const state = await getCoreState(channelId, user);
  const globalRolls = await getGlobalRolls();
  const profile = user ? await getViewerProfile(channelId, user) : null;
  const globalQuestCompletions = await getGlobalQuestCompletions();
  const materialDuplicateChance = getMaterialComponentDuplicateChance(state, globalRolls);
  const materialMultiplier = materialDropMultiplier(state, profile?.level ?? 0, globalQuestCompletions);`;

if (core.includes(oldRecordStart)) {
  core = core.replace(oldRecordStart, newRecordStart);
}

core = core.replace(/addMaterialDrops\(state, roll\);/g, `addMaterialDrops(state, roll, materialDuplicateChance, materialMultiplier);`);

const oldCraftBlock = `  let outputAmount = (recipe.outputAmount ?? 1) * batches;
  if (state.corePath === "support" && outputAmount >= 10) outputAmount += Math.floor(outputAmount * 0.1);

  addToBag(state.components, recipe.id, outputAmount);
  state.stats.totalCrafts += 1;
  state.stats.totalComponentsCrafted += outputAmount;
  progressQuest(state, "crafts", 1);
  progressQuest(state, "components", outputAmount);

  await saveCoreState(state);

  return \`✅ Crafted \${recipe.name} x\${formatAmount(outputAmount)}.\`;`;

const newCraftBlock = `  const globalRolls = await getGlobalRolls();
  const tier = getComponentTier(recipe.id);
  const baseOutputPerBatch = recipe.outputAmount ?? 1;
  const doubleChance = getCraftDoubleChance(state, globalRolls, tier);
  const bonusBatches = rollBonusBatches(batches, doubleChance);

  let outputAmount = baseOutputPerBatch * batches + baseOutputPerBatch * bonusBatches;
  if (state.corePath === "support" && outputAmount >= 10) outputAmount += Math.floor(outputAmount * 0.1);

  addToBag(state.components, recipe.id, outputAmount);
  state.stats.totalCrafts += 1;
  state.stats.totalComponentsCrafted += outputAmount;
  progressQuest(state, "crafts", 1);
  progressQuest(state, "components", outputAmount);

  await saveCoreState(state);

  const bonusText = bonusBatches > 0 ? \` + \${formatAmount(bonusBatches)} duplicate batch(es)\` : "";
  const chanceText = doubleChance > 0 ? \` | Double chance \${(doubleChance * 100).toFixed(1)}%\` : "";
  return truncate(\`✅ Crafted \${recipe.name}: \${formatAmount(batches)} batch(es) x\${formatAmount(baseOutputPerBatch)}\${bonusText} = \${formatAmount(outputAmount)} total. Used: \${formatUsedCosts(scaledCosts)}.\${chanceText}\`);`;

if (core.includes(oldCraftBlock)) {
  core = core.replace(oldCraftBlock, newCraftBlock);
} else if (!core.includes("const bonusText = bonusBatches > 0")) {
  fail("Could not find craft output block. Send me core-system.ts around craftByIdAmount.");
}

const oldRecipeBlock = `  const recipe = COMPONENT_RECIPES[id];
  if (!recipe) return \`Unknown recipe: \${id}. Try wire_1, plate_1, circuit_board_1, divergence_matrix.\`;

  return truncate(\`\${recipe.name}: \${formatCosts(recipe.costs)} | Makes x\${recipe.outputAmount ?? 1}\`);`;

const newRecipeBlock = `  const recipe = COMPONENT_RECIPES[id];
  if (!recipe) return \`Unknown recipe: \${id}. Try wire_1, plate_1, circuit_board_1, divergence_matrix.\`;

  const globalRolls = await getGlobalRolls();
  const tier = getComponentTier(recipe.id);
  const doubleChance = getCraftDoubleChance(state, globalRolls, tier);
  const chanceText = doubleChance > 0 ? \` | Double chance \${(doubleChance * 100).toFixed(1)}%\` : "";
  return truncate(\`\${recipe.name}: \${formatCosts(recipe.costs)} | Makes x\${recipe.outputAmount ?? 1}\${chanceText}\`);`;

if (core.includes(oldRecipeBlock)) {
  core = core.replace(oldRecipeBlock, newRecipeBlock);
}

core = core.replace(
  `8: "Late-game recipe token crafting unlocked",`,
  `8: "10% material/component duplication chance unlocked",`
);

write(corePath, core);
console.log("✅ Patched core crafting balance, material bonuses, and named cores.");

/* ============================================================
   MEGA FEATURE SYSTEM: track global quest completions
============================================================ */
const megaPath = "src/lib/mega-feature-system.ts";
if (fs.existsSync(megaPath)) {
  let mega = read(megaPath);
  if (!mega.includes("GLOBAL_QUEST_COMPLETIONS_KEY")) {
    mega = mega.replace(
      `const PERIODS: QuestPeriod[] = ["daily", "weekly", "monthly", "yearly"];`,
      `const PERIODS: QuestPeriod[] = ["daily", "weekly", "monthly", "yearly"];\nconst GLOBAL_QUEST_COMPLETIONS_KEY = "mega:gquest-completions";`
    );
  }

  const oldClaim = `  for (const q of fresh) {
    claimed.add(q.id);
    if (scope === "player") core.stardust += period === "daily" ? 100 : period === "weekly" ? 1000 : period === "monthly" ? 5000 : 25000;
  }
  await saveCoreState(core);
  await r.set(claimedKey, [...claimed]);`;

  const newClaim = `  for (const q of fresh) {
    claimed.add(q.id);
    if (scope === "player") core.stardust += period === "daily" ? 100 : period === "weekly" ? 1000 : period === "monthly" ? 5000 : 25000;
  }

  if (scope === "global" && (period === "daily" || period === "weekly")) {
    await r.incrby(GLOBAL_QUEST_COMPLETIONS_KEY, fresh.length);
  }

  await saveCoreState(core);
  await r.set(claimedKey, [...claimed]);`;

  if (mega.includes(oldClaim)) {
    mega = mega.replace(oldClaim, newClaim);
  } else {
    console.warn("⚠️ Could not patch global quest completion counter block. Continuing.");
  }

  write(megaPath, mega);
  console.log("✅ Patched global quest completion tracking.");
}

/* ============================================================
   CRAFTING WEBSITE
============================================================ */
const pagePath = sourceDir + "/crafting.tsx";
if (!fs.existsSync(pagePath)) fail("Missing crafting.tsx beside patch script.");
write("src/pages/crafting.tsx", read(pagePath));
console.log("✅ Created /crafting guide website.");

/* ============================================================
   DASHBOARD LINK PATCH
============================================================ */
const dashboardPath = "src/pages/dashboard.tsx";
if (fs.existsSync(dashboardPath)) {
  let dashboard = read(dashboardPath);
  if (!dashboard.includes("/crafting")) {
    dashboard = dashboard.replace(
      `<h1>Sols RNG Dashboard</h1>`,
      `<h1>Sols RNG Dashboard</h1>\n      <p><a href="/crafting">Open full crafting guide →</a></p>`
    );
    write(dashboardPath, dashboard);
    console.log("✅ Added crafting guide link to dashboard.");
  }
}

console.log("✅ Crafting rework patch complete.");
