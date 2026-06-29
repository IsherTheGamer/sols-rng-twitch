import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { listViewerProfiles } from "@/lib/profile";
import { parseQuery, text } from "@/lib/api-helpers";
import { formatRarity, truncate } from "@/lib/format";

type LeaderboardMode = "rolls" | "rarity";

function normalize(input: string): string {
  return input.toLowerCase().trim();
}

function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

function parseMode(query: string): LeaderboardMode {
  const q = normalize(query);

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
      return (profile.rarityTotal ?? 0) > 0;
    })
    .sort((a, b) => {
      if (mode === "rolls") return b.rolls - a.rolls;
      return (b.rarityTotal ?? 0) - (a.rarityTotal ?? 0);
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

      return `${rank}) ${profile.displayName}: ${formatRarity(
        profile.rarityTotal ?? 0
      )} total`;
    })
    .join(" | ");

  const title =
    mode === "rolls"
      ? "🏆 Rolls Leaderboard"
      : "💎 Rarity Total Leaderboard";

  return text(res, truncate(`${title}: ${body}`, 390));
}
