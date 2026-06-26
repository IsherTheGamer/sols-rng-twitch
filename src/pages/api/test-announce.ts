import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { text, error, parseQuery } from "@/lib/api-helpers";
import {
  announceAuraResults,
  buildTestAnnouncementResult,
  findPotionForExclusiveAura,
} from "@/lib/global-announcements";

function parseArgs(query: string): {
  source: "roll" | "potion";
  auraQuery: string;
} {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.toLowerCase();

  if (first === "potion" || first === "pop") {
    return {
      source: "potion",
      auraQuery: parts.slice(1).join(" "),
    };
  }

  if (first === "roll") {
    return {
      source: "roll",
      auraQuery: parts.slice(1).join(" "),
    };
  }

  return {
    source: "roll",
    auraQuery: query,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, user, isMod } = getChannelContext(req);

  if (!isMod) {
    return error(res, "Mod only.");
  }

  const query = parseQuery(req);
  const { source, auraQuery } = parseArgs(query);

  if (!auraQuery) {
    return text(
      res,
      "Use: !testannounce roll luminosity OR !testannounce potion eden"
    );
  }

  const displayName = user?.displayName ?? user?.name ?? "Tester";

  const built = buildTestAnnouncementResult({
    displayName,
    auraQuery,
    source,
  });

  if (!built.aura || !built.result) {
    return error(res, built.message);
  }

  const potionInfo =
    source === "potion" ? findPotionForExclusiveAura(built.aura) : {};

  await announceAuraResults({
    channelId,
    displayName,
    results: [built.result],
    source,
    potionId: potionInfo.potionId,
    potionName: potionInfo.potionName,
  });

  return text(res, `Sent test ${source} announcement for ${built.aura.name}.`);
}
