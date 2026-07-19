import type { NextApiRequest, NextApiResponse } from "next";
import { text, verifyCron } from "@/lib/api-helpers";

const STRING = 3;
const INTEGER = 4;
const SUBCOMMAND = 1;

const command = {
  name: "sols",
  description: "Sol's RNG information, leaderboards, and safe administration",
  type: 1,
  options: [
    {
      type: SUBCOMMAND,
      name: "info",
      description: "Read Sol's RNG bot information",
      options: [
        {
          type: STRING,
          name: "topic",
          description: "commands, aura, biome, materials, components, tokens, boxes...",
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
      description: "Learn exactly how an item is obtained",
      options: [
        {
          type: STRING,
          name: "name",
          description: "Material, token, box, or component ID",
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
      description: "View the Twitch all-time leaderboard",
      options: [
        {
          type: STRING,
          name: "mode",
          description: "Leaderboard category",
          required: false,
          choices: [
            { name: "Rolls", value: "rolls" },
            { name: "Best aura", value: "best" },
            { name: "Best token/potion", value: "token" },
            { name: "Level", value: "level" },
            { name: "Total rarity value", value: "value" },
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
      description: "View first aura or biome discoveries",
      options: [
        {
          type: STRING,
          name: "mode",
          description: "Discovery type",
          required: false,
          choices: [
            { name: "Auras", value: "auras" },
            { name: "Biomes", value: "biomes" },
          ],
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "rollaccess",
      description: "Admin: manage the Twitch 10k-roll allowlist",
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
          description: "Twitch username for add/remove/check",
          required: false,
        },
      ],
    },
    {
      type: SUBCOMMAND,
      name: "alerts",
      description: "Admin: configure Discord webhook alerts",
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
            { name: "Set aura rarity", value: "aura" },
            { name: "Add biome", value: "biome-add" },
            { name: "Remove biome", value: "biome-remove" },
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.CRON_SECRET || !verifyCron(req)) {
    return text(res, "❌ Discord registration locked. Add ?token=YOUR_CRON_SECRET.");
  }

  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!applicationId || !guildId || !botToken) {
    return text(
      res,
      "❌ Missing DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, or DISCORD_BOT_TOKEN in Vercel."
    );
  }

  const url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([command]),
    });

    const body = await response.text();

    if (!response.ok) {
      return text(
        res,
        `❌ Discord command registration failed: HTTP ${response.status} ${body.slice(
          0,
          220
        )}`
      );
    }

    return text(
      res,
      "✅ Registered /sols guild commands: info, update, material, leaderboard, records, firsts, rollaccess, alerts."
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
