#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const FILE = path.join(ROOT, "src/lib/discord-command-bridge.ts");
const STAMP = Date.now();

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(FILE)) {
  fail("Missing src/lib/discord-command-bridge.ts");
}

let source = fs.readFileSync(FILE, "utf8");

const fixedBlock = `  if (split.argumentsText) {
    url.searchParams.set("query", split.argumentsText);
    url.searchParams.set("args", split.argumentsText);
  }`;

if (source.includes(fixedBlock)) {
  console.log("✅ Discord command arguments already populate both query and args.");
  process.exit(0);
}

const oldBlock = `  if (split.argumentsText) {
    url.searchParams.set("query", split.argumentsText);
  }`;

const matches = source.split(oldBlock).length - 1;

if (matches !== 1) {
  fail(
    `Expected one Discord argument-forwarding block, found ${matches}. ` +
      "The bridge file may have changed."
  );
}

source = source.replace(oldBlock, fixedBlock);

const backup = `${FILE}.bak.${STAMP}`;
fs.copyFileSync(FILE, backup);
console.log(`🧯 Backup: ${path.relative(ROOT, backup)}`);

fs.writeFileSync(FILE, source, "utf8");
console.log("✅ Wrote src/lib/discord-command-bridge.ts");
console.log("✅ Discord now sends arguments through both ?query= and ?args=.");
console.log("✅ /roll arguments:50 can now reach the Twitch roll parser.");
