
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

patchFile("src/pages/dashboard.tsx", (s) => {
  const activityCommands = `

  { id: "knowledge", title: "Knowledge", endpoint: "knowledge", category: "Activity Of Knowledge", description: "View Knowledge, Research progress, scanner level, Merchant Marks, and relic resources.", examples: [""], needsUser: true },
  { id: "research", title: "Research Tree", endpoint: "research", category: "Activity Of Knowledge", description: "View/research Activity upgrades. Unlocks scanner, relic slots, boss damage, market, blueprints, and forecast.", placeholder: "unlock scanner_1", examples: ["", "2", "unlock scanner_1", "unlock boss_damage_1"], needsUser: true, changesData: true },
  { id: "scanner", title: "Scanner", endpoint: "scanner", category: "Activity Of Knowledge", description: "Activity scanner: rare signal, active boss/event, and best-action hints.", examples: [""], needsUser: true },
  { id: "boss", title: "Boss", endpoint: "boss", category: "Activity Of Knowledge", description: "Active boss status. Mods can start a boss; successful rolls damage active bosses.", placeholder: "start", examples: ["", "start"], needsUser: true, changesData: true },
  { id: "worldevent", title: "World Event", endpoint: "worldevent", category: "Activity Of Knowledge", description: "Current Activity world event. Events have 1/250 chance on biome change and last at least 25m.", examples: [""] },
  { id: "forecast", title: "Forecast", endpoint: "forecast", category: "Activity Of Knowledge", description: "Semi-smart daily activity forecast. Useful but not exact.", examples: [""], needsUser: true },
  { id: "market", title: "Activity Market", endpoint: "market", category: "Activity Of Knowledge", description: "Safe marketplace using Merchant Marks.", placeholder: "buy blueprint_fragment", examples: ["", "buy knowledge_note", "buy blueprint_fragment"], needsUser: true, changesData: true },
  { id: "blueprints", title: "Blueprints", endpoint: "blueprints", category: "Activity Of Knowledge", description: "Blueprint sources, unlocks, and fragment overview.", placeholder: "biome_lens", examples: ["", "biome_lens", "relic_forge", "quantum_press"], needsUser: true },
  { id: "relics", title: "Relics", endpoint: "relics", category: "Activity Of Knowledge", description: "Relic catalog/owned relics. Reroll machine unlocks from research.", placeholder: "reroll relic_id", examples: ["", "reroll scrap_magnet"], needsUser: true, changesData: true },`;

  if (!s.includes(`category: "Activity Of Knowledge"`)) {
    const afterLuck = `  { id: "luck", title: "Luck", endpoint: "luck", category: "Mega Systems", description: "Luck estimate/global luck command.", placeholder: "global", examples: ["", "global"], needsUser: true },`;
    if (s.includes(afterLuck)) {
      s = s.replace(afterLuck, afterLuck + activityCommands);
    } else {
      s = s.replace(`];\n\nconst EXCLUDED`, activityCommands + `\n];\n\nconst EXCLUDED`);
    }
  }

  if (!s.includes(`{ id: "knowledge", query: "" }`)) {
    const homeEnd = `  { id: "dcalerts", query: "" },
];`;
    if (s.includes(homeEnd)) {
      s = s.replace(homeEnd, `  { id: "dcalerts", query: "" },
  { id: "knowledge", query: "" },
  { id: "research", query: "" },
  { id: "scanner", query: "" },
  { id: "boss", query: "" },
  { id: "worldevent", query: "" },
  { id: "forecast", query: "" },
  { id: "market", query: "" },
  { id: "blueprints", query: "" },
  { id: "relics", query: "" },
];`);
    }
  }

  if (!s.includes(`/activity`)) {
    s = s.replace(
      `<h1>Sols RNG Dashboard</h1>`,
      `<h1>Sols RNG Dashboard</h1>\n      <p><a href="/activity">Open Activity Of Knowledge →</a></p>`
    );
  }

  return s;
});

