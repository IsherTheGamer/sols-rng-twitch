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

/* Core material drop balance:
   Circuit Scrap was gated at 1/1k+ and made early cores too slow for viewers.
   New rule: Circuit Scrap drops from 1/450+ auras.
*/
patchFile("src/lib/core-system.ts", (s) => {
  const oldLine = `if (roll.effectiveRarity >= 1000) add("circuit_scrap", 1);`;
  const newLine = `if (roll.effectiveRarity >= 450) add("circuit_scrap", 1);`;

  if (s.includes(newLine)) return s;

  if (!s.includes(oldLine)) {
    console.error("❌ Could not find the Circuit Scrap drop threshold line.");
    process.exit(1);
  }

  return s.replace(oldLine, newLine);
});

/* Crafting guide material source text */
patchFile("src/pages/crafting.tsx", (s) => {
  return s
    .replace(`["Circuit Scrap", "Roll 1/1k+ auras; also quests/boxes."]`, `["Circuit Scrap", "Roll 1/450+ auras; also quests/boxes."]`)
    .replace(`Circuit Scrap", "Roll 1/1k+`, `Circuit Scrap", "Roll 1/450+`);
});

/* Info text if the phrase exists anywhere */
patchFile("src/lib/sol-info.ts", (s) => {
  return s.replace(/1\/1k\+ auras/g, "1/450+ auras");
});

/* Update notes so users know the change happened */
patchFile("src/lib/social-system.ts", (s) => {
  if (s.includes("Circuit Scrap now drops from 1/450+ auras")) return s;

  const marker = `const UPDATE_NOTES = [`;
  if (!s.includes(marker)) return s;

  return s.replace(
    marker,
    `const UPDATE_NOTES = [\n  "Balance hotfix: Circuit Scrap now drops from 1/450+ auras instead of 1/1k+, making early Core progression much easier for viewers.",`
  );
});

console.log("✅ Circuit Scrap 1/450+ drop balance patch complete.");
