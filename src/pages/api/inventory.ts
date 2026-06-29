import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { listViewerProfiles } from "@/lib/profile";
import { parseQuery, text } from "@/lib/api-helpers";
import { formatRarity, truncate } from "@/lib/format";

type LeaderboardMode = "rolls" | "rarity" | "level";

function normalize(input: string): string {
  return input.toLowerCase().trim();
}

function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

function parseMode(query: string): LeaderboardMode {
  const q = normalize(query);

  if (q.includes("level") || q.includes("lvl") || q.includes("xp")) {
    return "level";
  }

  if (
    q.includes("rarity") ||
    q.includes("rare") ||
    q.includes("total") ||
    q.includes("value")
  ) {
    return "rarity";
  }

  return "rolls";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId } = getChannelContext(req);
  const query = parseQuery(req);
  const mode = parseMode(query);

  const profiles = await listViewerProfiles(channelId);

  if (profiles.length === 0) {
    return text(res, "🏆 Leaderboard is empty. Start rolling with !roll");
  }

  const sorted = [...profiles]
    .filter((profile) => {
      if (mode === "rolls") return profile.rolls > 0;
      if (mode === "rarity") return (profile.rarityTotal ?? 0) > 0;
      return (profile.level ?? 1) > 1 || (profile.xp ?? 0) > 0;
    })
    .sort((a, b) => {
      if (mode === "rolls") return b.rolls - a.rolls;

      if (mode === "rarity") {
        return (b.rarityTotal ?? 0) - (a.rarityTotal ?? 0);
      }

      if ((b.level ?? 1) !== (a.level ?? 1)) {
        return (b.level ?? 1) - (a.level ?? 1);
      }

      if ((b.xp ?? 0) !== (a.xp ?? 0)) {
        return (b.xp ?? 0) - (a.xp ?? 0);
      }

      return b.rolls - a.rolls;
    })
    .slice(0, 5);

  if (sorted.length === 0) {
    return text(res, `🏆 No ${mode} leaderboard data yet.`);
  }

  const body = sorted
    .map((profile, index) => {
      const rank = index + 1;

      if (mode === "rolls") {
        return `${rank}) ${profile.displayName}: ${formatNumber(
          profile.rolls
        )} rolls`;
      }

      if (mode === "rarity") {
        return `${rank}) ${profile.displayName}: ${formatRarity(
          profile.rarityTotal ?? 0
        )} total`;
      }

      return `${rank}) ${profile.displayName}: Lv.${
        profile.level ?? 1
      } (${formatNumber(profile.xp ?? 0)} XP)`;
    })
    .join(" | ");

  const title =
    mode === "rolls"
      ? "🏆 Rolls Leaderboard"
      : mode === "rarity"
      ? "💎 Rarity Total Leaderboard"
      : "⭐ Level Leaderboard";

  return text(res, truncate(`${title}: ${body}`, 390));
}
