const fs = require("fs");

const rollPath = "src/pages/api/roll.ts";
let roll = fs.readFileSync(rollPath, "utf8");

if (!roll.includes("@/lib/social-system")) {
  roll = roll.replace(
    'import { getViewerCoreLuck, recordCoreRolls } from "@/lib/core-system";',
    'import { getViewerCoreLuck, recordCoreRolls } from "@/lib/core-system";\nimport { getServerLuckMultiplier, recordSocialRolls } from "@/lib/social-system";'
  );
}

if (!roll.includes("const serverLuck = await getServerLuckMultiplier(channelId);")) {
  roll = roll.replace(
    "  const achievementBonuses = await getAchievementBonuses();\n  const coreLuck = await getViewerCoreLuck(channelId, user);",
    "  const achievementBonuses = await getAchievementBonuses();\n  const coreLuck = await getViewerCoreLuck(channelId, user);\n  const serverLuck = await getServerLuckMultiplier(channelId);"
  );
}

roll = roll.replace(
  "achievementFinalLuckMultiplier: achievementBonuses.finalLuckMultiplier,",
  "achievementFinalLuckMultiplier: achievementBonuses.finalLuckMultiplier * serverLuck.multiplier,"
);

if (!roll.includes("await recordSocialRolls(channelId, user, results")) {
  roll = roll.replace(
    "    await recordCoreRolls(channelId, user, results);",
    "    await recordCoreRolls(channelId, user, results);\n    await recordSocialRolls(channelId, user, results, oneTimeTokenAssisted ? \"token\" : \"roll\");"
  );
}

if (!roll.includes("serverBoostText")) {
  roll = roll.replace(
    "    const tokenUsage = formatConsumedRollTokenEffects(tokenPlan.effects);\n    const tokenText = tokenUsage ? ` | Tokens used: ${tokenUsage}` : \"\";\n    const suffix = `${unlockText ? ` | ${unlockText}` : \"\"}${tokenText}`;",
    "    const tokenUsage = formatConsumedRollTokenEffects(tokenPlan.effects);\n    const tokenText = tokenUsage ? ` | Tokens used: ${tokenUsage}` : \"\";\n    const serverBoostText = serverLuck.percent > 0 ? ` | Server Boost +${Math.floor(serverLuck.percent)}%` : \"\";\n    const suffix = `${unlockText ? ` | ${unlockText}` : \"\"}${tokenText}${serverBoostText}`;"
  );
}

fs.writeFileSync(rollPath, roll);
console.log("✅ Social Mega Patch roll integration installed.");
console.log("Next: npm run build");
