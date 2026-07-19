import type { NextApiRequest, NextApiResponse } from "next";
import { text, verifyCron } from "@/lib/api-helpers";
import {
  TWITCH_COMMANDS,
  type TwitchCommandDefinition,
} from "@/lib/discord-command-bridge";

const SUBCOMMAND = 1;
const STRING = 3;
const INTEGER = 4;
const BOOLEAN = 5;
const USER = 6;

const categoryChoices = [
  { name: "All commands", value: "all" },
  { name: "Progression", value: "progression" },
  { name: "RNG and rolling", value: "rng" },
  { name: "Activity systems", value: "activity" },
  { name: "Social and leaderboards", value: "social" },
  { name: "Information", value: "information" },
  { name: "Admin", value: "admin" },
];

const solsCommand = {
  name: "sols",
  description:
    "Sol's RNG command center, Twitch linking and administration",
  type: 1,
  options: [
    {
      type: SUBCOMMAND,
      name: "run",
      description:
        "Run any Twitch command with typo/fuzzy command matching",
      options: [
        {
          type: STRING,
          name: "command",
          description:
            "Twitch command name, such as roll, craft, core or market",
          required: true,
          autocomplete: true,
        },
        {
          type: STRING,
          name: "arguments",
          description:
            "Everything that would appear after !command on Twitch",
          required: false,
        },
        {
          type: BOOLEAN,
          name: "private",
          description:
            "Show the result only to you",
          required: false,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "commands",
      description:
        "Search and browse every integrated Twitch command",
      options: [
        {
          type: STRING,
          name: "search",
          description:
            "Optional command, alias, description or category search",
          required: false,
        },
        {
          type: STRING,
          name: "category",
          description: "Command category",
          required: false,
          choices: categoryChoices,
        },
        {
          type: INTEGER,
          name: "page",
          description: "Page number",
          required: false,
          min_value: 1,
        },
        {
          type: BOOLEAN,
          name: "private",
          description:
            "Show the command list only to you",
          required: false,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "link",
      description:
        "Admin: link a Discord account to its Twitch save",
      options: [
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
      ],
    },
    {
      type: SUBCOMMAND,
      name: "unlink",
      description:
        "Admin: remove a Discord-to-Twitch save link",
      options: [
        {
          type: USER,
          name: "target",
          description:
            "Discord user to unlink; defaults to yourself",
          required: false,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "whoami",
      description:
        "Show which Twitch save a Discord user is linked to",
      options: [
        {
          type: USER,
          name: "target",
          description:
            "Admin-only when checking another user",
          required: false,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "info",
      description: "Read Sol's RNG bot information",
      options: [
        {
          type: STRING,
          name: "topic",
          description:
            "commands, aura, biome, materials, components, tokens, boxes...",
          required: false,
        },
        {
          type: STRING,
          name: "query",
          description: "Name or search value",
          required: false,
        },
        {
          type: INTEGER,
          name: "page",
          description: "Page number",
          required: false,
          min_value: 1,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "update",
      description: "View bot update notes",
      options: [
        {
          type: INTEGER,
          name: "page",
          description: "Update page",
          required: false,
          min_value: 1,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "material",
      description:
        "Learn exactly how an item is obtained",
      options: [
        {
          type: STRING,
          name: "name",
          description:
            "Material, token, box, or component ID",
          required: false,
        },
        {
          type: INTEGER,
          name: "page",
          description: "Page number",
          required: false,
          min_value: 1,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "leaderboard",
      description:
        "View the Twitch all-time leaderboard",
      options: [
        {
          type: STRING,
          name: "mode",
          description: "Leaderboard category",
          required: false,
          choices: [
            { name: "Rolls", value: "rolls" },
            { name: "Best aura", value: "best" },
            {
              name: "Best token/potion",
              value: "token",
            },
            { name: "Level", value: "level" },
            {
              name: "Total rarity value",
              value: "value",
            },
          ],
        },
        {
          type: INTEGER,
          name: "page",
          description: "Page number",
          required: false,
          min_value: 1,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "records",
      description: "View channel records",
    },
    {
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
    {
      type: SUBCOMMAND,
      name: "rollaccess",
      description:
        "Admin: manage the Twitch 10k-roll allowlist",
      options: [
        {
          type: STRING,
          name: "action",
          description: "Action",
          required: true,
          choices: [
            { name: "List", value: "list" },
            { name: "Add", value: "add" },
            { name: "Remove", value: "remove" },
            { name: "Check", value: "check" },
            { name: "Clear", value: "clear" },
          ],
        },
        {
          type: STRING,
          name: "username",
          description:
            "Twitch username for add/remove/check",
          required: false,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "alerts",
      description:
        "Admin: configure Discord webhook alerts",
      options: [
        {
          type: STRING,
          name: "action",
          description: "Alert action",
          required: true,
          choices: [
            { name: "Status", value: "status" },
            { name: "Turn on", value: "on" },
            { name: "Turn off", value: "off" },
            { name: "Send test", value: "test" },
            {
              name: "Set aura rarity",
              value: "aura",
            },
            {
              name: "Add biome",
              value: "biome-add",
            },
            {
              name: "Remove biome",
              value: "biome-remove",
            },
          ],
        },
        {
          type: STRING,
          name: "value",
          description: "Rarity or biome ID",
          required: false,
        },
      ],
    },
  ],
};

function directCommand(
  definition: TwitchCommandDefinition
) {
  return {
    name: definition.name,
    description: `Twitch !${definition.name}: ${definition.description}`.slice(
      0,
      100
    ),
    type: 1,
    options: [
      {
        type: STRING,
        name: "arguments",
        description:
          `Everything after !${definition.name} on Twitch`.slice(
            0,
            100
          ),
        required: false,
      },
      {
        type: BOOLEAN,
        name: "private",
        description:
          "Show the result only to you",
        required: false,
      },
    ],
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!process.env.CRON_SECRET || !verifyCron(req)) {
    return text(
      res,
      "❌ Discord registration locked. Send CRON_SECRET as a Bearer token or ?token=."
    );
  }

  const applicationId =
    process.env.DISCORD_APPLICATION_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!applicationId || !guildId || !botToken) {
    return text(
      res,
      "❌ Missing DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, or DISCORD_BOT_TOKEN in Vercel."
    );
  }

  const commands = [
    solsCommand,
    ...TWITCH_COMMANDS.map(directCommand),
  ];

  if (commands.length > 100) {
    return text(
      res,
      `❌ Discord supports at most 100 guild commands; generated ${commands.length}.`
    );
  }

  const url =
    `https://discord.com/api/v10/applications/${applicationId}` +
    `/guilds/${guildId}/commands`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    const body = await response.text();

    if (!response.ok) {
      return text(
        res,
        `❌ Discord command registration failed: HTTP ${
          response.status
        } ${body.slice(0, 220)}`
      );
    }

    return text(
      res,
      `✅ Registered /sols plus ${TWITCH_COMMANDS.length} direct Twitch commands (${commands.length} total).`
    );
  } catch (error) {
    return text(
      res,
      `❌ Discord command registration failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
