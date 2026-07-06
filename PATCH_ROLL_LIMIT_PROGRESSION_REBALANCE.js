const fs = require("fs");

function patchFile(path, patcher) {
  if (!fs.existsSync(path)) {
    console.warn(`⚠️ Missing ${path}, skipped.`);
    return;
  }

  const before = fs.readFileSync(path, "utf8");
  const after = patcher(before);

  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`✅ Patched ${path}`);
  } else {
    console.log(`ℹ️ No changes needed for ${path}`);
  }
}

patchFile("src/pages/api/roll.ts", (s) => {
  s = s.replace(`import { isBroadcasterUser, recordViewerRolls } from "@/lib/profile";`, `import { getViewerProfile, isBroadcasterUser, recordViewerRolls } from "@/lib/profile";`);

  s = s.replace(`const VIEWER_MULTIROLL_LIMIT = 3;`, `const VIEWER_MULTIROLL_LIMIT = 7;`);
  s = s.replace(`const VIP_MULTIROLL_LIMIT = 10;`, `const VIP_MULTIROLL_LIMIT = 15;`);
  s = s.replace(`const MOD_MULTIROLL_LIMIT = 20;`, `const MOD_MULTIROLL_LIMIT = 25;`);

  if (!s.includes("ROLL_LIMIT_MILESTONES")) {
    s = s.replace(
`const TRUSTED_MULTIROLL_LIMIT = 10000;
const MAX_DISPLAY_RESULTS = 5;`,
`const TRUSTED_MULTIROLL_LIMIT = 10000;
const MAX_DISPLAY_RESULTS = 5;

const ROLL_LIMIT_MILESTONES = [
  1000,
  10000,
  100000,
  1000000,
  10000000,
  100000000,
  1000000000,
] as const;

function getRollLimitProgressBonus(totalRolls: number): number {
  return ROLL_LIMIT_MILESTONES.filter((milestone) => totalRolls >= milestone).length;
}`
    );
  }

  s = s.replace(
`function getRoleRollLimit(options: {
  userLevel: string | undefined | null;
  isMod: boolean;
  trustedMultiroll: boolean;
}): number {
  if (options.trustedMultiroll) return TRUSTED_MULTIROLL_LIMIT;
  if (options.isMod) return MOD_MULTIROLL_LIMIT;
  if (isVipUser(options.userLevel)) return VIP_MULTIROLL_LIMIT;
  return VIEWER_MULTIROLL_LIMIT;
}`,
`function getRoleRollLimit(options: {
  userLevel: string | undefined | null;
  isMod: boolean;
  trustedMultiroll: boolean;
  rollProgressBonus: number;
}): number {
  if (options.trustedMultiroll) return TRUSTED_MULTIROLL_LIMIT;

  const bonus = Math.max(0, Math.floor(options.rollProgressBonus || 0));
  if (options.isMod) return MOD_MULTIROLL_LIMIT + bonus;
  if (isVipUser(options.userLevel)) return VIP_MULTIROLL_LIMIT + bonus;
  return VIEWER_MULTIROLL_LIMIT + bonus;
}`
  );

  if (!s.includes("rollProgressBonus")) {
    console.error("❌ Roll limit function patch did not apply.");
    process.exit(1);
  }

  const oldBlock = `  const maxAllowed = getRoleRollLimit({
    userLevel: user?.userLevel,
    isMod,
    trustedMultiroll,
  });`;

  const newBlock = `  const viewerProfileForLimit = trustedMultiroll || !user ? null : await getViewerProfile(channelId, user);
  const totalProfileRollsForLimit =
    (viewerProfileForLimit?.rolls ?? 0) +
    (viewerProfileForLimit?.tokenRolls ?? 0) +
    (viewerProfileForLimit?.potionRolls ?? 0);
  const rollProgressBonus = trustedMultiroll ? 0 : getRollLimitProgressBonus(totalProfileRollsForLimit);

  const maxAllowed = getRoleRollLimit({
    userLevel: user?.userLevel,
    isMod,
    trustedMultiroll,
    rollProgressBonus,
  });`;

  if (s.includes(oldBlock)) {
    s = s.replace(oldBlock, newBlock);
  } else if (!s.includes("viewerProfileForLimit")) {
    console.error("❌ Could not find maxAllowed block.");
    process.exit(1);
  }

  s = s.replace(`    const bonusText = bonusRolls > 0 ? \` (+\${bonusRolls} achievement bonus)\` : "";
    const msg =
      \`\${name} rolled \${rollCount}x\${bonusText} — top \${displayCount}: \` +`,
`    const msg =
      \`\${name} rolled \${rollCount}x — top \${displayCount}: \` +`);

  return s;
});

patchFile("src/lib/social-system.ts", (s) => {
  if (s.includes("Roll limit rebalance: viewers can now roll up to 7x")) return s;

  const marker = `const UPDATE_NOTES = [`;
  if (!s.includes(marker)) return s;

  return s.replace(
    marker,
    `const UPDATE_NOTES = [
  "Roll limit rebalance: viewers can now roll up to 7x, VIP/subs 15x, mods 25x. Players gain hidden +1 max roll at 1k, 10k, 100k, 1M, 10M, 100M, and 1B total rolls.",`
  );
});

console.log("✅ Roll limit progression rebalance complete.");
