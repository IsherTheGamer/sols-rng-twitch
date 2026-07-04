const fs = require('fs');

function patchFile(path, patcher) {
  if (!fs.existsSync(path)) {
    console.log(`⚠️ Missing ${path}, skipped.`);
    return;
  }
  const before = fs.readFileSync(path, 'utf8');
  const after = patcher(before);
  fs.writeFileSync(path, after);
  console.log(before === after ? `ℹ️ ${path} unchanged.` : `✅ Patched ${path}.`);
}

patchFile('src/pages/api/roll.ts', (s) => {
  if (!s.includes('@/lib/mega-feature-system')) {
    s = s.replace(
      'import { getServerLuckMultiplier, recordSocialRolls } from "@/lib/social-system";',
      'import { getServerLuckMultiplier, recordSocialRolls } from "@/lib/social-system";\nimport { getMegaLuckMultiplier, recordMegaRolls } from "@/lib/mega-feature-system";'
    );
  }

  if (!s.includes('const megaLuck = await getMegaLuckMultiplier(channelId);')) {
    s = s.replace(
      '  const serverLuck = await getServerLuckMultiplier(channelId);',
      '  const serverLuck = await getServerLuckMultiplier(channelId);\n  const megaLuck = await getMegaLuckMultiplier(channelId);'
    );
  }

  s = s.replace(
    'achievementFinalLuckMultiplier: achievementBonuses.finalLuckMultiplier * serverLuck.multiplier,',
    'achievementFinalLuckMultiplier: achievementBonuses.finalLuckMultiplier * serverLuck.multiplier * megaLuck.multiplier,'
  );

  if (!s.includes('await recordMegaRolls({')) {
    s = s.replace(
      '    await recordSocialRolls(channelId, user, results, oneTimeTokenAssisted ? "token" : "roll");',
      `    await recordSocialRolls(channelId, user, results, oneTimeTokenAssisted ? "token" : "roll");
    await recordMegaRolls({
      channelId,
      channelName: channelLoginName,
      user,
      results,
      source: oneTimeTokenAssisted ? "token" : "roll",
    });`
    );
  }

  if (!s.includes('const megaBoostText = megaLuck.percent > 0')) {
    s = s.replace(
      '    const serverBoostText = serverLuck.percent > 0 ? ` | Server Boost +${Math.floor(serverLuck.percent)}%` : "";\n    const suffix = `${unlockText ? ` | ${unlockText}` : ""}${tokenText}${serverBoostText}`;',
      '    const serverBoostText = serverLuck.percent > 0 ? ` | Server Boost +${Math.floor(serverLuck.percent)}%` : "";\n    const megaBoostText = megaLuck.percent > 0 ? ` | Event +${Math.floor(megaLuck.percent)}%` : "";\n    const suffix = `${unlockText ? ` | ${unlockText}` : ""}${tokenText}${serverBoostText}${megaBoostText}`;'
    );
  }

  return s;
});

patchFile('src/pages/api/biome-tick.ts', (s) => {
  s = s.replace(/\nimport \{ sendDiscordBiomeAlert \} from "@\/lib\/discord-alerts";/g, '');
  if (!s.includes('@/lib/mega-feature-system')) {
    s = s.replace(
      'import { sendNightbotMessage } from "@/lib/nightbot";',
      'import { sendNightbotMessage } from "@/lib/nightbot";\nimport { recordMegaBiome } from "@/lib/mega-feature-system";'
    );
  }

  // Remove old Discord biome-alert block from the earlier webhook patch if present.
  s = s.replace(/\n\s*if \(result\.biomeChanged\) \{\n\s*await sendDiscordBiomeAlert\(\{[\s\S]*?\n\s*\}\);\n\s*\}\n/g, '\n');

  if (!s.includes('await recordMegaBiome({')) {
    s = s.replace(
      '  const unlockText = formatAchievementUnlocks(unlocked);',
      `  const unlockText = formatAchievementUnlocks(unlocked);

  if (result.biomeChanged) {
    await recordMegaBiome({
      channelId,
      channelName,
      biomeId: result.state.biomeId,
      timeOfDay: result.state.timeOfDay,
      expiresAt: result.state.biomeExpiresAt,
    });
  }`
    );
  }

  return s;
});

patchFile('src/lib/global-announcements.ts', (s) => {
  // Prevent duplicate Discord aura alerts if the earlier simple webhook patch exists.
  s = s.replace(/\nimport \{ sendDiscordAuraAlert \} from "\.\/discord-alerts";/g, '');
  s = s.replace(/\n\s*await sendDiscordAuraAlert\(\{\n[\s\S]*?\n\s*\}\);\n/g, '\n');
  return s;
});

console.log('✅ Expanded features integration finished. Run npm run build next.');
