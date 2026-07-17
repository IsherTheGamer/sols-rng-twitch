#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const POST_RESPONSE_FILE = "import { waitUntil } from \"@vercel/functions\";\n\nconst serialQueues = new Map<string, Promise<void>>();\n\nfunction registerTask(task: Promise<void>): void {\n  try {\n    waitUntil(task);\n  } catch {\n    // Local development or a non-Vercel runtime may not expose a request\n    // lifecycle. The promise has already started, with errors handled below.\n    void task;\n  }\n}\n\nfunction safeTask(\n  label: string,\n  work: () => Promise<void>\n): Promise<void> {\n  return Promise.resolve()\n    .then(work)\n    .catch((error) => {\n      console.error(`[post-response:${label}]`, error);\n    });\n}\n\nexport function runPostResponse(\n  label: string,\n  work: () => Promise<void>\n): void {\n  registerTask(safeTask(label, work));\n}\n\nexport function runPostResponseSerial(\n  queueKey: string,\n  label: string,\n  work: () => Promise<void>\n): void {\n  const previous = serialQueues.get(queueKey) ?? Promise.resolve();\n\n  const task = previous\n    .catch(() => undefined)\n    .then(() => safeTask(label, work));\n\n  let tracked: Promise<void>;\n\n  tracked = task.finally(() => {\n    if (serialQueues.get(queueKey) === tracked) {\n      serialQueues.delete(queueKey);\n    }\n  });\n\n  serialQueues.set(queueKey, tracked);\n  registerTask(tracked);\n}\n";
const DELAYED_FILE = "import { runPostResponse } from \"./post-response\";\n\nfunction delay(ms: number): Promise<void> {\n  return new Promise((resolve) => setTimeout(resolve, ms));\n}\n\nexport async function runAfterCommandReply(\n  fn: () => Promise<void>,\n  delayMs = 12000\n): Promise<void> {\n  runPostResponse(\"delayed-announcement\", async () => {\n    await delay(delayMs);\n    await fn();\n  });\n}\n";

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

function backup(file, original) {
  const target = `${file}.bak.${Date.now()}`;
  fs.writeFileSync(target, original);
  console.log(`🧯 Backup: ${target}`);
}

function writeReplacement(file, content) {
  const full = path.join(process.cwd(), file);
  fs.mkdirSync(path.dirname(full), { recursive: true });

  if (fs.existsSync(full)) {
    const old = fs.readFileSync(full, "utf8");

    if (normalize(old) === normalize(content)) {
      console.log(`✅ Already current: ${file}`);
      return;
    }

    backup(full, old);
  }

  fs.writeFileSync(full, content);
  console.log(`✅ Wrote ${file}`);
}

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;

  if (!source.includes(oldText)) {
    fail(
      `Could not patch ${label}. Your file differs from the expected current version.`
    );
  }

  return source.replace(oldText, newText);
}

writeReplacement("src/lib/post-response.ts", POST_RESPONSE_FILE);
writeReplacement("src/lib/delayed-announcement.ts", DELAYED_FILE);

const rollFile = "src/pages/api/roll.ts";

if (!fs.existsSync(rollFile)) {
  fail(`Missing ${rollFile}`);
}

const rollOriginal = fs.readFileSync(rollFile, "utf8");
let roll = normalize(rollOriginal);

roll = replaceOnce(
  roll,
  'import { runAfterCommandReply } from "@/lib/delayed-announcement";',
  'import { runAfterCommandReply } from "@/lib/delayed-announcement";\nimport { runPostResponseSerial } from "@/lib/post-response";',
  "post-response import"
);

roll = replaceOnce(
  roll,
  "const MAX_DISPLAY_RESULTS = 5;",
  "const MAX_DISPLAY_RESULTS = 5;\nconst ROLL_REPLY_PERSISTENCE_BUDGET_MS = 2200;",
  "roll reply persistence budget"
);

roll = replaceOnce(
  roll,
  "  maxDuration: 30,",
  "  maxDuration: 60,",
  "roll function duration"
);

