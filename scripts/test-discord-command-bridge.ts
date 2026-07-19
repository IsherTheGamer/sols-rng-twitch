import assert from "node:assert/strict";
import {
  TWITCH_COMMANDS,
  autocompleteTwitchCommands,
  formatTwitchCommandCatalog,
  getTwitchCommand,
  resolveTwitchCommand,
} from "../src/lib/discord-command-bridge";

const names = TWITCH_COMMANDS.map((entry) => entry.name);

assert.ok(
  TWITCH_COMMANDS.length >= 60,
  `Expected at least 60 commands, found ${TWITCH_COMMANDS.length}`
);
assert.equal(new Set(names).size, names.length, "Command names must be unique");
assert.ok(
  names.every((name) => /^[-_a-z0-9]{1,32}$/.test(name)),
  "Every command must be a valid Discord slash-command name"
);
assert.equal(getTwitchCommand("craft")?.endpoint, "craft");
assert.equal(resolveTwitchCommand("craf").command?.name, "craft");
assert.equal(resolveTwitchCommand("!black-market").command?.name, "blackmarket");
assert.ok(
  autocompleteTwitchCommands("cor").some(
    (entry) => entry.value === "core"
  )
);
assert.match(
  formatTwitchCommandCatalog("roll", "1", "all"),
  /\/roll/
);
assert.ok(
  TWITCH_COMMANDS.filter((entry) => entry.adminOnly).every(
    (entry) => entry.requiresLink === false
  ),
  "Admin-only channel commands should not require a player link"
);

console.log(
  `✅ Discord bridge registry test passed: ${TWITCH_COMMANDS.length} Twitch commands.`
);