patchFile("src/lib/sol-info.ts", (s) => {
  if (!s.includes("const ACTIVITY_INFO")) {
    s = s.replace(`const PAGE_SIZE = 8;`, `const PAGE_SIZE = 8;

const ACTIVITY_INFO = [
  "The Activity Of Knowledge Update commands:",
  "!knowledge = view Knowledge, Research, Scanner, Merchant Marks, and Relic Shards.",
  "!research = view Research Tree pages. Use !research unlock <id> to unlock upgrades.",
  "!scanner = view Activity scanner, rare signal, boss, event, and best-action hints.",
  "!boss = view active boss. Mods can use !boss start.",
  "!worldevent = view the current Activity world event.",
  "!forecast = semi-smart daily forecast using activity data, not exact predictions.",
  "!market = safe marketplace using Merchant Marks. Use !market buy <id>.",
  "!blueprints = view blueprint unlocks and sources.",
  "!relics = view relic catalog/owned relics. Reroll later with !relics reroll <id>.",
  "Website: /activity"
];`);
  }

  if (!s.includes(`"🧠 Activity Of Knowledge"`)) {
    const megaBlock = `  if (mode === "mega" || mode === "expansion" || mode === "features") {
    return paginate(MEGA_INFO, pageRaw, (x) => x, "✨ Mega Features", 4);
  }`;
    if (s.includes(megaBlock)) {
      s = s.replace(megaBlock, `${megaBlock}

  if (mode === "activity" || mode === "knowledge" || mode === "research" || mode === "aok") {
    return paginate(ACTIVITY_INFO, pageRaw, (x) => x, "🧠 Activity Of Knowledge", 4);
  }`);
    }
  }

  if (!s.includes("!info sol activity [page]")) {
    s = s.replace(
      `"!info sol mega [page]: mega feature help",`,
      `"!info sol mega [page]: mega feature help",
  "!info sol activity [page]: Activity Of Knowledge help",`
    );
  }

  if (!s.includes(`topic === "activity"`)) {
    s = s.replace(
      `if (topic === "help" || topic === "commands" || topic === "info") return coreTopic("help");`,
      `if (topic === "help" || topic === "commands" || topic === "info") return coreTopic("help");
  if (topic === "activity" || topic === "knowledge" || topic === "research" || topic === "aok") return coreTopic(topic, arg);`
    );
  }

  return s;
});

patchFile("src/lib/social-system.ts", (s) => {
  if (s.includes("The Activity Of Knowledge Update is live")) return s;
  return s.replace(/const UPDATE_NOTES = \[[\s\S]*?\];/, `const UPDATE_NOTES = [
  "The Activity Of Knowledge Update is live: added Knowledge, Research Tree, Bosses, Relics, Scanner, Marketplace, Blueprints, Forecast, and World Events.",
  "Knowledge is the new research currency. Earn it from rare activity, bosses, events, blueprints, and progression.",
  "Research Tree added: unlock scanner levels, relic slots, boss damage upgrades up to +250%, market upgrades, blueprint tools, and forecast upgrades.",
  "Bosses added: successful rolls deal boss damage, with bonus damage from 1/10k, 1/100k, 1M, 10M, 100M, and 1B/challenged+ auras.",
  "World Events added: rare 1/250 chance on biome change, lasting at least 25 minutes. Check !worldevent.",
  "New commands: !knowledge, !research, !scanner, !boss, !worldevent, !forecast, !market, !blueprints, !relics. Website: /activity."
];`);
});

patchFile("src/pages/activity.tsx", (s) => {
  if (s.includes("Nightbot Copy Commands")) return s;
  const section = `
        <section style={{ background: "#11152a", border: "1px solid #20294d", borderRadius: 18, padding: 18, marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Nightbot Copy Commands</h2>
          <p style={{ color: "#b9c1df" }}>Add these in Nightbot. They use your deployed Vercel URL.</p>
          <pre style={{ background: "#080a14", border: "1px solid #26305b", borderRadius: 12, padding: 14, overflowX: "auto", color: "#b6ffdf", whiteSpace: "pre-wrap" }}>{\\\`!knowledge   $(urlfetch https://sols-rng-twitch.vercel.app/api/knowledge?channel=$(channel)&user=$(user)&query=$(query))
!research    $(urlfetch https://sols-rng-twitch.vercel.app/api/research?channel=$(channel)&user=$(user)&query=$(query))
!scanner     $(urlfetch https://sols-rng-twitch.vercel.app/api/scanner?channel=$(channel)&user=$(user)&query=$(query))
!boss        $(urlfetch https://sols-rng-twitch.vercel.app/api/boss?channel=$(channel)&user=$(user)&query=$(query))
!worldevent  $(urlfetch https://sols-rng-twitch.vercel.app/api/worldevent?channel=$(channel)&user=$(user)&query=$(query))
!forecast    $(urlfetch https://sols-rng-twitch.vercel.app/api/forecast?channel=$(channel)&user=$(user)&query=$(query))
!market      $(urlfetch https://sols-rng-twitch.vercel.app/api/market?channel=$(channel)&user=$(user)&query=$(query))
!blueprints  $(urlfetch https://sols-rng-twitch.vercel.app/api/blueprints?channel=$(channel)&user=$(user)&query=$(query))
!relics      $(urlfetch https://sols-rng-twitch.vercel.app/api/relics?channel=$(channel)&user=$(user)&query=$(query))\\\`}</pre>
        </section>`;
  return s.replace(`      </div>
    </main>`, `${section}
      </div>
    </main>`);
});

console.log("✅ Dashboard + info cleanup complete.");