if (!roll.includes("async function waitForPersistence")) {
  roll = replaceOnce(
    roll,
    "function getUserLevel(userLevel: string | undefined | null): string {",
    `async function waitForPersistence<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<{ completed: true; value: T } | { completed: false }> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise.then((value) => ({ completed: true as const, value })),
      new Promise<{ completed: false }>((resolve) => {
        timer = setTimeout(
          () => resolve({ completed: false }),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getUserLevel(userLevel: string | undefined | null): string {`,
    "persistence deadline helper"
  );
}

roll = replaceOnce(
  roll,
  "export default async function handler(req: NextApiRequest, res: NextApiResponse) {",
  `async function handleRoll(req: NextApiRequest, res: NextApiResponse) {
  const requestStartedAt = Date.now();`,
  "roll handler wrapper"
);

roll = replaceOnce(
  roll,
  `  const requestedSafeLuckMultiplier = parseSafeLuckMultiplier(rawArgs);
  const broadcaster = isBroadcasterUser(user, channel);
  const allowlisted = await isRollMultiAllowlisted(user, channelLoginName, channelId);
  const trustedMultiroll = broadcaster || allowlisted;

  const viewerProfileForLimit = trustedMultiroll || !user ? null : await getViewerProfile(channelId, user);`,
  `  const requestedSafeLuckMultiplier = parseSafeLuckMultiplier(rawArgs);
  const broadcaster = isBroadcasterUser(user, channel);

  const [allowlisted, preloadedViewerProfile] = await Promise.all([
    isRollMultiAllowlisted(user, channelLoginName, channelId),
    broadcaster || !user
      ? Promise.resolve(null)
      : getViewerProfile(channelId, user),
  ]);

  const trustedMultiroll = broadcaster || allowlisted;
  const viewerProfileForLimit = trustedMultiroll
    ? null
    : preloadedViewerProfile;`,
  "parallel access/profile reads"
);

roll = replaceOnce(
  roll,
  `  const achievementBonuses = await getAchievementBonuses();
  const coreLuck = await getViewerCoreLuck(channelId, user);
  const serverLuck = await getServerLuckMultiplier(channelId);
  const megaLuck = await getMegaLuckMultiplier(channelId);`,
  `  const [
    achievementBonuses,
    coreLuck,
    serverLuck,
    megaLuck,
  ] = await Promise.all([
    getAchievementBonuses(),
    getViewerCoreLuck(channelId, user),
    getServerLuckMultiplier(channelId),
    getMegaLuckMultiplier(channelId),
  ]);`,
  "parallel luck reads"
);

