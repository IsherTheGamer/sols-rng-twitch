import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import {
  getAchievementBonuses,
  getGlobalLuck,
  getGlobalRolls,
  getNextLuckMilestone,
} from "@/lib/global-stats";
import { getViewerCoreLuck } from "@/lib/core-system";
import { getServerLuckMultiplier } from "@/lib/social-system";
import { getViewerInventory } from "@/lib/inventory";
import { truncate } from "@/lib/format";

function fmtNum(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}

function fmtPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function addFinalMultiplier(base: number, extra: number): number {
  if (extra <= 1) return base;
  return base + (extra - 1);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const query = parseQuery(req).trim().toLowerCase();
  const mode = query.split(/\s+/).filter(Boolean)[0] ?? "player";

  const globalRolls = await getGlobalRolls();
  const nextRollGlobalLuck = getGlobalLuck(globalRolls + 1);
  const milestone = getNextLuckMilestone(globalRolls);
  const achievement = await getAchievementBonuses();
  const server = await getServerLuckMultiplier(channelId);

  if (mode === "global" || mode === "server") {
    const next =
      milestone.remaining > 0
        ? `Next x${milestone.nextLuck} global luck in ${fmtNum(milestone.remaining)} rolls`
        : "Max global roll luck reached";

    return text(
      res,
      truncate(
        `🌐 Global Luck: x${nextRollGlobalLuck} base | Server Boost: +${fmtNum(
          server.percent
        )}% | Global Rolls: ${fmtNum(globalRolls)} | ${next}`
      )
    );
  }

  if (!user) {
    return text(res, "Use !luck from Twitch chat, or use !luck global.");
  }

  const core = await getViewerCoreLuck(channelId, user);
  const inventory = await getViewerInventory(channelId, user);

  const active = inventory.activeBuffs.filter(
    (buff) => buff.amount > 0 && (!buff.expiresAt || buff.expiresAt > Date.now())
  );

  const exclusive = active.find(
    (buff) => buff.effectMode === "exclusive" && buff.consumeOnRoll
  );

  let tokenFlat = 0;
  let tokenPercent = 0;
  let tokenFinal = 1;
  let tokenText = "No active token luck";

  if (exclusive) {
    tokenFlat = exclusive.flatLuck;
    tokenText = `${exclusive.tokenName} exclusive +${fmtNum(tokenFlat)} next roll`;
  } else {
    const timed = active.filter(
      (buff) => buff.kind === "percent_luck" && !buff.consumeOnRoll
    );

    const queuedPotions = active.filter(
      (buff) =>
        buff.kind === "potion" &&
        buff.consumeOnRoll &&
        buff.effectMode === "normal"
    );

    for (const buff of timed) {
      tokenFlat += buff.flatLuck;
      tokenPercent += buff.percentLuck;
      tokenFinal = addFinalMultiplier(tokenFinal, buff.finalLuckMultiplier);
    }

    for (const buff of queuedPotions) {
      tokenFlat += buff.flatLuck;
    }

    const parts: string[] = [];

    if (tokenFlat > 0) parts.push(`+${fmtNum(tokenFlat)} flat`);
    if (tokenPercent > 0) parts.push(`+${fmtPercent(tokenPercent)}`);
    if (tokenFinal > 1) parts.push(`+${Math.round((tokenFinal - 1) * 100)}% final`);

    if (timed.length > 0 || queuedPotions.length > 0) {
      tokenText = parts.join(", ") || "special token luck";
    }
  }

  const baseAfterCore = nextRollGlobalLuck * core.multiplier;

  const estimatedLuck =
    ((baseAfterCore + tokenFlat) * (1 + tokenPercent) +
      achievement.flatLuck) *
    achievement.finalLuckMultiplier *
    server.multiplier *
    tokenFinal;

  const msg =
    `🍀 ${user.displayName}'s Luck: ~x${fmtNum(estimatedLuck)} next roll | ` +
    `Global x${nextRollGlobalLuck} | Core ${core.label} | ` +
    `Server +${fmtNum(server.percent)}% | Tokens: ${tokenText}`;

  return text(res, truncate(msg));
}
