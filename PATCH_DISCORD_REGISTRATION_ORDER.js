#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const FILE = path.join(ROOT, "src/pages/api/discord-register.ts");
const STAMP = Date.now();

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(FILE)) {
  fail("Missing src/pages/api/discord-register.ts");
}

let source = fs.readFileSync(FILE, "utf8");

if (
  source.includes('name: "twitch_username"') &&
  source.indexOf('name: "twitch_username"') <
    source.indexOf('name: "target"')
) {
  console.log("✅ /sols link required-option ordering is already fixed.");
  process.exit(0);
}

const oldBlock = `      options: [
        {
          type: USER,
          name: "target",
          description:
            "Discord user to link; defaults to yourself",
          required: false,
        },
        {
          type: STRING,
          name: "twitch_username",
          description: "Exact Twitch username",
          required: true,
        },
        {
          type: STRING,
          name: "twitch_user_id",
          description:
            "Numeric Twitch user ID shown by !ids",
          required: true,
        },
      ],`;

const newBlock = `      options: [
        {
          type: STRING,
          name: "twitch_username",
          description: "Exact Twitch username",
          required: true,
        },
        {
          type: STRING,
          name: "twitch_user_id",
          description:
            "Numeric Twitch user ID shown by !ids",
          required: true,
        },
        {
          type: USER,
          name: "target",
          description:
            "Discord user to link; defaults to yourself",
          required: false,
        },
      ],`;

const matches = source.split(oldBlock).length - 1;
if (matches !== 1) {
  fail(
    `Expected one /sols link option block, found ${matches}. ` +
      "The file may have changed."
  );
}

source = source.replace(oldBlock, newBlock);

const commandsAnchor = `  const commands = [
    solsCommand,
    ...TWITCH_COMMANDS.map(directCommand),
  ];

  if (commands.length > 100) {`;

const validatedCommands = `  const commands = [
    solsCommand,
    ...TWITCH_COMMANDS.map(directCommand),
  ];

  function validateRequiredOptionOrder(
    options: Array<Record<string, any>> | undefined,
    location: string
  ): string | null {
    if (!options) return null;

    let optionalSeen = false;

    for (const option of options) {
      const required = option.required === true;

      if (!required) optionalSeen = true;

      if (required && optionalSeen) {
        return \`\${location} > \${option.name}: required options must come before optional options.\`;
      }

      const nested = validateRequiredOptionOrder(
        option.options,
        \`\${location} > \${option.name}\`
      );

      if (nested) return nested;
    }

    return null;
  }

  for (const command of commands) {
    const schemaError = validateRequiredOptionOrder(
      command.options,
      \`/\${command.name}\`
    );

    if (schemaError) {
      return text(
        res,
        \`❌ Discord command schema invalid: \${schemaError}\`
      );
    }
  }

  if (commands.length > 100) {`;

const anchorMatches = source.split(commandsAnchor).length - 1;
if (anchorMatches !== 1) {
  fail(
    `Expected one Discord command-list anchor, found ${anchorMatches}.`
  );
}

source = source.replace(commandsAnchor, validatedCommands);

const backup = `${FILE}.bak.${STAMP}`;
fs.copyFileSync(FILE, backup);
console.log(`🧯 Backup: ${path.relative(ROOT, backup)}`);

fs.writeFileSync(FILE, source, "utf8");
console.log("✅ Wrote src/pages/api/discord-register.ts");
console.log("✅ Required Discord options now appear before optional ones.");
console.log("✅ Added recursive command-schema ordering validation.");
