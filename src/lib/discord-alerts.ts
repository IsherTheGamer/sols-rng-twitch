import type { AuraDef } from "../types/data";
import { formatRarity } from "./format";
import { formatRemaining } from "./state";

const DEFAULT_RARE_BIOMES = [
  "glitched",
  "dreamspace",
  "singularity",
  "cyberspace",
  "aurora",
  "graveyard",
  "pumpkin_moon",
  "blazing_sun",
  "abnormality",
  "blood_rain",
  "red_full_moon",
];

function isDiscordEnabled(): boolean {
  const enabled = (process.env.DISCORD_ALERTS_ENABLED ?? "true")
    .toLowerCase()
    .trim();

  if (["0", "false", "no", "off"].includes(enabled)) return false;

  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}

function normalizeChannelName(input: string | null | undefined): string {
  return (input ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function getTwitchUrl(channelName: string | null | undefined): string {
  const clean = normalizeChannelName(channelName);
  return clean ? `https://twitch.tv/${clean}` : "Unknown";
}

function getDisplayChannel(channelName: string | null | undefined): string {
  return normalizeChannelName(channelName) || "unknown";
}

function getMinAuraRarity(): number {
  const raw = Number(
    String(process.env.DISCORD_MIN_AURA_RARITY ?? "100000000").replace(/,/g, "")
  );

  if (!Number.isFinite(raw) || raw < 1) return 100000000;

  return Math.floor(raw);
}

function getRareBiomeIds(): Set<string> {
  const raw = process.env.DISCORD_RARE_BIOMES;

  if (!raw) return new Set(DEFAULT_RARE_BIOMES);

  const ids = raw
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  return new Set(ids.length > 0 ? ids : DEFAULT_RARE_BIOMES);
}

function prettyId(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtSource(source: "roll" | "potion", potionName?: string): string {
  if (source === "potion") return potionName ? `Potion: ${potionName}` : "Potion";
  return "Roll";
}

async function postDiscord(payload: Record<string, unknown>): Promise<void> {
  if (!isDiscordEnabled()) return;

  const url = process.env.DISCORD_WEBHOOK_URL;

  if (!url) return;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Sols RNG Alerts",
        avatar_url: "https://cdn-icons-png.flaticon.com/512/8637/8637099.png",
        allowed_mentions: {
          parse: [],
        },
        ...payload,
      }),
    });

    if (!response.ok) {
      console.error("Discord webhook failed:", response.status, await response.text());
    }
  } catch (err) {
    console.error("Discord webhook error:", err);
  }
}

export async function sendDiscordAuraAlert(options: {
  channelId: string;
  channelName?: string | null;
  displayName: string;
  aura: AuraDef;
  effectiveRarity: number;
  tierId?: string;
  source: "roll" | "potion";
  potionName?: string;
}): Promise<void> {
  if (!isDiscordEnabled()) return;

  const minRarity = getMinAuraRarity();
  const tier = options.tierId ?? "unknown";
  const isDev = tier === "dev-exclusive";

  if (!isDev && options.effectiveRarity < minRarity) return;

  const channel = getDisplayChannel(options.channelName);
  const channelUrl = getTwitchUrl(options.channelName);

  await postDiscord({
    embeds: [
      {
        title: isDev ? "📌 DEV-EXCLUSIVE Aura Pulled!" : "🌌 Rare Aura Pulled!",
        description: `**${options.displayName}** ${options.source === "potion" ? "popped and got" : "rolled"} **${options.aura.name}**`,
        color: isDev ? 0xffd700 : 0x9b59b6,
        fields: [
          {
            name: "Aura",
            value: options.aura.name,
            inline: true,
          },
          {
            name: "Rarity",
            value: formatRarity(options.effectiveRarity),
            inline: true,
          },
          {
            name: "Tier",
            value: prettyId(tier),
            inline: true,
          },
          {
            name: "Player",
            value: options.displayName,
            inline: true,
          },
          {
            name: "Source",
            value: fmtSource(options.source, options.potionName),
            inline: true,
          },
          {
            name: "Twitch Channel",
            value: `${channel}\n${channelUrl}`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

export async function sendDiscordBiomeAlert(options: {
  channelId: string;
  channelName?: string | null;
  biomeId: string;
  timeOfDay?: string | null;
  expiresAt?: number;
}): Promise<void> {
  if (!isDiscordEnabled()) return;

  const biomeId = options.biomeId.toLowerCase().trim();
  const rareBiomes = getRareBiomeIds();

  if (!rareBiomes.has(biomeId)) return;

  const channel = getDisplayChannel(options.channelName);
  const channelUrl = getTwitchUrl(options.channelName);
  const biomeName = prettyId(biomeId);

  await postDiscord({
    embeds: [
      {
        title: "🌍 Rare Biome Spawned!",
        description: `**${biomeName}** spawned in **${channel}**`,
        color: 0x2ecc71,
        fields: [
          {
            name: "Biome",
            value: biomeName,
            inline: true,
          },
          {
            name: "Time",
            value: options.timeOfDay ? prettyId(options.timeOfDay) : "Unknown",
            inline: true,
          },
          {
            name: "Ends In",
            value: options.expiresAt ? formatRemaining(options.expiresAt) : "Unknown",
            inline: true,
          },
          {
            name: "Twitch Channel",
            value: `${channel}\n${channelUrl}`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

export async function sendDiscordTestAlert(channelName?: string | null): Promise<void> {
  const channel = getDisplayChannel(channelName);
  const channelUrl = getTwitchUrl(channelName);

  await postDiscord({
    embeds: [
      {
        title: "✅ Sols RNG Discord Webhook Test",
        description: "Discord alerts are connected successfully.",
        color: 0x3498db,
        fields: [
          {
            name: "Twitch Channel",
            value: `${channel}\n${channelUrl}`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