roll = replaceOnce(
  roll,
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
    : await addGlobalRolls(rollCount);`,
  `  const [tokenPlan, globalRollsAfter]: [
    RollTokenPlan,
    number,
  ] = await Promise.all([
    safeSimulation
      ? Promise.resolve({ effects: [] } as RollTokenPlan)
      : consumeRollTokenBuffsForRolls({
          channelId,
          user,
          rolls: rollCount,
        }),
    safeSimulation
      ? getGlobalRolls()
      : addGlobalRolls(rollCount),
  ]);

  const oneTimeTokenAssisted = tokenPlan.effects.some((effect) =>
    effect.used.some((buff) => buff.consumeOnRoll)
  );`,
  "parallel token/global-roll operations"
);

const persistenceStart = '    let unlockText = "";\n\n    if (!safeSimulation) {';
const tokenUsageMarker =
  "    const tokenUsage = formatConsumedRollTokenEffects(tokenPlan.effects);";

const persistenceStartIndex = roll.indexOf(persistenceStart);
const tokenUsageIndex = roll.indexOf(tokenUsageMarker);

if (
  persistenceStartIndex < 0 ||
  tokenUsageIndex < 0 ||
  tokenUsageIndex <= persistenceStartIndex
) {
  fail("Could not locate the current roll persistence block.");
}

const newPersistence = `    let unlockText = "";
    let statsSyncing = false;

    let criticalPersistence:
      | Promise<
          [
            Awaited<ReturnType<typeof recordViewerRolls>>,
            Awaited<ReturnType<typeof recordCoreRolls>>,
            Awaited<ReturnType<typeof recordAuraRolls>>
          ]
        >
      | null = null;

    if (!safeSimulation) {
      criticalPersistence = Promise.all([
        recordViewerRolls(
          channelId,
          user,
          results,
          oneTimeTokenAssisted ? "token" : "roll"
        ),
        recordCoreRolls(channelId, user, results),
        recordAuraRolls(results),
      ] as const);

      const persistence = await waitForPersistence(
        criticalPersistence,
        ROLL_REPLY_PERSISTENCE_BUDGET_MS
      );

      if (persistence.completed) {
        const [, , unlocked] = persistence.value;
        unlockText = formatAchievementUnlocks(unlocked);
      } else {
        statsSyncing = true;
      }
    }

`;

roll =
  roll.slice(0, persistenceStartIndex) +
  newPersistence +
  roll.slice(tokenUsageIndex);

roll = replaceOnce(
  roll,
  `    const safeText = safeSimulation
      ? \` | 🛡 SAFE SIM x\${formatSafeLuckMultiplier(
          safeLuckMultiplier
        )} luck: no stats/items/quests/records/alerts changed; tokens ignored\`
      : "";
    const suffix = \`\${safeText}\${
      unlockText ? \` | \${unlockText}\` : ""
    }\${tokenText}\${serverBoostText}\${megaBoostText}\`;`,
  `    const safeText = safeSimulation
      ? \` | 🛡 SAFE SIM x\${formatSafeLuckMultiplier(
          safeLuckMultiplier
        )} luck: no stats/items/quests/records/alerts changed; tokens ignored\`
      : "";
    const syncingText = statsSyncing
      ? " | ⏳ stats syncing"
      : "";
    const suffix = \`\${safeText}\${syncingText}\${
      unlockText ? \` | \${unlockText}\` : ""
    }\${tokenText}\${serverBoostText}\${megaBoostText}\`;

    const sendRollReply = (message: string) => {
      const replyMs = Date.now() - requestStartedAt;

      res.setHeader("Server-Timing", \`roll;dur=\${replyMs}\`);
      res.setHeader("X-Sols-Roll-Ms", String(replyMs));

      console.info(
        \`[roll] replied in \${replyMs}ms | channel=\${channelId} | user=\${
          user?.providerId ?? "anon"
        } | rolls=\${rollCount} | syncing=\${statsSyncing}\`
      );

      return text(res, message);
    };

    const queueFollowUp = () => {
      if (safeSimulation || !criticalPersistence) return;

      runPostResponseSerial(
        \`roll-follow-up:\${channelId}\`,
        "roll-follow-up",
        async () => {
          const [updatedProfile] = await criticalPersistence!;

          const outcomes = await Promise.allSettled([
            recordSocialRolls(
              channelId,
              user,
              results,
              oneTimeTokenAssisted ? "token" : "roll",
              updatedProfile
            ),
            recordMegaRolls({
              channelId,
              channelName: channelLoginName,
              user,
              results,
              source: oneTimeTokenAssisted ? "token" : "roll",
              profileRolls:
                updatedProfile.rolls + updatedProfile.tokenRolls,
            }),
            recordActivityRolls({
              channelId,
              channelName: channelLoginName,
              user,
              results,
            }),
          ]);

          for (const outcome of outcomes) {
            if (outcome.status === "rejected") {
              console.error(
                "[roll-follow-up] subsystem failed:",
                outcome.reason
              );
            }
          }
        }
      );

      void runAfterCommandReply(() =>
        announceAuraResults({
          channelId,
          channelName: channelLoginName,
          displayName: name,
          results,
          source: "roll",
        })
      );
    };`,
  "fast reply suffix and background follow-up"
);

roll = replaceOnce(
  roll,
  `      text(res, \`\${formatRollResult(name, best.aura.name, best.effectiveRarity)}\${suffix}\`);

      if (!safeSimulation) {
        await runAfterCommandReply(() =>
          announceAuraResults({
            channelId,
            channelName: channelLoginName,
            displayName: name,
            results,
            source: "roll",
          })
        );
      }

      return;`,
  `      sendRollReply(
        \`\${formatRollResult(
          name,
          best.aura.name,
          best.effectiveRarity
        )}\${suffix}\`
      );
      queueFollowUp();
      return;`,
  "single-roll fast response"
);

