const fs=require("fs");
function patchFile(path,patcher){if(!fs.existsSync(path)){console.warn(`⚠️ Missing ${path}, skipped.`);return}const before=fs.readFileSync(path,"utf8");const after=patcher(before);if(after!==before){fs.writeFileSync(path,after);console.log(`✅ Patched ${path}`)}else console.log(`ℹ️ No changes needed for ${path}`)}
patchFile("src/pages/api/roll.ts",s=>{if(!s.includes("recordActivityRolls")){s=s.replace('import { getMegaLuckMultiplier, recordMegaRolls } from "@/lib/mega-feature-system";','import { getMegaLuckMultiplier, recordMegaRolls } from "@/lib/mega-feature-system";\nimport { recordActivityRolls } from "@/lib/activity-of-knowledge-system";')}const needle=`    await recordMegaRolls({
      channelId,
      channelName: channelLoginName,
      user,
      results,
      source: oneTimeTokenAssisted ? "token" : "roll",
    });`;const rep=`${needle}

    await recordActivityRolls({
      channelId,
      channelName: channelLoginName,
      user,
      results,
    });`;if(!s.includes("await recordActivityRolls({")&&s.includes(needle))s=s.replace(needle,rep);return s});
patchFile("src/pages/api/biome-tick.ts",s=>{if(!s.includes("maybeStartActivityWorldEvent")){s=s.replace('import { recordMegaBiome } from "@/lib/mega-feature-system";','import { recordMegaBiome } from "@/lib/mega-feature-system";\nimport { maybeStartActivityWorldEvent } from "@/lib/activity-of-knowledge-system";')}const needle=`    await recordMegaBiome({
      channelId,
      channelName,
      biomeId: result.state.biomeId,
      timeOfDay: result.state.timeOfDay,
      expiresAt: result.state.biomeExpiresAt,
    });`;const rep=`${needle}

    const activityEvent = await maybeStartActivityWorldEvent({
      channelId,
      channelName,
      biomeId: result.state.biomeId,
    });

    if (activityEvent.message) {
      await sendNightbotMessage(activityEvent.message, channelName);
    }`;if(!s.includes("const activityEvent = await maybeStartActivityWorldEvent")&&s.includes(needle))s=s.replace(needle,rep);return s});
patchFile("src/pages/dashboard.tsx",s=>s.includes("/activity")?s:s.replace("<h1>Sols RNG Dashboard</h1>","<h1>Sols RNG Dashboard</h1>\n      <p><a href=\"/activity\">Open Activity Of Knowledge →</a></p>"));
patchFile("src/pages/api/reset.ts",s=>{if(s.includes("aok:"))return s;return s.replace('key.startsWith("mega:lastbiome:")','key.startsWith("mega:lastbiome:") ||\n    key.startsWith("aok:")')});
console.log("✅ Activity Of Knowledge integration patch complete.");
