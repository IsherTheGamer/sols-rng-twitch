import type { NextApiRequest, NextApiResponse } from "next";
import { text, verifyCron } from "@/lib/api-helpers";
import { auras, findAuraByQuery } from "@/lib/data";
import { formatRarity } from "@/lib/format";
import { getMegaDiscordSettings } from "@/lib/mega-feature-system";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseAmount(raw: string, fallback: number): number {
  const cleaned = raw.toLowerCase().replace(/,/g, "").trim();
  const match = cleaned.match(/^(\d+)(k|m|b)?$/);
  if (!match) return fallback;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return fallback;
  if (match[2] === "k") return base * 1_000;
  if (match[2] === "m") return base * 1_000_000;
  if (match[2] === "b") return base * 1_000_000_000;
  return base;
}

function cleanChannel(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function sourceLabel(source: string): string {
  if (source === "potion") return "Potion";
  if (source === "token") return "Token";
  return "Roll";
}

function verb(source: string): string {
  if (source === "potion") return "popped and got";
  if (source === "token") return "used a token and rolled";
  return "rolled";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.CRON_SECRET || !verifyCron(req)) {
    return text(res, "❌ Discord aura tester locked. Add ?token=YOUR_CRON_SECRET.");
  }

  const channelId =
    first(req.query.channelId).replace(/[^a-zA-Z0-9_-]/g, "") ||
    process.env.DEFAULT_CHANNEL_ID ||
    "904797805";

  const channel =
    cleanChannel(first(req.query.channel)) ||
    process.env.DEFAULT_CHANNEL_NAME ||
    "zipittt";

  const player =
    first(req.query.player)
      .replace(/[^a-zA-Z0-9_ \-]/g, "")
      .trim()
      .slice(0, 32) || "isherthegamer";

  const auraQuery = first(req.query.aura).trim() || "Sovereign";
  const aura = findAuraByQuery(auraQuery);

  if (!aura) {
    const suggestions = auras
      .filter((entry) =>
        entry.name.toLowerCase().includes(auraQuery.toLowerCase())
      )
      .slice(0, 5)
      .map((entry) => entry.name)
      .join(", ");

    return text(
      res,
      `❌ Unknown aura "${auraQuery}".${suggestions ? ` Suggestions: ${suggestions}` : ""}`
    );
  }

  const rarity = Math.max(
    1,
    parseAmount(first(req.query.rarity), aura.rarity)
  );

  const sourceRaw = first(req.query.source).toLowerCase();
  const source = ["roll", "potion", "token"].includes(sourceRaw)
    ? sourceRaw
    : "roll";

  const tier =
    first(req.query.tier)
      .replace(/[^a-zA-Z0-9_+\- ]/g, "")
      .trim()
      .slice(0, 40) ||
    aura.tags?.[0] ||
    "Test Tier";

  const settings = await getMegaDiscordSettings(channelId);

  if (!settings.webhookUrl) {
    return text(
      res,
      "❌ No Discord webhook is configured. Set DISCORD_WEBHOOK_URL or save one through your Discord alert settings."
    );
  }

  const payload = {
    username: "Sols RNG Alerts",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title:
          tier.toLowerCase() === "dev-exclusive"
            ? "📌 DEV-EXCLUSIVE Aura Pulled!"
            : "🌌 Rare Aura Pulled!",
        description: `**${player}** ${verb(source)} **${aura.name}**`,
        color:
          tier.toLowerCase() === "dev-exclusive" ? 0xffd700 : 0x9b59b6,
        fields: [
          { name: "Aura", value: aura.name, inline: true },
          { name: "Rarity", value: formatRarity(rarity), inline: true },
          { name: "Tier", value: tier, inline: true },
          { name: "Player", value: player, inline: true },
          { name: "Source", value: sourceLabel(source), inline: true },
          {
            name: "Twitch Channel",
            value: `${channel}\nhttps://twitch.tv/${channel}`,
            inline: false,
          },
          {
            name: "\u200b",
            value: "-# Test",
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(settings.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return text(
        res,
        `❌ Discord rejected the test: HTTP ${response.status} ${(
          await response.text()
        ).slice(0, 180)}`
      );
    }

    return text(
      res,
      `✅ Discord aura test sent: ${player} → ${aura.name} ${formatRarity(
        rarity
      )}. No gameplay data changed.`
    );
  } catch (error) {
    return text(
      res,
      `❌ Discord test failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