roll = replaceOnce(
  roll,
  `    text(res, \`\${msg}\${suffix}\`);

    if (!safeSimulation) {
      await runAfterCommandReply(() =>
        announceAuraResults({
          channelId,
          channelName: channelLoginName,
          displayName: name,
          results,
          source: "roll",
        })
      );
    }

    return;`,
  `    sendRollReply(\`\${msg}\${suffix}\`);
    queueFollowUp();
    return;`,
  "multi-roll fast response"
);

if (!roll.includes("export default async function handler(")) {
  roll =
    roll.trimEnd() +
    `

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await handleRoll(req, res);
  } catch (errorValue) {
    console.error("[roll] request failed:", errorValue);

    if (!res.headersSent) {
      return error(
        res,
        "Roll service was busy. Try the command again in a few seconds."
      );
    }
  }
}
`;
}

if (normalize(rollOriginal) !== roll) {
  backup(rollFile, rollOriginal);
  fs.writeFileSync(rollFile, roll);
  console.log("✅ Added fast-response and post-response roll handling.");
} else {
  console.log("✅ roll.ts already has the fast-response patch.");
}

const accessFile = "src/lib/roll-access.ts";

if (!fs.existsSync(accessFile)) {
  fail(`Missing ${accessFile}`);
}

const accessOriginal = fs.readFileSync(accessFile, "utf8");
let access = normalize(accessOriginal);

if (!access.includes("const DYNAMIC_ALLOWLIST_CACHE")) {
  access = replaceOnce(
    access,
    "let redis: Redis | null = null;",
    `let redis: Redis | null = null;

const DYNAMIC_ALLOWLIST_CACHE = new Map<
  string,
  { expiresAt: number; entries: DynamicRollAccessEntry[] }
>();
const DYNAMIC_ALLOWLIST_CACHE_MS = 5000;`,
    "allowlist cache declaration"
  );

  access = replaceOnce(
    access,
    `export async function getDynamicRollAllowlist(
  channelId: string
): Promise<DynamicRollAccessEntry[]> {
  const r = getRedis();
  if (!r) return [];

  const raw = await r.get<DynamicRollAccessEntry[]>(dynamicAllowlistKey(channelId));
  return normalizeEntries(raw);
}`,
    `export async function getDynamicRollAllowlist(
  channelId: string
): Promise<DynamicRollAccessEntry[]> {
  const cached = DYNAMIC_ALLOWLIST_CACHE.get(channelId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.entries;
  }

  const r = getRedis();
  if (!r) return [];

  const raw = await r.get<DynamicRollAccessEntry[]>(
    dynamicAllowlistKey(channelId)
  );
  const entries = normalizeEntries(raw);

  DYNAMIC_ALLOWLIST_CACHE.set(channelId, {
    entries,
    expiresAt: Date.now() + DYNAMIC_ALLOWLIST_CACHE_MS,
  });

  return entries;
}`,
    "allowlist cache read"
  );

  access = replaceOnce(
    access,
    `  if (!r) throw new Error("Redis is not connected.");
  await r.set(dynamicAllowlistKey(channelId), normalizeEntries(entries));`,
    `  if (!r) throw new Error("Redis is not connected.");

  const normalized = normalizeEntries(entries);
  await r.set(dynamicAllowlistKey(channelId), normalized);

  DYNAMIC_ALLOWLIST_CACHE.set(channelId, {
    entries: normalized,
    expiresAt: Date.now() + DYNAMIC_ALLOWLIST_CACHE_MS,
  });`,
    "allowlist cache save"
  );
}

if (normalize(accessOriginal) !== access) {
  backup(accessFile, accessOriginal);
  fs.writeFileSync(accessFile, access);
  console.log("✅ Added a 5-second dynamic allowlist cache.");
} else {
  console.log("✅ roll-access.ts already has the allowlist cache.");
}

console.log("");
console.log("✅ Nightbot WebProxy roll fix installed.");
console.log("Next: npm run build");
