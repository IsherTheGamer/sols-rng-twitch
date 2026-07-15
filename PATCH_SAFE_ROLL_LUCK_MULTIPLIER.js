#!/usr/bin/env node
const fs = require("fs");
const file = "src/pages/api/roll.ts";

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${file}. Run this from the repository root.`);
}

let source = fs.readFileSync(file, "utf8");
const original = source;

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) return;
  if (!source.includes(oldText)) fail(`Could not find ${label}.`);
  source = source.replace(oldText, newText);
}

replaceOnce(
`const SAFE_ROLL_THRESHOLD = 5000;
const MAX_DISPLAY_RESULTS = 5;`,
`const SAFE_ROLL_THRESHOLD = 5000;
const MAX_SAFE_LUCK_MULTIPLIER = 100;
const MAX_DISPLAY_RESULTS = 5;`,
"safe multiplier constant"
);

replaceOnce(
`function getUserLevel(userLevel: string | undefined | null): string {`,
`function parseSafeLuckMultiplier(rawArgs: string | undefined): number {
  const parts = (rawArgs ?? "")
    .trim()
    .toLowerCase()
    .split(/\\s+/)
    .filter(Boolean);

  if (parts.length < 2) return 1;

  const raw = parts[1]
    .replace(/,/g, "")
    .replace(/x$/i, "");

  if (!/^\\d+(?:\\.\\d+)?$/.test(raw)) return NaN;

  const multiplier = Number(raw);
  if (!Number.isFinite(multiplier) || multiplier < 1) return NaN;

  return multiplier;
}

function formatSafeLuckMultiplier(multiplier: number): string {
  if (Number.isInteger(multiplier)) {
    return multiplier.toLocaleString("en-US");
  }

  return multiplier
    .toFixed(2)
    .replace(/0+$/, "")
    .replace(/\\.$/, "");
}

function getUserLevel(userLevel: string | undefined | null): string {`,
"safe multiplier parser"
);

replaceOnce(
`  const amount = parseAmount(req.query.args as string | undefined);
  const broadcaster = isBroadcasterUser(user, channel);`,
`  const rawArgs = req.query.args as string | undefined;
  const amount = parseAmount(rawArgs);
  const requestedSafeLuckMultiplier = parseSafeLuckMultiplier(rawArgs);
  const broadcaster = isBroadcasterUser(user, channel);`,
"handler parsing"
);

replaceOnce(
`  const safeSimulation = amount >= SAFE_ROLL_THRESHOLD;

  const achievementBonuses = await getAchievementBonuses();`,
`  const safeSimulation = amount >= SAFE_ROLL_THRESHOLD;

  if (!Number.isFinite(requestedSafeLuckMultiplier)) {
    return error(
      res,
      "Safe luck must be a number from 1 to 100. Example: !roll 5000 2"
    );
  }

  if (!safeSimulation && requestedSafeLuckMultiplier !== 1) {
    return error(
      res,
      "Extra luck is only available for 5,000+ safe simulations."
    );
  }

  if (requestedSafeLuckMultiplier > MAX_SAFE_LUCK_MULTIPLIER) {
    return error(
      res,
      \`Maximum safe-simulation luck is x\${MAX_SAFE_LUCK_MULTIPLIER}.\`
    );
  }

  const safeLuckMultiplier = safeSimulation
    ? requestedSafeLuckMultiplier
    : 1;

  const achievementBonuses = await getAchievementBonuses();`,
"safe multiplier validation"
);

replaceOnce(
`      const luck = calculateRollLuck({
        baseLuck,
        tokenFlatLuck: tokenEffect.flatLuck,
        tokenPercentLuck: tokenEffect.percentLuck,
        tokenRareBiomePercentLuck: tokenEffect.rareBiomePercentLuck,
        tokenFinalLuckMultiplier: tokenEffect.finalLuckMultiplier,
        achievementFlatLuck: achievementBonuses.flatLuck,
        achievementFinalLuckMultiplier: achievementBonuses.finalLuckMultiplier * serverLuck.multiplier * megaLuck.multiplier,
        rareBiomeActive,
      });

      const result = rollOnce({`,
`      const calculatedLuck = calculateRollLuck({
        baseLuck,
        tokenFlatLuck: tokenEffect.flatLuck,
        tokenPercentLuck: tokenEffect.percentLuck,
        tokenRareBiomePercentLuck: tokenEffect.rareBiomePercentLuck,
        tokenFinalLuckMultiplier: tokenEffect.finalLuckMultiplier,
        achievementFlatLuck: achievementBonuses.flatLuck,
        achievementFinalLuckMultiplier:
          achievementBonuses.finalLuckMultiplier *
          serverLuck.multiplier *
          megaLuck.multiplier,
        rareBiomeActive,
      });

      const luck = calculatedLuck * safeLuckMultiplier;

      const result = rollOnce({`,
"luck calculation"
);

replaceOnce(
`    const safeText = safeSimulation
      ? " | 🛡 SAFE SIM: no stats/items/quests/records/alerts changed; tokens ignored"
      : "";`,
`    const safeText = safeSimulation
      ? \` | 🛡 SAFE SIM x\${formatSafeLuckMultiplier(
          safeLuckMultiplier
        )} luck: no stats/items/quests/records/alerts changed; tokens ignored\`
      : "";`,
"safe response text"
);

if (source === original) {
  console.log("✅ Safe roll luck multiplier is already installed.");
  process.exit(0);
}

const backup = `${file}.bak.${Date.now()}`;
fs.writeFileSync(backup, original);
fs.writeFileSync(file, source);

console.log(`🧯 Backup: ${backup}`);
console.log("✅ Added x1–x100 luck multiplier to 5k+ safe rolls.");
console.log("✅ Examples: !roll 5000 2 | !roll 5k 10x | !roll 10000 1.5");
