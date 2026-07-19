#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const STAMP = Date.now();

const REGISTER = path.join(ROOT, "src/pages/api/discord-register.ts");
const INTERACTIONS = path.join(ROOT, "src/pages/api/discord-interactions.ts");
const BRIDGE = path.join(ROOT, "src/lib/discord-command-bridge.ts");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) {
    fail(`Missing ${path.relative(ROOT, file)}`);
  }
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  const backup = `${file}.bak.${STAMP}`;
  fs.copyFileSync(file, backup);
  console.log(`🧯 Backup: ${path.relative(ROOT, backup)}`);
  fs.writeFileSync(file, content, "utf8");
  console.log(`✅ Wrote ${path.relative(ROOT, file)}`);
}

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) {
    fail(`${label}: expected exactly one match, found ${count}.`);
  }
  return source.replace(search, replacement);
}

function replaceRegexOnce(source, regex, replacement, label) {
  const matches = source.match(regex);
  if (!matches) fail(`${label}: patch anchor not found.`);
  return source.replace(regex, replacement);
}

let register = read(REGISTER);
let interactions = read(INTERACTIONS);
let bridge = read(BRIDGE);

if (
  register.includes("const GLOBAL_COMMAND_CONTEXTS") &&
  bridge.includes("function globalLinkKey(") &&
  interactions.includes("DISCORD_ADMIN_GUILD_ONLY")
) {
  console.log("✅ Discord portability update is already installed.");
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* Registration: remove only duplicated /sols firsts                           */
/* -------------------------------------------------------------------------- */

const solsFirstsBlock = `    {
      type: SUBCOMMAND,
      name: "firsts",
      description:
        "View first aura or biome discoveries",
      options: [
        {
          type: STRING,
          name: "mode",
          description: "Discovery type",
          required: false,
          choices: [
            { name: "Auras", value: "auras" },
            { name: "Biomes", value: "biomes" },
            { name: "Latest", value: "latest" },
          ],
        },
      ],
    },
`;

register = replaceOnce(
  register,
  solsFirstsBlock,
  "",
  "Remove duplicated /sols firsts"
);

/* -------------------------------------------------------------------------- */
/* Registration: global + user-install contexts                                */
/* -------------------------------------------------------------------------- */

register = replaceOnce(
  register,
  `const USER = 6;

const categoryChoices = [`,
  `const USER = 6;

const GUILD_INSTALL = 0;
const USER_INSTALL = 1;
const GUILD_CONTEXT = 0;
const BOT_DM_CONTEXT = 1;
const PRIVATE_CHANNEL_CONTEXT = 2;

const GLOBAL_COMMAND_INTEGRATIONS = [
  GUILD_INSTALL,
  USER_INSTALL,
] as const;

const GLOBAL_COMMAND_CONTEXTS = [
  GUILD_CONTEXT,
  BOT_DM_CONTEXT,
  PRIVATE_CHANNEL_CONTEXT,
] as const;

const categoryChoices = [`,
  "Insert Discord installation/context constants"
);

register = replaceOnce(
  register,
  `  type: 1,
  options: [`,
  `  type: 1,
  integration_types: [...GLOBAL_COMMAND_INTEGRATIONS],
  contexts: [...GLOBAL_COMMAND_CONTEXTS],
  options: [`,
  "Make /sols portable"
);

register = replaceOnce(
  register,
  `    type: 1,
    options: [
      {
        type: STRING,
        name: "arguments",`,
  `    type: 1,
    integration_types: [...GLOBAL_COMMAND_INTEGRATIONS],
    contexts: [...GLOBAL_COMMAND_CONTEXTS],
    options: [
      {
        type: STRING,
        name: "arguments",`,
  "Make direct commands portable"
);

register = replaceOnce(
  register,
  `  const applicationId =
    process.env.DISCORD_APPLICATION_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!applicationId || !guildId || !botToken) {
    return text(
      res,
      "❌ Missing DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, or DISCORD_BOT_TOKEN in Vercel."
    );
  }`,
  `  const applicationId =
    process.env.DISCORD_APPLICATION_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!applicationId || !botToken) {
    return text(
      res,
      "❌ Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN in Vercel."
    );
  }`,
  "Allow registration without a required home guild"
);

register = replaceOnce(
  register,
  `      \`❌ Discord supports at most 100 guild commands; generated \${commands.length}.\``,
  `      \`❌ Discord supports at most 100 global chat commands; generated \${commands.length}.\``,
  "Clarify global command limit"
);

const registrationTailStart = `  const url =
    ` + "`https://discord.com/api/v10/applications/${applicationId}` +" + `
    ` + "`/guilds/${guildId}/commands`;";

const registrationTailIndex = register.indexOf(registrationTailStart);
if (registrationTailIndex < 0) {
  fail("Replace guild-only registration with global registration: start anchor not found.");
}

const registrationReplacement = `  const globalUrl =
    \`https://discord.com/api/v10/applications/\${applicationId}/commands\`;

  const headers = {
    Authorization: \`Bot \${botToken}\`,
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(globalUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(commands),
    });

    const body = await response.text();

    if (!response.ok) {
      const installHint =
        response.status === 400
          ? " In Discord Developer Portal → Installation, enable both User Install and Guild Install before registering."
          : "";

      return text(
        res,
        \`❌ Global Discord command registration failed: HTTP \${
          response.status
        } \${body.slice(0, 300)}\${installHint}\`
      );
    }

    let cleanupMessage = "";

    if (guildId) {
      const legacyGuildUrl =
        \`https://discord.com/api/v10/applications/\${applicationId}\` +
        \`/guilds/\${guildId}/commands\`;

      const cleanupResponse = await fetch(legacyGuildUrl, {
        method: "PUT",
        headers,
        body: "[]",
      });

      if (cleanupResponse.ok) {
        cleanupMessage =
          " Legacy guild-only commands were cleared.";
      } else {
        const cleanupBody = await cleanupResponse.text();
        cleanupMessage =
          \` Warning: global commands registered, but legacy guild cleanup returned HTTP \${cleanupResponse.status}: \${cleanupBody.slice(0, 120)}\`;
      }
    }

    return text(
      res,
      \`✅ Registered /sols plus \${TWITCH_COMMANDS.length} direct commands globally for Guild Install + User Install (\${commands.length} total).\${cleanupMessage}\`
    );
  } catch (error) {
    return text(
      res,
      \`❌ Global Discord command registration failed: \${
        error instanceof Error ? error.message : String(error)
      }\`
    );
  }
}`;

register =
  register.slice(0, registrationTailIndex) +
  registrationReplacement;

/* -------------------------------------------------------------------------- */
/* Interactions: remove unreachable duplicated /sols firsts handler             */
/* -------------------------------------------------------------------------- */

interactions = replaceOnce(
  interactions,
  `  formatDcAlerts,
  formatFirsts,
  formatRecords,`,
  `  formatDcAlerts,
  formatRecords,`,
  "Remove unused formatFirsts import"
);

const firstsHandler = `    if (current.name === "firsts") {
      return respond(
        res,
        await formatFirsts(
          channelId,
          optionValue(current.options, "mode", "auras")
        )
      );
    }

`;

interactions = replaceOnce(
  interactions,
  firstsHandler,
  "",
  "Remove duplicated /sols firsts handler"
);

/* -------------------------------------------------------------------------- */
/* Interactions: admin IDs work in other servers and user-install contexts      */
/* -------------------------------------------------------------------------- */

interactions = replaceOnce(
  interactions,
  `function isDiscordAdmin(interaction: DiscordInteraction): boolean {
  const user = getUser(interaction);
  if (!user || !adminIds().has(user.id)) return false;

  const configuredGuild = process.env.DISCORD_GUILD_ID;
  return !configuredGuild || interaction.guild_id === configuredGuild;
}`,
  `function isDiscordAdmin(interaction: DiscordInteraction): boolean {
  const user = getUser(interaction);
  if (!user || !adminIds().has(user.id)) return false;

  const guildOnly =
    (process.env.DISCORD_ADMIN_GUILD_ONLY ?? "false")
      .trim()
      .toLowerCase() === "true";

  if (!guildOnly) return true;

  const configuredGuild = process.env.DISCORD_GUILD_ID;
  return !configuredGuild || interaction.guild_id === configuredGuild;
}`,
  "Make configured Discord admins portable"
);

/* -------------------------------------------------------------------------- */
/* Bridge: one global Twitch link shared across servers, DMs and My Apps        */
/* -------------------------------------------------------------------------- */

bridge = replaceRegexOnce(
  bridge,
  /function guildScope\([\s\S]*?\nexport function formatDiscordTwitchLink\(/,
  `function scopedLinkKey(
  guildId: string | undefined | null,
  discordUserId: string
): string {
  const scope = String(guildId ?? "").trim() || "global";
  return \`discord:twitch-link:\${scope}:\${discordUserId}\`;
}

function globalLinkKey(discordUserId: string): string {
  return \`discord:twitch-link:global:\${discordUserId}\`;
}

function cleanDiscordId(raw: string): string {
  return raw.trim().replace(/[^0-9]/g, "");
}

function cleanTwitchId(raw: string): string {
  return raw.trim().replace(/[^0-9]/g, "");
}

function cleanTwitchUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function linkCandidateKeys(
  guildId: string | undefined | null,
  discordUserId: string
): string[] {
  const keys = [
    globalLinkKey(discordUserId),
    scopedLinkKey(guildId, discordUserId),
  ];

  const configuredGuild =
    String(process.env.DISCORD_GUILD_ID ?? "").trim();

  if (configuredGuild) {
    keys.push(scopedLinkKey(configuredGuild, discordUserId));
  }

  return [...new Set(keys)];
}

export async function getDiscordTwitchLink(
  guildId: string | undefined | null,
  discordUserId: string
): Promise<DiscordTwitchLink | null> {
  const r = getRedis();
  const cleanDiscord = cleanDiscordId(discordUserId);

  if (!r || !cleanDiscord) return null;

  const globalKey = globalLinkKey(cleanDiscord);

  for (const key of linkCandidateKeys(guildId, cleanDiscord)) {
    const link = await r.get<DiscordTwitchLink>(key);
    if (!link) continue;

    const portableLink: DiscordTwitchLink = {
      ...link,
      guildId: "global",
      discordUserId: cleanDiscord,
    };

    if (key !== globalKey) {
      await r.set(globalKey, portableLink);
    }

    return portableLink;
  }

  return null;
}

export async function setDiscordTwitchLink(input: {
  guildId?: string | null;
  discordUserId: string;
  twitchUserId: string;
  twitchUsername: string;
  twitchDisplayName?: string;
  linkedByDiscordUserId: string;
}): Promise<DiscordTwitchLink> {
  const r = getRedis();
  if (!r) throw new Error("Redis is not connected.");

  const discordUserId = cleanDiscordId(input.discordUserId);
  const twitchUserId = cleanTwitchId(input.twitchUserId);
  const twitchUsername = cleanTwitchUsername(input.twitchUsername);

  if (!discordUserId) throw new Error("Enter a valid Discord user.");
  if (!twitchUserId) throw new Error("Enter the numeric Twitch user ID.");
  if (!twitchUsername) throw new Error("Enter the Twitch username.");

  const link: DiscordTwitchLink = {
    guildId: "global",
    discordUserId,
    twitchUserId,
    twitchUsername,
    twitchDisplayName:
      input.twitchDisplayName?.trim() || input.twitchUsername.trim(),
    linkedAt: Date.now(),
    linkedByDiscordUserId: cleanDiscordId(
      input.linkedByDiscordUserId
    ),
  };

  await r.set(globalLinkKey(discordUserId), link);
  return link;
}

export async function removeDiscordTwitchLink(
  guildId: string | undefined | null,
  discordUserId: string
): Promise<boolean> {
  const r = getRedis();
  const cleanDiscord = cleanDiscordId(discordUserId);

  if (!r || !cleanDiscord) return false;

  const keys = linkCandidateKeys(guildId, cleanDiscord);
  let found = false;

  for (const key of keys) {
    if (await r.get<DiscordTwitchLink>(key)) {
      found = true;
    }
  }

  if (!found) return false;

  await r.del(...keys);
  return true;
}

export function formatDiscordTwitchLink(`,
  "Replace guild-scoped links with portable global links"
);

write(REGISTER, register);
write(INTERACTIONS, interactions);
write(BRIDGE, bridge);

console.log("");
console.log("✅ Discord portability cleanup installed.");
console.log("   • Kept /firsts; removed only /sols firsts");
console.log("   • Commands register globally for server and user installs");
console.log("   • Legacy guild-only commands are cleared on registration");
console.log("   • Discord admin IDs work outside the home guild");
console.log("   • Twitch links migrate to one global Discord-user link");
