import type { NextApiRequest, NextApiResponse } from "next";
import { createPublicKey, verify as verifySignature } from "crypto";
import type { NightbotUser } from "@/lib/nightbot";
import { formatSolInfo } from "@/lib/sol-info";
import { formatUpdateNotes } from "@/lib/update-notes";
import { formatObtainGuide } from "@/lib/progression-info";
import { formatLeaderboard } from "@/lib/social-system";
import {
  formatDcAlerts,
  formatFirsts,
  formatRecords,
} from "@/lib/mega-feature-system";
import {
  addDynamicRollAccess,
  clearDynamicRollAccess,
  getDynamicRollAllowlist,
  normalizeRollAccessName,
  removeDynamicRollAccess,
} from "@/lib/roll-access";

interface DiscordOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordOption[];
}

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
}

interface DiscordInteraction {
  type: number;
  guild_id?: string;
  member?: { user?: DiscordUser };
  user?: DiscordUser;
  data?: {
    name?: string;
    options?: DiscordOption[];
  };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function verifyDiscordRequest(
  rawBody: Buffer,
  signature: string,
  timestamp: string
): boolean {
  const rawPublicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!rawPublicKey || !signature || !timestamp) return false;

  try {
    const publicKeyBytes = Buffer.from(rawPublicKey, "hex");
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = createPublicKey({
      key: Buffer.concat([spkiPrefix, publicKeyBytes]),
      format: "der",
      type: "spki",
    });

    const message = Buffer.concat([Buffer.from(timestamp), rawBody]);

    return verifySignature(
      null,
      message,
      publicKey,
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

function clean(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 1900);
}

function respond(
  res: NextApiResponse,
  content: string,
  ephemeral = false
) {
  return res.status(200).json({
    type: 4,
    data: {
      content: clean(content),
      flags: ephemeral ? 64 : undefined,
      allowed_mentions: { parse: [] },
    },
  });
}

function getUser(interaction: DiscordInteraction): DiscordUser | null {
  return interaction.member?.user ?? interaction.user ?? null;
}

function adminIds(): Set<string> {
  return new Set(
    (process.env.DISCORD_ADMIN_USER_IDS ?? "")
      .split(/[,\s]+/)
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

function isDiscordAdmin(interaction: DiscordInteraction): boolean {
  const user = getUser(interaction);
  if (!user || !adminIds().has(user.id)) return false;

  const configuredGuild = process.env.DISCORD_GUILD_ID;
  return !configuredGuild || interaction.guild_id === configuredGuild;
}

function subcommand(interaction: DiscordInteraction): {
  name: string;
  options: DiscordOption[];
} {
  const option = interaction.data?.options?.[0];
  return {
    name: option?.name ?? "info",
    options: option?.options ?? [],
  };
}

function optionValue(
  options: DiscordOption[],
  name: string,
  fallback = ""
): string {
  const value = options.find((option) => option.name === name)?.value;
  return value === undefined || value === null ? fallback : String(value);
}

function discordAsNightbotUser(interaction: DiscordInteraction): NightbotUser | null {
  const user = getUser(interaction);
  if (!user) return null;

  return {
    provider: "discord",
    providerId: user.id,
    name: user.username,
    displayName: user.global_name ?? user.username,
    userLevel: "admin",
  };
}

function formatAllowlist(entries: Array<{ username: string }>): string {
  if (entries.length === 0) return "none";
  return entries
    .slice(0, 30)
    .map((entry) => entry.username)
    .join(", ");
}

async function handleRollAccess(
  interaction: DiscordInteraction,
  options: DiscordOption[]
): Promise<string> {
  const channelId = process.env.DEFAULT_CHANNEL_ID ?? "904797805";
  const action = optionValue(options, "action", "list").toLowerCase();
  const username = normalizeRollAccessName(optionValue(options, "username"));

  if (action === "list") {
    const entries = await getDynamicRollAllowlist(channelId);
    return `10k roll allowlist (${entries.length}): ${formatAllowlist(entries)}`;
  }

  if (action === "add") {
    if (!username) return "Enter a Twitch username.";
    const result = await addDynamicRollAccess({
      channelId,
      username,
      addedBy: discordAsNightbotUser(interaction),
    });

    return result.added
      ? `✅ Added ${username} to the Twitch 10k-roll allowlist.`
      : `${username} already has dynamic 10k access.`;
  }

  if (action === "remove") {
    if (!username) return "Enter a Twitch username.";
    const result = await removeDynamicRollAccess({ channelId, username });
    return result.removed
      ? `✅ Removed ${username} from the Twitch 10k-roll allowlist.`
      : `${username} was not in the dynamic allowlist.`;
  }

  if (action === "check") {
    if (!username) return "Enter a Twitch username.";
    const entries = await getDynamicRollAllowlist(channelId);
    return entries.some((entry) => entry.username === username)
      ? `✅ ${username} is in the dynamic 10k-roll allowlist.`
      : `${username} is not in the dynamic allowlist.`;
  }

  if (action === "clear") {
    const removed = await clearDynamicRollAccess(channelId);
    return `✅ Cleared ${removed} dynamic roll-access entries.`;
  }

  return "Unknown rollaccess action.";
}

async function handleAlerts(options: DiscordOption[]): Promise<string> {
  const channelId = process.env.DEFAULT_CHANNEL_ID ?? "904797805";
  const channelName = process.env.DEFAULT_CHANNEL_NAME ?? "zipittt";
  const action = optionValue(options, "action", "status").toLowerCase();
  const value = optionValue(options, "value").trim();

  let query = action;

  if (action === "status") query = "";
  if (action === "aura") query = `aura ${value || "100m"}`;
  if (action === "biome-add") query = `biome ${value} on`;
  if (action === "biome-remove") query = `biome ${value} off`;

  return formatDcAlerts(channelId, channelName, query, true);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const rawBody = await readRawBody(req);
  const signature = firstHeader(req.headers["x-signature-ed25519"]);
  const timestamp = firstHeader(req.headers["x-signature-timestamp"]);

  if (!verifyDiscordRequest(rawBody, signature, timestamp)) {
    return res.status(401).send("Invalid request signature");
  }

  let interaction: DiscordInteraction;

  try {
    interaction = JSON.parse(rawBody.toString("utf8")) as DiscordInteraction;
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  if (interaction.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  if (interaction.type !== 2 || interaction.data?.name !== "sols") {
    return respond(res, "Unsupported interaction.", true);
  }

  const current = subcommand(interaction);
  const channelId = process.env.DEFAULT_CHANNEL_ID ?? "904797805";

  try {
    if (current.name === "info") {
      const topic = optionValue(current.options, "topic", "help");
      const query = optionValue(current.options, "query");
      const page = optionValue(current.options, "page");
      return respond(
        res,
        formatSolInfo([topic, query, page].filter(Boolean).join(" "))
      );
    }

    if (current.name === "update") {
      return respond(
        res,
        formatUpdateNotes(optionValue(current.options, "page", "1"))
      );
    }

    if (current.name === "material") {
      const name = optionValue(current.options, "name");
      const page = optionValue(current.options, "page", "1");
      return respond(res, formatObtainGuide(name, page));
    }

    if (current.name === "leaderboard") {
      const mode = optionValue(current.options, "mode", "rolls");
      const page = optionValue(current.options, "page", "1");
      return respond(res, await formatLeaderboard(channelId, `${mode} ${page}`));
    }

    if (current.name === "records") {
      return respond(res, await formatRecords(channelId));
    }

    if (current.name === "firsts") {
      return respond(
        res,
        await formatFirsts(
          channelId,
          optionValue(current.options, "mode", "auras")
        )
      );
    }

    if (current.name === "rollaccess") {
      if (!isDiscordAdmin(interaction)) {
        return respond(
          res,
          "❌ Discord admin command locked. Add your Discord user ID to DISCORD_ADMIN_USER_IDS.",
          true
        );
      }

      return respond(
        res,
        await handleRollAccess(interaction, current.options),
        true
      );
    }

    if (current.name === "alerts") {
      if (!isDiscordAdmin(interaction)) {
        return respond(
          res,
          "❌ Discord admin command locked. Add your Discord user ID to DISCORD_ADMIN_USER_IDS.",
          true
        );
      }

      return respond(res, await handleAlerts(current.options), true);
    }

    return respond(res, "Unknown /sols subcommand.", true);
  } catch (error) {
    return respond(
      res,
      `❌ Command failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      true
    );
  }
}
