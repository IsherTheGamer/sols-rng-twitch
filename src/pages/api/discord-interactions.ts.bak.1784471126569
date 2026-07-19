import type { NextApiRequest, NextApiResponse } from "next";
import { createPublicKey, verify as verifySignature } from "crypto";
import { waitUntil } from "@vercel/functions";
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
import {
  autocompleteTwitchCommands,
  executeTwitchCommand,
  formatDiscordTwitchLink,
  formatTwitchCommandCatalog,
  getDiscordTwitchLink,
  getTwitchCommand,
  removeDiscordTwitchLink,
  setDiscordTwitchLink,
  type DiscordBridgeUser,
} from "@/lib/discord-command-bridge";

interface DiscordOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordOption[];
  focused?: boolean;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
}

interface DiscordInteraction {
  id?: string;
  application_id?: string;
  token?: string;
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

function autocomplete(
  res: NextApiResponse,
  choices: Array<{ name: string; value: string }>
) {
  return res.status(200).json({
    type: 8,
    data: {
      choices: choices.slice(0, 25),
    },
  });
}

function defer(
  res: NextApiResponse,
  ephemeral = false
) {
  return res.status(200).json({
    type: 5,
    data: {
      flags: ephemeral ? 64 : undefined,
    },
  });
}

function getUser(interaction: DiscordInteraction): DiscordUser | null {
  return interaction.member?.user ?? interaction.user ?? null;
}

function bridgeUser(user: DiscordUser): DiscordBridgeUser {
  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name,
  };
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
  return value === undefined || value === null
    ? fallback
    : String(value);
}

function optionBoolean(
  options: DiscordOption[],
  name: string,
  fallback = false
): boolean {
  const value = options.find((option) => option.name === name)?.value;
  return typeof value === "boolean" ? value : fallback;
}

function focusedOption(
  options: DiscordOption[]
): DiscordOption | undefined {
  return options.find((option) => option.focused);
}

function discordAsNightbotUser(
  interaction: DiscordInteraction
): NightbotUser | null {
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
  const username = normalizeRollAccessName(
    optionValue(options, "username")
  );

  if (action === "list") {
    const entries = await getDynamicRollAllowlist(channelId);
    return `10k roll allowlist (${entries.length}): ${formatAllowlist(
      entries
    )}`;
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

    const result = await removeDynamicRollAccess({
      channelId,
      username,
    });

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

async function handleAlerts(
  options: DiscordOption[]
): Promise<string> {
  const channelId = process.env.DEFAULT_CHANNEL_ID ?? "904797805";
  const channelName =
    process.env.DEFAULT_CHANNEL_NAME ?? "zipittt";
  const action = optionValue(options, "action", "status").toLowerCase();
  const value = optionValue(options, "value").trim();

  let query = action;

  if (action === "status") query = "";
  if (action === "aura") query = `aura ${value || "100m"}`;
  if (action === "biome-add") query = `biome ${value} on`;
  if (action === "biome-remove") query = `biome ${value} off`;

  return formatDcAlerts(channelId, channelName, query, true);
}

async function editOriginalResponse(
  interaction: DiscordInteraction,
  content: string
): Promise<void> {
  const applicationId =
    interaction.application_id ??
    process.env.DISCORD_APPLICATION_ID ??
    "";
  const token = interaction.token ?? "";

  if (!applicationId || !token) return;

  const url =
    `https://discord.com/api/v10/webhooks/${applicationId}/${token}` +
    "/messages/@original";

  const body = JSON.stringify({
    content: clean(content),
    allowed_mentions: { parse: [] },
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, 300 * attempt)
      );
    }

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (response.ok) return;
    if (response.status !== 404) return;
  }
}

