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

/* ============================================================
   Core crafting rebalance: add Mechanical Scrap
   - Pure roll-only material
   - 1 guaranteed every 5 successful aura rolls
   - Not added to market/sale systems
   - Used as a lower-tier crafting limiter
============================================================ */
patchFile("src/lib/core-system.ts", (s) => {
  if (!s.includes(`mechanical_scrap: "Mechanical Scrap"`)) {
    s = s.replace(
      `  metal_bits: "Metal Bits",\n  circuit_scrap: "Circuit Scrap",`,
      `  metal_bits: "Metal Bits",\n  mechanical_scrap: "Mechanical Scrap",\n  circuit_scrap: "Circuit Scrap",`
    );
  }

  if (!s.includes("const MECHANICAL_SCRAP_ROLL_INTERVAL")) {
    s = s.replace(
      `const GLOBAL_QUEST_COMPLETIONS_KEY = "mega:gquest-completions";`,
      `const GLOBAL_QUEST_COMPLETIONS_KEY = "mega:gquest-completions";\n\nconst MECHANICAL_SCRAP_ROLL_INTERVAL = 5;`
    );
  }

  if (!s.includes("function addGuaranteedRollScrap")) {
    const marker = `function addMaterialDrops(\n  state: CoreSystemState,`;
    const helper = `function addGuaranteedRollScrap(state: CoreSystemState): void {\n  if (state.stats.totalRollsTracked <= 0) return;\n  if (state.stats.totalRollsTracked % MECHANICAL_SCRAP_ROLL_INTERVAL !== 0) return;\n\n  // Pure roll-only limiter material. Do not route this through shops, sales, or rarity drops.\n  addToBag(state.materials, "mechanical_scrap", 1);\n  state.stats.materialsCollected += 1;\n}\n\n`;
    if (!s.includes(marker)) {
      console.error("❌ Could not find addMaterialDrops marker.");
      process.exit(1);
    }
    s = s.replace(marker, helper + marker);
  }

  if (!s.includes("addGuaranteedRollScrap(state);")) {
    const old = `    state.stats.totalRollsTracked += 1;\n    state.stats.highestRarity = Math.max(state.stats.highestRarity, roll.effectiveRarity);`;
    const next = `    state.stats.totalRollsTracked += 1;\n    addGuaranteedRollScrap(state);\n    state.stats.highestRarity = Math.max(state.stats.highestRarity, roll.effectiveRarity);`;
    if (!s.includes(old)) {
      console.error("❌ Could not find totalRollsTracked increment block.");
      process.exit(1);
    }
    s = s.replace(old, next);
  }

  if (!s.includes("materialCosts.mechanical_scrap")) {
    const old = `      const materialCosts: Record<string, number> = {\n        scrap: Math.ceil(baseScale * tier * 6),\n        metal_bits: Math.ceil(baseScale * tier * 2),\n      };`;
    const next = `      const materialCosts: Record<string, number> = {\n        scrap: Math.ceil(baseScale * tier * 6),\n        metal_bits: Math.ceil(baseScale * tier * 2),\n      };\n\n      if (tier <= 2) {\n        // Mechanical Scrap is the low-tier roll-only limiter so Scrap/Metal Bits do not make early crafting infinite.\n        materialCosts.mechanical_scrap = Math.max(1, Math.ceil(baseScale * (tier === 1 ? 0.75 : 1.25)));\n      }`;
    if (!s.includes(old)) {
      console.error("❌ Could not find component material cost block.");
      process.exit(1);
    }
    s = s.replace(old, next);
  }

  if (!s.includes("mechanical_scrap: Math.max(2, Math.ceil(tier * 2))")) {
    s = s.replace(
      `      scrap: 35 * scale,\n      metal_bits: 8 * scale,\n      circuit_scrap: tier >= 8 ? 5 * scale : 0,`,
      `      scrap: 35 * scale,\n      metal_bits: 8 * scale,\n      mechanical_scrap: Math.max(2, Math.ceil(tier * 2)),\n      circuit_scrap: tier >= 8 ? 5 * scale : 0,`
    );
  }

  if (!s.includes("mechanical_scrap: Math.max(3, Math.ceil(tier * 3))")) {
    s = s.replace(
      `    materials: {\n      circuit_scrap: Math.max(5, tier * 5),\n    },`,
      `    materials: {\n      mechanical_scrap: Math.max(3, Math.ceil(tier * 3)),\n      circuit_scrap: Math.max(5, tier * 5),\n    },`
    );
  }

  return s;
});

