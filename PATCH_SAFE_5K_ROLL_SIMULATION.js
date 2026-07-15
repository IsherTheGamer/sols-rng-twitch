#!/usr/bin/env node
const fs = require("fs");

const file = "src/pages/api/roll.ts";

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${file}. Run this from the sols-rng-twitch repository root.`);
}

let source = fs.readFileSync(file, "utf8");
const original = source;

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) return;

  if (!source.includes(oldText)) {
    fail(`Could not find ${label}. Your roll.ts may have changed.`);
  }

  source = source.replace(oldText, newText);
}

/* 1. Read-only helpers and types. */
replaceOnce(
`  addGlobalRolls,
  getGlobalLuck,`,
`  addGlobalRolls,
  getGlobalRolls,
  getGlobalLuck,`,
"getGlobalRolls import"
);

replaceOnce(
`import { cooldownKey, formatRemaining } from "@/lib/state";`,
`import { cooldownKey, formatRemaining, getChannelState } from "@/lib/state";`,
"getChannelState import"
);

replaceOnce(
`  consumeRollTokenBuffsForRolls,
  formatConsumedRollTokenEffects,
} from "@/lib/inventory";`,
`  consumeRollTokenBuffsForRolls,
  formatConsumedRollTokenEffects,
  type RollTokenPlan,
} from "@/lib/inventory";`,
"RollTokenPlan import"
);

replaceOnce(
`import { recordActivityRolls } from "@/lib/activity-of-knowledge-system";`,
`import { recordActivityRolls } from "@/lib/activity-of-knowledge-system";
import { processBiomeTick } from "@/lib/biome-engine";`,
"processBiomeTick import"
);

/* 2. Threshold. */
replaceOnce(
`const TRUSTED_MULTIROLL_LIMIT = 10000;
const MAX_DISPLAY_RESULTS = 5;`,
`const TRUSTED_MULTIROLL_LIMIT = 10000;
const SAFE_ROLL_THRESHOLD = 5000;
const MAX_DISPLAY_RESULTS = 5;`,
"safe-roll threshold"
);

/* 3. Create a current biome/time preview without writing channel state. */
replaceOnce(
`export default async function handler(req: NextApiRequest, res: NextApiResponse) {`,
`async function getSafeSimulationState(
  channelId: string,
  channelName: string
): Promise<ChannelState> {
  const storedState = await getChannelState(channelId, channelName);

  // processBiomeTick mutates the object it receives, so clone it first.
  // The simulated tick is intentionally never written back to Redis.
  const previewState = JSON.parse(
    JSON.stringify(storedState)
  ) as ChannelState;

  const elapsed = Date.now() - previewState.lastTickAt;
  const tick = await processBiomeTick(previewState, elapsed, null, false);

  return tick.state;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {`,
"safe simulation state helper"
);

/* 4. Activate at requested amount >= 5,000. */
replaceOnce(
`  if (amount > maxAllowed) {
    return error(res, \`Max \${limitName} multi-roll is \${maxAllowed}.\`);
  }

  const achievementBonuses = await getAchievementBonuses();`,
`  if (amount > maxAllowed) {
    return error(res, \`Max \${limitName} multi-roll is \${maxAllowed}.\`);
  }

  const safeSimulation = amount >= SAFE_ROLL_THRESHOLD;

  const achievementBonuses = await getAchievementBonuses();`,
"safeSimulation activation"
);

/* 5. Never create a cooldown in simulation mode. */
replaceOnce(
`  if (!isMod && !trustedMultiroll) {`,
`  if (!safeSimulation && !isMod && !trustedMultiroll) {`,
"safe cooldown bypass"
);

/* 6. Do not load/consume token inventory or increment global rolls. */
replaceOnce(
`  const tokenPlan = await consumeRollTokenBuffsForRolls({
    channelId,
    user,
    rolls: rollCount,
  });

  const oneTimeTokenAssisted = tokenPlan.effects.some((effect) =>
    effect.used.some((buff) => buff.consumeOnRoll)
  );

  const globalRollsAfter = await addGlobalRolls(rollCount);
  const firstGlobalRoll = Math.max(1, globalRollsAfter - rollCount + 1);

  return withTick(channelId, channelName, async (state) => {`,
`  const tokenPlan: RollTokenPlan = safeSimulation
    ? { effects: [] }
    : await consumeRollTokenBuffsForRolls({
        channelId,
        user,
        rolls: rollCount,
      });

  const oneTimeTokenAssisted = tokenPlan.effects.some((effect) =>
    effect.used.some((buff) => buff.consumeOnRoll)
  );

  const globalRollsAfter = safeSimulation
    ? await getGlobalRolls()
    : await addGlobalRolls(rollCount);

  // Safe mode advances a virtual roll index for luck calculations only.
  // Nothing is committed to the global-roll counter.
  const firstGlobalRoll = safeSimulation
    ? Math.max(1, globalRollsAfter + 1)
    : Math.max(1, globalRollsAfter - rollCount + 1);

  const runWithState = safeSimulation
    ? async (fn: (state: ChannelState) => Promise<void>) =>
        fn(await getSafeSimulationState(channelId, channelName))
    : async (fn: (state: ChannelState) => Promise<void>) =>
        withTick(channelId, channelName, fn);

  return runWithState(async (state) => {`,
"safe token/global/state pipeline"
);

/* 7. Skip every stats/progression/record write. */
replaceOnce(
`    await recordViewerRolls(
      channelId,
      user,
      results,
      oneTimeTokenAssisted ? "token" : "roll"
    );

    await recordCoreRolls(channelId, user, results);
    await recordSocialRolls(channelId, user, results, oneTimeTokenAssisted ? "token" : "roll");
    await recordMegaRolls({
      channelId,
      channelName: channelLoginName,
      user,
      results,
      source: oneTimeTokenAssisted ? "token" : "roll",
    });

    await recordActivityRolls({
      channelId,
      channelName: channelLoginName,
      user,
      results,
    });

    const unlocked = await recordAuraRolls(results);
    const unlockText = formatAchievementUnlocks(unlocked);
    const tokenUsage = formatConsumedRollTokenEffects(tokenPlan.effects);
    const tokenText = tokenUsage ? \` | Tokens used: \${tokenUsage}\` : "";
    const serverBoostText = serverLuck.percent > 0 ? \` | Server Boost +\${Math.floor(serverLuck.percent)}%\` : "";
    const megaBoostText = megaLuck.percent > 0 ? \` | Event +\${Math.floor(megaLuck.percent)}%\` : "";
    const suffix = \`\${unlockText ? \` | \${unlockText}\` : ""}\${tokenText}\${serverBoostText}\${megaBoostText}\`;`,
`    let unlockText = "";

    if (!safeSimulation) {
      await recordViewerRolls(
        channelId,
        user,
        results,
        oneTimeTokenAssisted ? "token" : "roll"
      );

      await recordCoreRolls(channelId, user, results);
      await recordSocialRolls(
        channelId,
        user,
        results,
        oneTimeTokenAssisted ? "token" : "roll"
      );

      await recordMegaRolls({
        channelId,
        channelName: channelLoginName,
        user,
        results,
        source: oneTimeTokenAssisted ? "token" : "roll",
      });

      await recordActivityRolls({
        channelId,
        channelName: channelLoginName,
        user,
        results,
      });

      const unlocked = await recordAuraRolls(results);
      unlockText = formatAchievementUnlocks(unlocked);
    }

    const tokenUsage = formatConsumedRollTokenEffects(tokenPlan.effects);
    const tokenText = tokenUsage ? \` | Tokens used: \${tokenUsage}\` : "";
    const serverBoostText =
      serverLuck.percent > 0
        ? \` | Server Boost +\${Math.floor(serverLuck.percent)}%\`
        : "";
    const megaBoostText =
      megaLuck.percent > 0
        ? \` | Event +\${Math.floor(megaLuck.percent)}%\`
        : "";
    const safeText = safeSimulation
      ? " | 🛡 SAFE SIM: no stats/items/quests/records/alerts changed; tokens ignored"
      : "";
    const suffix = \`\${safeText}\${
      unlockText ? \` | \${unlockText}\` : ""
    }\${tokenText}\${serverBoostText}\${megaBoostText}\`;`,
"safe mutation guard"
);

/* 8. Never announce simulated auras. */
replaceOnce(
`      await runAfterCommandReply(() =>
        announceAuraResults({
          channelId,
          channelName: channelLoginName,
          displayName: name,
          results,
          source: "roll",
        })
      );`,
`      if (!safeSimulation) {
        await runAfterCommandReply(() =>
          announceAuraResults({
            channelId,
            channelName: channelLoginName,
            displayName: name,
            results,
            source: "roll",
          })
        );
      }`,
"single-roll announcement guard"
);

replaceOnce(
`    await runAfterCommandReply(() =>
      announceAuraResults({
        channelId,
        channelName: channelLoginName,
        displayName: name,
        results,
        source: "roll",
      })
    );`,
`    if (!safeSimulation) {
      await runAfterCommandReply(() =>
        announceAuraResults({
          channelId,
          channelName: channelLoginName,
          displayName: name,
          results,
          source: "roll",
        })
      );
    }`,
"multi-roll announcement guard"
);

if (source === original) {
  console.log("✅ roll.ts already contains the 5k safe simulation mode.");
  process.exit(0);
}

const backup = `${file}.bak.${Date.now()}`;
fs.writeFileSync(backup, original);
fs.writeFileSync(file, source);

console.log(`🧯 Backup: ${backup}`);
console.log("✅ Added automatic safe simulation for !roll 5000 through !roll 10000.");
console.log("✅ Simulation skips all stats, inventory, progression, cooldown, record, and alert writes.");
console.log("✅ Passive luck/biome still apply; active roll tokens are ignored and not consumed.");
