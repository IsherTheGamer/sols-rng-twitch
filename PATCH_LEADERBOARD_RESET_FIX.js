#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const STAMP = Date.now();

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) fail(`Missing required file: ${rel}`);
  return fs.readFileSync(file, "utf8");
}

function write(rel, content) {
  const file = path.join(ROOT, rel);
  const backup = `${file}.bak.${STAMP}`;
  fs.copyFileSync(file, backup);
  console.log(`🧯 Backup: ${path.relative(ROOT, backup)}`);
  fs.writeFileSync(file, content, "utf8");
  console.log(`✅ Wrote ${rel}`);
}

function replaceOnce(content, search, replacement, label) {
  const count = content.split(search).length - 1;
  if (count !== 1) {
    fail(`${label}: expected exactly one match, found ${count}. The repo may have changed.`);
  }
  return content.replace(search, replacement);
}

function replaceRegexOnce(content, regex, replacement, label) {
  const matches = content.match(regex);
  if (!matches) fail(`${label}: patch anchor was not found. The repo may have changed.`);
  return content.replace(regex, replacement);
}

const apiPath = "src/pages/api/player-reset.ts";
const pagePath = "src/pages/player-reset.tsx";

let api = read(apiPath);
let page = read(pagePath);

if (
  api.includes("function resetLeaderboardProfileFields(") &&
  page.includes('"All channel leaderboards"')
) {
  console.log("✅ Leaderboard reset fix is already installed.");
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* UI wording                                                                  */
/* -------------------------------------------------------------------------- */

page = replaceOnce(
  page,
  '["profile_index", "Profile index entry", "Remove from username lookup and standard leaderboards."],',
  '["profile_index", "Profile lookup index only", "Remove from username lookup. The All channel leaderboards option below also handles this automatically."],',
  "Rename profile index option"
);

page = replaceOnce(
  page,
  '["leaderboard_channel_periods", "Channel period leaderboards", "Remove user rows from daily/weekly/monthly/yearly tables."],',
  '["leaderboard_channel_periods", "All channel leaderboards", "Reset !leaderboard and all-time !lb values, remove the profile index, and remove channel daily/weekly/monthly/yearly rows."],',
  "Rename channel leaderboard option"
);

page = replaceOnce(
  page,
  '["leaderboard_global_periods", "Global period leaderboards", "Remove cross-channel user rows."],',
  '["leaderboard_global_periods", "Global period leaderboards", "Remove the player from cross-channel daily/weekly/monthly/yearly tables. This is separate from the channel leaderboard."],',
  "Clarify global leaderboard option"
);

/* -------------------------------------------------------------------------- */
/* API descriptions                                                            */
/* -------------------------------------------------------------------------- */

api = replaceOnce(
  api,
  'profile_index: "Remove player from profile lookup/standard leaderboard index.",',
  'profile_index: "Remove player from the profile lookup index only.",',
  "Clarify profile index API description"
);

api = replaceOnce(
  api,
  'leaderboard_channel_periods: "Remove player rows from channel period leaderboards.",',
  'leaderboard_channel_periods: "Reset all channel leaderboard values and remove channel period rows.",',
  "Clarify channel leaderboard API description"
);

api = replaceOnce(
  api,
  'leaderboard_global_periods: "Remove player rows from cross-channel period leaderboards.",',
  'leaderboard_global_periods: "Remove player rows from cross-channel period leaderboards.",',
  "Confirm global leaderboard API description"
);

/* -------------------------------------------------------------------------- */
/* Profile fields used by !leaderboard and all-time !lb                       */
/* -------------------------------------------------------------------------- */

api = replaceOnce(
  api,
  `  profile.updatedAt = Date.now();
}

function resetInventoryFields(`,
  `  profile.updatedAt = Date.now();
}

function resetLeaderboardProfileFields(profile: Record<string, any>): void {
  profile.rolls = 0;
  profile.tokenRolls = 0;
  profile.potionRolls = 0;
  profile.rarityTotal = 0;
  profile.bestAura = null;
  profile.bestTokenAura = null;
  profile.bestPotionAura = null;
  profile.updatedAt = Date.now();
}

function resetInventoryFields(`,
  "Insert all-time leaderboard profile reset"
);

/* -------------------------------------------------------------------------- */
/* Shared matching helpers for current and legacy period rows                  */
/* -------------------------------------------------------------------------- */

const helpers = `
function periodLeaderboardRowMatches(
  rowKey: string,
  entry: Record<string, any> | null | undefined,
  target: TargetPlayer,
  global: boolean
): boolean {
  const expectedKey = global
    ? \`\${target.channelId}:\${target.userId}\`
    : target.userId;

  if (rowKey === expectedKey) return true;

  if (
    global &&
    rowKey.startsWith(\`\${target.channelId}:\`) &&
    rowKey.endsWith(\`:\${target.userId}\`)
  ) {
    return true;
  }

  const storedId = String(entry?.id ?? entry?.userId ?? "").trim();
  if (
    storedId === expectedKey ||
    storedId === target.userId ||
    storedId === \`\${target.channelId}:\${target.userId}\`
  ) {
    return true;
  }

  const rawName = String(
    entry?.name ??
      entry?.userName ??
      entry?.username ??
      entry?.displayName ??
      ""
  );
  const nameTail = rawName.includes("/")
    ? rawName.split("/").pop() ?? rawName
    : rawName;

  return (
    Boolean(target.username) &&
    normalizeUsername(nameTail) === target.username
  );
}

async function countPeriodLeaderboardRows(
  r: Redis,
  target: TargetPlayer,
  global: boolean
): Promise<number> {
  const pattern = global
    ? "mega:gstats:*"
    : \`mega:stats:\${target.channelId}:*\`;

  const keys = await keysByPattern(r, pattern);
  const values = await mgetValues(r, keys);
  let matches = 0;

  for (const stats of values) {
    for (const [rowKey, entry] of Object.entries(stats?.users ?? {})) {
      if (
        periodLeaderboardRowMatches(
          rowKey,
          entry as Record<string, any>,
          target,
          global
        )
      ) {
        matches++;
      }
    }
  }

  return matches;
}

`;

api = replaceOnce(
  api,
  "async function buildPlan(\n",
  helpers + "async function buildPlan(\n",
  "Insert leaderboard matching helpers"
);

/* -------------------------------------------------------------------------- */
/* Accurate preview counts                                                     */
/* -------------------------------------------------------------------------- */

api = replaceOnce(
  api,
  `  const valueByKey = new Map<string, any>(
    sharedKeys.map((key, index) => [key, values[index]])
  );

  const items: ResetPlanItem[] = options.map((option) => {`,
  `  const valueByKey = new Map<string, any>(
    sharedKeys.map((key, index) => [key, values[index]])
  );

  const profileIndexMatches = (
    (valueByKey.get(keys.profileIndex) as string[] | null) ?? []
  ).filter(
    (entry) =>
      entry === target.profileKey ||
      entry.endsWith(\`:\${target.userId}\`)
  ).length;

  const [channelLeaderboardMatches, globalLeaderboardMatches] =
    await Promise.all([
      options.includes("leaderboard_channel_periods")
        ? countPeriodLeaderboardRows(r, target, false)
        : Promise.resolve(0),
      options.includes("leaderboard_global_periods")
        ? countPeriodLeaderboardRows(r, target, true)
        : Promise.resolve(0),
    ]);

  const items: ResetPlanItem[] = options.map((option) => {`,
  "Insert leaderboard preview counts"
);

api = replaceOnce(
  api,
  `    if (option === "leaderboard_channel_periods") {
      key = \`mega:stats:\${channelId}:*\`;
      kind = "shared";
      matches = 0;
    }`,
  `    if (option === "leaderboard_channel_periods") {
      key = \`profiles:\${channelId}:keys + mega:stats:\${channelId}:*\`;
      kind = "shared";
      matches = profileIndexMatches + channelLeaderboardMatches;
    }`,
  "Use channel leaderboard preview count"
);

api = replaceOnce(
  api,
  `    if (option === "leaderboard_global_periods") {
      key = "mega:gstats:*";
      kind = "shared";
      matches = 0;
    }`,
  `    if (option === "leaderboard_global_periods") {
      key = "mega:gstats:*";
      kind = "shared";
      matches = globalLeaderboardMatches;
    }`,
  "Use global leaderboard preview count"
);

/* -------------------------------------------------------------------------- */
/* Robust profile-index removal                                                */
/* -------------------------------------------------------------------------- */

api = replaceRegexOnce(
  api,
  /async function removeProfileIndex\([\s\S]*?\n}\n\nasync function resetPeriodLeaderboards\(/,
  `async function removeProfileIndex(
  r: Redis,
  target: TargetPlayer
): Promise<number> {
  const key = \`profiles:\${target.channelId}:keys\`;
  const list = (await r.get<string[]>(key)) ?? [];
  const values = await mgetValues(r, list);

  const next = list.filter((entry, index) => {
    const profile = values[index] as Record<string, any> | null;
    const entryUserId = cleanId(entry.split(":").pop());
    const profileUserId = cleanId(profile?.userId);
    const profileUsername = normalizeUsername(profile?.displayName);

    return !(
      entry === target.profileKey ||
      entryUserId === target.userId ||
      profileUserId === target.userId ||
      (Boolean(target.username) && profileUsername === target.username)
    );
  });

  const removed = list.length - next.length;
  if (removed > 0) await r.set(key, next);
  return removed;
}

async function resetPeriodLeaderboards(`,
  "Replace profile-index removal"
);

/* -------------------------------------------------------------------------- */
/* Robust period-row removal                                                   */
/* -------------------------------------------------------------------------- */

api = replaceRegexOnce(
  api,
  /async function resetPeriodLeaderboards\([\s\S]*?\n}\n\nasync function removeOtherExactKeys\(/,
  `async function resetPeriodLeaderboards(
  r: Redis,
  target: TargetPlayer,
  global: boolean
): Promise<number> {
  const pattern = global
    ? "mega:gstats:*"
    : \`mega:stats:\${target.channelId}:*\`;

  const keys = await keysByPattern(r, pattern);
  const values = await mgetValues(r, keys);
  const writes: Record<string, any> = {};
  let changed = 0;

  for (let index = 0; index < keys.length; index++) {
    const stats = values[index];
    if (!stats?.users) continue;

    let removedFromTable = 0;

    for (const [rowKey, entry] of Object.entries(stats.users)) {
      if (
        periodLeaderboardRowMatches(
          rowKey,
          entry as Record<string, any>,
          target,
          global
        )
      ) {
        delete stats.users[rowKey];
        removedFromTable++;
      }
    }

    if (removedFromTable === 0) continue;

    const remainingBestUser = Object.values(stats.users)
      .filter((entry: any) => entry?.bestAura)
      .sort(
        (a: any, b: any) =>
          b.bestAura.rarity - a.bestAura.rarity
      )[0] as any;

    stats.bestAura = remainingBestUser
      ? {
          name: remainingBestUser.bestAura.name,
          rarity: remainingBestUser.bestAura.rarity,
          user: remainingBestUser.name,
        }
      : undefined;

    stats.updatedAt = Date.now();
    writes[keys[index]] = stats;
    changed += removedFromTable;
  }

  if (Object.keys(writes).length > 0) await r.mset(writes);
  return changed;
}

async function removeOtherExactKeys(`,
  "Replace period leaderboard cleanup"
);

/* -------------------------------------------------------------------------- */
/* Execute behavior                                                            */
/* -------------------------------------------------------------------------- */

api = replaceOnce(
  api,
  `  if (
    inventory &&
    INVENTORY_OPTIONS.some((option) => selected.has(option))
  ) {`,
  `  if (
    profile &&
    selected.has("leaderboard_channel_periods") &&
    !deletes.has(keys.profile)
  ) {
    resetLeaderboardProfileFields(profile);
    writes[keys.profile] = profile;
  }

  if (
    inventory &&
    INVENTORY_OPTIONS.some((option) => selected.has(option))
  ) {`,
  "Reset profile leaderboard values"
);

api = replaceOnce(
  api,
  `  if (selected.has("profile_index")) {
    await removeProfileIndex(r, target);
    sharedChanges++;
  }`,
  `  if (selected.has("profile_index")) {
    sharedChanges += await removeProfileIndex(r, target);
  }`,
  "Count profile-index removals"
);

api = replaceOnce(
  api,
  `  if (selected.has("leaderboard_channel_periods")) {
    sharedChanges += await resetPeriodLeaderboards(r, target, false);
  }`,
  `  if (selected.has("leaderboard_channel_periods")) {
    sharedChanges += await removeProfileIndex(r, target);
    sharedChanges += await resetPeriodLeaderboards(r, target, false);
  }`,
  "Make channel leaderboard cleanup comprehensive"
);

api = replaceOnce(
  api,
  '    "Period leaderboard cleanup removes only the player\'s row. Channel/global aggregate quest totals are preserved so other viewers are not punished.",',
  '    "All channel leaderboards also reset the profile values used by !leaderboard and all-time !lb, preventing old totals from returning after one new roll.",\n    "Period cleanup removes only the player rows. Channel/global aggregate quest totals are preserved so other viewers are not punished.",',
  "Update reset notes"
);

write(apiPath, api);
write(pagePath, page);

console.log("");
console.log("✅ Leaderboard reset fix installed.");
console.log("   • All channel leaderboards now covers !leaderboard and all-time !lb");
console.log("   • Period rows support current and legacy key formats");
console.log("   • Preview shows real matching row counts");
console.log("   • Old all-time totals are zeroed before the player can reappear");