/* Crafting guide mirrors the new recipe math and source text. */
patchFile("src/pages/crafting.tsx", (s) => {
  if (!s.includes(`mechanical_scrap: "Mechanical Scrap"`)) {
    s = s.replace(
      `  metal_bits: "Metal Bits",\n  circuit_scrap: "Circuit Scrap",`,
      `  metal_bits: "Metal Bits",\n  mechanical_scrap: "Mechanical Scrap",\n  circuit_scrap: "Circuit Scrap",`
    );
  }

  if (!s.includes(`["Mechanical Scrap", "Pure roll-only: every 5 successful aura rolls gives 1. Not sold in shops/markets."]`)) {
    s = s.replace(
      `  ["Metal Bits", "Every roll gives Metal Bits."],\n  ["Circuit Scrap", "Roll 1/450+ auras; also quests/boxes."],`,
      `  ["Metal Bits", "Every roll gives Metal Bits."],\n  ["Mechanical Scrap", "Pure roll-only: every 5 successful aura rolls gives 1. Not sold in shops/markets."],\n  ["Circuit Scrap", "Roll 1/450+ auras; also quests/boxes."],`
    );
  }

  if (!s.includes("materials.mechanical_scrap")) {
    const old = `  const materials: Record<string, number> = {\n    scrap: Math.ceil(baseScale * tier * 6),\n    metal_bits: Math.ceil(baseScale * tier * 2),\n  };`;
    const next = `  const materials: Record<string, number> = {\n    scrap: Math.ceil(baseScale * tier * 6),\n    metal_bits: Math.ceil(baseScale * tier * 2),\n  };\n\n  if (tier <= 2) {\n    materials.mechanical_scrap = Math.max(1, Math.ceil(baseScale * (tier === 1 ? 0.75 : 1.25)));\n  }`;
    if (!s.includes(old)) {
      console.warn("⚠️ Could not find crafting page recipe material block, skipped recipe display patch.");
    } else {
      s = s.replace(old, next);
    }
  }

  if (!s.includes(`["Mechanical Scrap", "1 every 5 successful aura rolls; pure roll-only limiter"]`)) {
    s = s.replace(
      `["Global quests", "+0.1% material multiplier every 100 daily/weekly global quests"],`,
      `["Global quests", "+0.1% material multiplier every 100 daily/weekly global quests"],\n            ["Mechanical Scrap", "1 every 5 successful aura rolls; pure roll-only limiter"],`
    );
  }

  return s;
});

/* Info/help text if present. */
patchFile("src/lib/sol-info.ts", (s) => {
  if (s.includes("Mechanical Scrap")) return s;
  return s.replace(
    `"Scrap", "Metal Bits", "Circuit Scrap", "Signal Fragment",`,
    `"Scrap", "Metal Bits", "Mechanical Scrap", "Circuit Scrap", "Signal Fragment",`
  );
});

/* Update notes. */
patchFile("src/lib/social-system.ts", (s) => {
  if (s.includes("Mechanical Scrap added as a pure roll-only crafting limiter")) return s;
  const marker = `const UPDATE_NOTES = [`;
  if (!s.includes(marker)) return s;
  return s.replace(
    marker,
    `const UPDATE_NOTES = [\n  "Crafting rebalance: Mechanical Scrap added as a pure roll-only crafting limiter. You get 1 every 5 successful aura rolls, and it is not sold in shops/markets.",`
  );
});

console.log("✅ Mechanical Scrap crafting rebalance patch complete.");
