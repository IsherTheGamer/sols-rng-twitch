#!/usr/bin/env node
const fs = require("fs");

const file = "src/lib/core-system.ts";

if (!fs.existsSync(file)) {
  console.error("❌ Missing src/lib/core-system.ts. Run this from the repo root.");
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const original = s;

s = s.replace(
  `const SHD_CORE_REQUIREMENTS: Record<number, number> = {
  1: 10,`,
  `const SHD_CORE_REQUIREMENTS: Record<number, number> = {
  // Lv.1 must unlock at Core 9 because SHD Lv.0 capacity is 500,
  // while Core 10 costs 617 Stardust. Requiring Core 10 here softlocks progression.
  1: 9,`
);

if (s === original) {
  if (s.includes("1: 9,")) {
    console.log("✅ SHD Lv.1 already requires Core 9.");
  } else {
    console.error("❌ Could not find SHD_CORE_REQUIREMENTS block. Paste core-system.ts around SHD_CORE_REQUIREMENTS to ChatGPT.");
    process.exit(1);
  }
} else {
  fs.writeFileSync(file, s);
  console.log("✅ Fixed SHD softlock: SHD Lv.1 now requires Core 9 instead of Core 10.");
}

console.log("");
console.log("Progression after this fix:");
console.log("  Core 9 -> fill 500/500 Stardust -> !shd upgrade -> SHD Lv.1 cap 100,000 -> Core 10");