function deferTwitchCommand(
  req: NextApiRequest,
  res: NextApiResponse,
  interaction: DiscordInteraction,
  commandText: string,
  argumentsText: string,
  ephemeral: boolean
) {
  const user = getUser(interaction);

  if (!user) {
    return respond(res, "Discord user information is missing.", true);
  }

  const task = (async () => {
    const content = await executeTwitchCommand({
      req,
      guildId: interaction.guild_id,
      discordUser: bridgeUser(user),
      commandText,
      argumentsText,
      isAdmin: isDiscordAdmin(interaction),
    });

    // Give Discord a moment to create the deferred original message.
    await new Promise((resolve) => setTimeout(resolve, 250));
    await editOriginalResponse(interaction, content);
  })().catch(async (error) => {
    await editOriginalResponse(
      interaction,
      `❌ Discord bridge failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  });

  waitUntil(task);
  return defer(res, ephemeral);
}

async function handleLink(
  interaction: DiscordInteraction,
  options: DiscordOption[]
): Promise<string> {
  if (!isDiscordAdmin(interaction)) {
    return "❌ Only configured Discord admins can link Twitch saves.";
  }

  const invoker = getUser(interaction);
  if (!invoker) return "Discord user information is missing.";

  const targetId =
    optionValue(options, "target") || invoker.id;
  const twitchUsername = optionValue(
    options,
    "twitch_username"
  );
  const twitchUserId = optionValue(options, "twitch_user_id");

  const link = await setDiscordTwitchLink({
    guildId: interaction.guild_id,
    discordUserId: targetId,
    twitchUsername,
    twitchUserId,
    twitchDisplayName: twitchUsername,
    linkedByDiscordUserId: invoker.id,
  });

  return `✅ Linked <@${targetId}> to Twitch @${link.twitchUsername} (ID ${link.twitchUserId}). Discord and Twitch now use the same save.`;
}

async function handleUnlink(
  interaction: DiscordInteraction,
  options: DiscordOption[]
): Promise<string> {
  if (!isDiscordAdmin(interaction)) {
    return "❌ Only configured Discord admins can unlink Twitch saves.";
  }

  const invoker = getUser(interaction);
  if (!invoker) return "Discord user information is missing.";

  const targetId =
    optionValue(options, "target") || invoker.id;
  const removed = await removeDiscordTwitchLink(
    interaction.guild_id,
    targetId
  );

  return removed
    ? `✅ Removed the Twitch link for <@${targetId}>.`
    : `<@${targetId}> did not have a Twitch link.`;
}

async function handleWhoAmI(
  interaction: DiscordInteraction,
  options: DiscordOption[]
): Promise<string> {
  const invoker = getUser(interaction);
  if (!invoker) return "Discord user information is missing.";

  const targetId =
    optionValue(options, "target") || invoker.id;

  if (
    targetId !== invoker.id &&
    !isDiscordAdmin(interaction)
  ) {
    return "❌ Only Discord admins can inspect another user's link.";
  }

  const link = await getDiscordTwitchLink(
    interaction.guild_id,
    targetId
  );

  return formatDiscordTwitchLink(link, targetId);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const rawBody = await readRawBody(req);
  const signature = firstHeader(
    req.headers["x-signature-ed25519"]
  );
  const timestamp = firstHeader(
    req.headers["x-signature-timestamp"]
  );

  if (!verifyDiscordRequest(rawBody, signature, timestamp)) {
    return res.status(401).send("Invalid request signature");
  }

  let interaction: DiscordInteraction;

  try {
    interaction = JSON.parse(
      rawBody.toString("utf8")
    ) as DiscordInteraction;
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  if (interaction.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  if (interaction.type === 4) {
    if (interaction.data?.name !== "sols") {
      return autocomplete(res, []);
    }

    const current = subcommand(interaction);

    if (current.name === "run") {
      const focused = focusedOption(current.options);

      if (focused?.name === "command") {
        return autocomplete(
          res,
          autocompleteTwitchCommands(String(focused.value ?? ""))
        );
      }
    }

    return autocomplete(res, []);
  }

  if (interaction.type !== 2) {
    return respond(res, "Unsupported interaction.", true);
  }

  const directCommand = getTwitchCommand(
    interaction.data?.name
  );

  if (directCommand) {
    const options = interaction.data?.options ?? [];

    return deferTwitchCommand(
      req,
      res,
      interaction,
      directCommand.name,
      optionValue(options, "arguments"),
      optionBoolean(options, "private", false)
    );
  }

  if (interaction.data?.name !== "sols") {
    return respond(res, "Unsupported command.", true);
  }

  const current = subcommand(interaction);
  const channelId =
    process.env.DEFAULT_CHANNEL_ID ?? "904797805";

  try {
    if (current.name === "run") {
      return deferTwitchCommand(
        req,
        res,
        interaction,
        optionValue(current.options, "command"),
        optionValue(current.options, "arguments"),
        optionBoolean(current.options, "private", false)
      );
    }

    if (current.name === "commands") {
      return respond(
        res,
        formatTwitchCommandCatalog(
          optionValue(current.options, "search"),
          optionValue(current.options, "page", "1"),
          optionValue(current.options, "category", "all")
        ),
        optionBoolean(current.options, "private", true)
      );
    }

    if (current.name === "link") {
      return respond(
        res,
        await handleLink(interaction, current.options),
        true
      );
    }

    if (current.name === "unlink") {
      return respond(
        res,
        await handleUnlink(interaction, current.options),
        true
      );
    }

    if (current.name === "whoami") {
      return respond(
        res,
        await handleWhoAmI(interaction, current.options),
        true
      );
    }

    if (current.name === "info") {
      const topic = optionValue(
        current.options,
        "topic",
        "help"
      );
      const query = optionValue(current.options, "query");
      const page = optionValue(current.options, "page");

      return respond(
        res,
        formatSolInfo(
          [topic, query, page].filter(Boolean).join(" ")
        )
      );
    }

    if (current.name === "update") {
      return respond(
        res,
        formatUpdateNotes(
          optionValue(current.options, "page", "1")
        )
      );
    }

    if (current.name === "material") {
      const name = optionValue(current.options, "name");
      const page = optionValue(
        current.options,
        "page",
        "1"
      );

      return respond(res, formatObtainGuide(name, page));
    }

    if (current.name === "leaderboard") {
      const mode = optionValue(
        current.options,
        "mode",
        "rolls"
      );
      const page = optionValue(
        current.options,
        "page",
        "1"
      );

      return respond(
        res,
        await formatLeaderboard(channelId, `${mode} ${page}`)
      );
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

      return respond(
        res,
        await handleAlerts(current.options),
        true
      );
    }

    return respond(
      res,
      "Unknown /sols subcommand.",
      true
    );
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
