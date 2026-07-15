#!/usr/bin/env node
const fs = require("fs");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function requireFile(file) {
  if (!fs.existsSync(file)) {
    fail(`Missing ${file}. Run this from the sols-rng-twitch repo root.`);
  }
}

function backup(file) {
  const target = `${file}.bak.${Date.now()}`;
  fs.copyFileSync(file, target);
  console.log(`🧯 Backup: ${target}`);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    fail(`Could not find ${label}. Your file may have changed.`);
  }
  return source.replace(pattern, replacement);
}

function patchCoreSystem() {
  const file = "src/lib/core-system.ts";
  requireFile(file);

  let s = fs.readFileSync(file, "utf8");
  const original = s;

  if (!s.includes("function scaleRewardBag(")) {
    s = replaceRegex(
      s,
      /function grantReward\(state:\s*CoreSystemState,\s*reward:\s*RewardBag,\s*multiplier\s*=\s*1\):\s*void\s*\{[\s\S]*?\n\}\s*\n\s*function materialDropMultiplier/,
      `function scaleRewardBag(
  reward: RewardBag,
  multiplier = 1
): RewardBag {
  const scale = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.max(1, Math.floor(value * multiplier));
  };

  const scaleMap = (
    bag: Record<string, number> | undefined
  ): Record<string, number> | undefined => {
    if (!bag) return undefined;

    const out: Record<string, number> = {};
    for (const [id, amount] of Object.entries(bag)) {
      const scaled = scale(amount);
      if (scaled > 0) out[id] = scaled;
    }

    return Object.keys(out).length > 0 ? out : undefined;
  };

  const stardust = reward.stardust ? scale(reward.stardust) : 0;

  return {
    materials: scaleMap(reward.materials),
    components: scaleMap(reward.components),
    tokens: scaleMap(reward.tokens),
    lootboxes: scaleMap(reward.lootboxes),
    stardust: stardust > 0 ? stardust : undefined,
  };
}

function mergeRewardBags(...rewards: RewardBag[]): RewardBag {
  const out: RewardBag = {
    materials: {},
    components: {},
    tokens: {},
    lootboxes: {},
    stardust: 0,
  };

  const mergeMap = (
    target: Record<string, number>,
    source: Record<string, number> | undefined
  ) => {
    for (const [id, amount] of Object.entries(source ?? {})) {
      if (amount <= 0) continue;
      target[id] = (target[id] ?? 0) + amount;
    }
  };

  for (const reward of rewards) {
    mergeMap(out.materials ?? {}, reward.materials);
    mergeMap(out.components ?? {}, reward.components);
    mergeMap(out.tokens ?? {}, reward.tokens);
    mergeMap(out.lootboxes ?? {}, reward.lootboxes);
    out.stardust = (out.stardust ?? 0) + Math.max(0, reward.stardust ?? 0);
  }

  return out;
}

function formatRewardBag(reward: RewardBag): string {
  const parts: string[] = [];

  if ((reward.stardust ?? 0) > 0) {
    parts.push(\`\${formatAmount(reward.stardust ?? 0)} Stardust\`);
  }

  for (const [id, amount] of Object.entries(reward.materials ?? {})) {
    if (amount > 0) parts.push(\`\${materialName(id)} x\${formatAmount(amount)}\`);
  }

  for (const [id, amount] of Object.entries(reward.components ?? {})) {
    if (amount > 0) parts.push(\`\${componentName(id)} x\${formatAmount(amount)}\`);
  }

  for (const [id, amount] of Object.entries(reward.tokens ?? {})) {
    if (amount > 0) parts.push(\`\${tokenName(id)} x\${formatAmount(amount)}\`);
  }

  for (const [id, amount] of Object.entries(reward.lootboxes ?? {})) {
    if (amount > 0) parts.push(\`\${lootboxName(id)} x\${formatAmount(amount)}\`);
  }

  return parts.length > 0 ? parts.join(", ") : "Nothing";
}

function grantReward(
  state: CoreSystemState,
  reward: RewardBag,
  multiplier = 1
): RewardBag {
  const scaled = scaleRewardBag(reward, multiplier);
  const granted: RewardBag = {};

  for (const [id, amount] of Object.entries(scaled.materials ?? {})) {
    addToBag(state.materials, id, amount);
    granted.materials = granted.materials ?? {};
    granted.materials[id] = amount;
  }

  for (const [id, amount] of Object.entries(scaled.components ?? {})) {
    addToBag(state.components, id, amount);
    granted.components = granted.components ?? {};
    granted.components[id] = amount;
  }

  for (const [id, amount] of Object.entries(scaled.tokens ?? {})) {
    addToBag(state.tokens, id, amount);
    granted.tokens = granted.tokens ?? {};
    granted.tokens[id] = amount;
  }

  for (const [id, amount] of Object.entries(scaled.lootboxes ?? {})) {
    addToBag(state.lootboxes, id, amount);
    granted.lootboxes = granted.lootboxes ?? {};
    granted.lootboxes[id] = amount;
  }

  if ((scaled.stardust ?? 0) > 0 && state.shdLevel >= 0) {
    const cap = getShdCapacity(state);
    const room = Math.max(0, cap - state.stardust);
    const added = Math.min(room, scaled.stardust ?? 0);

    if (added > 0) {
      state.stardust += added;
      state.stats.stardustCollected += added;
      granted.stardust = added;
    }
  }

  return granted;
}

function materialDropMultiplier`,
      "grantReward()"
    );
  }

  if (!s.includes("const rewardMultiplier = getPathModifiers(state).questRewardMultiplier;")) {
    s = replaceRegex(
      s,
      /(if\s*\(quests\.length\s*===\s*0\)\s*return\s*`No \$\{kind\} quests found\.`;\s*)(const items\s*=\s*quests\.map\(\(quest(?:\s*:\s*[^)]+)?\)\s*=>\s*\{)/,
      `$1const rewardMultiplier = getPathModifiers(state).questRewardMultiplier;\n  $2`,
      "Core quest reward multiplier"
    );
  }

  if (!s.includes("Reward: ${formatRewardBag(scaleRewardBag(quest.reward, rewardMultiplier))}")) {
    s = replaceRegex(
      s,
      /return\s*`\$\{quest\.title\}:\s*\$\{quest\.description\}\s*\(\$\{status\}\)`;/,
      `return \`\${quest.title}: \${quest.description} (\${status}) | Reward: \${formatRewardBag(scaleRewardBag(quest.reward, rewardMultiplier))}\`;`,
      "Core quest reward preview"
    );
  }

  if (!s.includes("const claimedReward = grantReward(")) {
    s = replaceRegex(
      s,
      /grantReward\(state,\s*ready\.reward,\s*getPathModifiers\(state\)\.questRewardMultiplier\);\s*progressQuest\(state,\s*"materials",\s*1\);\s*await saveCoreState\(state\);\s*return\s*`✅ Claimed \$\{ready\.title\}! Rewards added\.`;/,
      `const claimedReward = grantReward(
    state,
    ready.reward,
    getPathModifiers(state).questRewardMultiplier
  );
  progressQuest(state, "materials", 1);

  await saveCoreState(state);
  return truncate(
    \`✅ Claimed \${ready.title}! Reward: \${formatRewardBag(claimedReward)}\`
  );`,
      "Core quest claim response"
    );
  }

  if (!s.includes("achievement.description} | Reward: ${formatRewardBag(achievement.reward)}")) {
    s = replaceRegex(
      s,
      /return\s*`\$\{status\}\s+\$\{achievement\.title\}:\s*\$\{achievement\.description\}`;/,
      `return \`\${status} \${achievement.title}: \${achievement.description} | Reward: \${formatRewardBag(achievement.reward)}\`;`,
      "Achievement reward preview"
    );
  }

  if (!s.includes("const claimedRewards: RewardBag[] = [];")) {
    s = replaceRegex(
      s,
      /for\s*\(const achievement of ready\)\s*\{\s*state\.achievementsClaimed\[achievement\.id\]\s*=\s*true;\s*grantReward\(state,\s*achievement\.reward\);\s*\}\s*await saveCoreState\(state\);\s*return\s*`✅ Claimed \$\{ready\.length\} achievement reward\(s\): \$\{ready\.map\(\(a\) => a\.title\)\.slice\(0,\s*3\)\.join\(", "\)\}\$\{ready\.length > 3 \? "\.\.\." : ""\}`;/,
      `const claimedRewards: RewardBag[] = [];

  for (const achievement of ready) {
    state.achievementsClaimed[achievement.id] = true;
    claimedRewards.push(grantReward(state, achievement.reward));
  }

  const combinedReward = mergeRewardBags(...claimedRewards);

  await saveCoreState(state);
  return truncate(
    \`✅ Claimed \${ready.length} achievement reward(s) | Rewards: \${formatRewardBag(combinedReward)}\`
  );`,
      "Achievement claim response"
    );
  }

  if (!s.includes("function openOneBox(\n  state: CoreSystemState")) {
    s = replaceRegex(
      s,
      /function openOneBox\(state:\s*CoreSystemState,\s*boxId:\s*string\):\s*string\s*\{[\s\S]*?\n\}\s*\n\s*export async function formatBoxesStatus/,
      `function openOneBox(
  state: CoreSystemState,
  boxId: string
): RewardBag {
  const seed = \`\${state.userId}:\${boxId}:\${Date.now()}:\${state.stats.boxesOpened}\`;
  const roll = hashString(seed) % 100;

  state.stats.boxesOpened += 1;
  progressQuest(state, "boxes", 1);

  if (boxId === "starter_box") {
    return grantReward(state, {
      materials: { scrap: 500, circuit_scrap: 80, signal_fragment: 15 },
      tokens: { quest_token: 1 },
    });
  }

  if (boxId === "core_box") {
    return grantReward(state, {
      materials: { refined_alloy: 100, stabilized_flux: 20 },
      tokens: {
        recipe_token: roll > 70 ? 2 : 1,
        wall_token: roll > 85 ? 1 : 0,
      },
    });
  }

  if (boxId === "quest_box") {
    return grantReward(state, {
      materials: { signal_fragment: 120, refined_alloy: 30 },
      tokens: { quest_token: 2, crafting_token: 1 },
    });
  }

  if (boxId === "reactor_box") {
    return grantReward(state, {
      materials: { quantum_residue: 20, reality_thread: 5 },
      tokens: {
        reactor_token: 1,
        recipe_token: roll > 75 ? 1 : 0,
      },
    });
  }

  if (boxId === "anomaly_box") {
    return grantReward(state, {
      materials: {
        anomaly_matter: 40,
        dimensional_seal: 20,
        forbidden_circuit: roll > 85 ? 2 : 1,
      },
      tokens: { anomaly_token: 1, recipe_token: 3 },
    });
  }

  if (boxId === "dev_box") {
    return grantReward(state, {
      materials: { debug_fragment: 10, anomaly_matter: 100 },
      tokens: { recipe_token: 10, wall_token: 5, path_token: 3 },
      lootboxes: { anomaly_box: 1 },
    });
  }

  return grantReward(state, { materials: { scrap: 100 } });
}

export async function formatBoxesStatus`,
      "openOneBox()"
    );
  }

  if (!s.includes("const rewards: RewardBag[] = [];")) {
    s = replaceRegex(
      s,
      /const summaries:\s*string\[\]\s*=\s*\[\];\s*for\s*\(let i\s*=\s*0;\s*i\s*<\s*amount;\s*i\+\+\)\s*summaries\.push\(openOneBox\(state,\s*boxId\)\);\s*await saveCoreState\(state\);\s*return truncate\(`✅ Opened \$\{lootboxName\(boxId\)\} x\$\{amount\}: \$\{summaries\.slice\(0,\s*3\)\.join\(", "\)\}\$\{amount > 3 \? "\.\.\." : ""\}`\);/,
      `const rewards: RewardBag[] = [];
  for (let i = 0; i < amount; i++) {
    rewards.push(openOneBox(state, boxId));
  }

  const combinedReward = mergeRewardBags(...rewards);

  await saveCoreState(state);
  return truncate(
    \`✅ Opened \${lootboxName(boxId)} x\${amount} | Rewards: \${formatRewardBag(combinedReward)}\`
  );`,
      "Lootbox reward response"
    );
  }

  if (s !== original) {
    backup(file);
    fs.writeFileSync(file, s);
    console.log("✅ Core quests, achievements, and boxes now show exact rewards.");
  } else {
    console.log("✅ core-system.ts already has the claim reward fix.");
  }
}

function patchMegaFeatureSystem() {
  const file = "src/lib/mega-feature-system.ts";
  requireFile(file);

  let s = fs.readFileSync(file, "utf8");
  const original = s;

  if (!s.includes('import { addServerBoost, getServerLuckMultiplier } from "./social-system";')) {
    s = replaceRegex(
      s,
      /import\s*\{\s*getServerLuckMultiplier\s*\}\s*from\s*"\.\/social-system";/,
      'import { addServerBoost, getServerLuckMultiplier } from "./social-system";',
      "addServerBoost import"
    );
  }

  if (!s.includes("q.target} → ${q.reward}")) {
    s = replaceRegex(
      s,
      /const shown\w*\s*=\s*list\.map\(\(q\)\s*=>\s*`\$\{q\.name\}\s+\$\{Math\.min\(metricValue\(stats,\s*q\.metric,\s*userId\),\s*q\.target\)\}\/\$\{q\.target\}`\)\.join\("\s*\|\s*"\);/,
      'const shown = list.map((q) => `${q.name} ${Math.min(metricValue(stats, q.metric, userId), q.target)}/${q.target} → ${q.reward}`).join(" | ");',
      "Player quest reward preview"
    );

    s = replaceRegex(
      s,
      /const shown\w*\s*=\s*list\.map\(\(q\)\s*=>\s*`\$\{q\.name\}\s+\$\{Math\.min\(metricValue\(stats,\s*q\.metric\),\s*q\.target\)\}\/\$\{q\.target\}`\)\.join\("\s*\|\s*"\);/,
      'const shown = list.map((q) => `${q.name} ${Math.min(metricValue(stats, q.metric), q.target)}/${q.target} → ${q.reward}`).join(" | ");',
      "Global quest reward preview"
    );
  }

  if (!s.includes("function grantPlayerMegaQuestReward(")) {
    s = replaceRegex(
      s,
      /async function claimQuest\(channelId:\s*string,\s*user:\s*NightbotUser\s*\|\s*null,\s*scope:\s*"player"\s*\|\s*"global",\s*period:\s*QuestPeriod,\s*key:\s*string,\s*stats:\s*PeriodStats,\s*list:\s*Array<\{\s*id:\s*string;\s*name:\s*string;\s*metric:\s*QuestMetric;\s*target:\s*number;\s*reward:\s*string\s*\}>\):\s*Promise<string>\s*\{[\s\S]*?\n\}\s*\n\s*export async function formatReplay/,
      `type MegaQuestClaimDef = {
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
    return \`\${fmt(amount)} Stardust\`;
  }

  if (quest.metric === "rare") {
    const amount = Math.max(1, Math.floor(mult / 3));
    addCoreReward(core.lootboxes, "quest_box", amount);
    return \`Quest Box x\${amount}\`;
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
  const activationKey = \`mega:global-reward:\${period}:\${key}:\${quest.id}\`;
  const activated = await r.set(activationKey, "1", {
    nx: true,
    ex: 60 * 60 * 24 * 370,
  });

  if (!activated) {
    return \`\${quest.reward} (already activated; contribution recorded)\`;
  }

  if (quest.metric === "rolls") {
    await addServerBoost({
      channelId,
      name: \`\${titleCase(period)} Global Quest\`,
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
    name: \`\${titleCase(period)} Global Miracle\`,
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
    return \`Already claimed completed \${scope} \${period} quests.\`;
  }

  const core = await getCoreState(channelId, user);
  const rewardLines: string[] = [];

  for (const quest of fresh) {
    claimed.add(quest.id);

    if (scope === "player") {
      rewardLines.push(
        \`\${quest.name}: \${grantPlayerMegaQuestReward(core, quest, period)}\`
      );
    } else {
      await r.incrby(GLOBAL_QUEST_COMPLETIONS_KEY, 1);
      rewardLines.push(
        \`\${quest.name}: \${await activateGlobalMegaQuestReward(
          r,
          channelId,
          period,
          key,
          quest
        )}\`
      );
    }
  }

  await saveCoreState(core);
  await r.set(claimedKey, [...claimed]);

  return truncate(
    \`✅ Claimed \${fresh.length} \${scope} \${period} quest reward(s) | \${rewardLines.join(
      " | "
    )}\`
  );
}

export async function formatReplay`,
      "mega quest claim function"
    );
  }

  if (s !== original) {
    backup(file);
    fs.writeFileSync(file, s);
    console.log("✅ Player/global quests now preview and show exact rewards.");
  } else {
    console.log("✅ mega-feature-system.ts already has the claim reward fix.");
  }
}

function patchUpdateNotes() {
  const note =
    '  "Claim reward visibility: quest claims, achievement claims, global quest activations, and box openings now show the exact items or currency granted.",';

  for (const file of ["src/lib/update-notes.ts", "src/lib/social-system.ts"]) {
    if (!fs.existsSync(file)) continue;

    let s = fs.readFileSync(file, "utf8");
    if (s.includes("Claim reward visibility:")) continue;
    if (!s.includes("const UPDATE_NOTES = [")) continue;

    backup(file);
    s = s.replace("const UPDATE_NOTES = [", `const UPDATE_NOTES = [\n${note}`);
    fs.writeFileSync(file, s);
    console.log(`✅ Added update note to ${file}.`);
  }
}

patchCoreSystem();
patchMegaFeatureSystem();
patchUpdateNotes();

console.log("");
console.log("✅ Claim reward visibility fix installed.");
console.log("Next: npm run build");
