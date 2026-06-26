import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getChannelState } from "@/lib/state";
import { findPotion, auraMap } from "@/lib/data";
import { rollMultiple } from "@/lib/roll-engine";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { formatRarity, truncate } from "@/lib/format";
import { announceAuraResults } from "@/lib/global-announcements";

function parseArgs(query: string): {
  potionQuery: string;
  samples: number;
  announce: boolean;
  force: boolean;
} {
  const rawParts = query.trim().split(/\s+/).filter(Boolean);

  const announce = rawParts.some((p) => p.toLowerCase() === "announce");
  const force = rawParts.some((p) => p.toLowerCase() === "force");

  const parts = rawParts.filter((p) => {
    const low = p.toLowerCase();
    return low !== "announce" && low !== "force";
  });

  if (parts.length === 0) {
    return {
      potionQuery: "",
      samples: 0,
      announce,
      force,
    };
  }

  const maybeCount = parseInt(parts[parts.length - 1], 10);

  if (!Number.isNaN(maybeCount) && maybeCount > 0) {
    return {
      potionQuery: parts.slice(0, -1).join(" "),
      samples: Math.min(maybeCount, 5000),
      announce,
      force,
    };
  }

  return {
    potionQuery: parts.join(" "),
    samples: 0,
    announce,
    force,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    channelId,
    channelName,
    user,
    isMod,
  } = getChannelContext(req);

  const query = parseQuery(req);
  const { potionQuery, samples, announce, force } = parseArgs(query);

  if (!potionQuery) {
    return text(
      res,
      "Use: !testpotion void heart OR !testpotion void heart 1000 announce OR !testpotion void heart force"
    );
  }

  const potion = findPotion(potionQuery);

  if (!potion) {
    return error(res, `Unknown potion: ${potionQuery}`);
  }

  if ((announce || force) && !isMod) {
    return error(res, "Announce/force test is mod only.");
  }

  const exclusives = potion.exclusiveAuras ?? [];

  const exclusiveStatus = exclusives.map((exclusive) => {
    const aura = auraMap.get(exclusive.auraId);

    if (!aura) {
      return `${exclusive.auraId}: MISSING`;
    }

    const flags: string[] = [];

    if (aura.unobtainable) flags.push("unobtainable");
    if (aura.deleted) flags.push("deleted");
    if (aura.biomeLock) flags.push("biomeLock");
    if (aura.potion?.id) flags.push(`auraPotion=${aura.potion.id}`);

    const flagText = flags.length ? ` [${flags.join(",")}]` : "";

    return `${aura.name} ${formatRarity(exclusive.rarity)} OK${flagText}`;
  });

  const displayName = user?.displayName ?? user?.name ?? "Tester";

  if (force) {
    const forcedResults = exclusives
      .map((exclusive) => {
        const aura = auraMap.get(exclusive.auraId);

        if (!aura) return null;

        return {
          aura,
          effectiveRarity: exclusive.rarity,
        };
      })
      .filter(Boolean) as Array<{
        aura: NonNullable<ReturnType<typeof auraMap.get>>;
        effectiveRarity: number;
      }>;

    if (forcedResults.length === 0) {
      return error(res, `${potion.name} has no valid exclusive auras.`);
    }

    await announceAuraResults({
      channelId,
      displayName,
      results: forcedResults,
      source: "potion",
      potionId: potion.id,
      potionName: potion.name,
    });

    return text(
      res,
      truncate(
        `FORCED ${potion.name}: ${forcedResults
          .map((r) => r.aura.name)
          .join(", ")} announcement sent.`
      )
    );
  }

  if (samples <= 0) {
    const msg =
      `TEST ${potion.name}: ` +
      (exclusiveStatus.length
        ? exclusiveStatus.join(" | ")
        : "no exclusive auras");

    return text(res, truncate(msg));
  }

  const state = await getChannelState(channelId, channelName);

  const results = rollMultiple(
    {
      state,
      luck: potion.luck,
      potionId: potion.id,
    },
    samples
  );

  const exclusiveIds = new Set(exclusives.map((e) => e.auraId));
  const hitCounts = new Map<string, number>();
  const exclusiveHits: Array<{
    aura: NonNullable<ReturnType<typeof auraMap.get>>;
    effectiveRarity: number;
  }> = [];

  for (const result of results) {
    if (!exclusiveIds.has(result.aura.id)) continue;

    hitCounts.set(
      result.aura.name,
      (hitCounts.get(result.aura.name) ?? 0) + 1
    );

    exclusiveHits.push(result);
  }

  if (announce && exclusiveHits.length > 0) {
    await announceAuraResults({
      channelId,
      displayName,
      results: exclusiveHits,
      source: "potion",
      potionId: potion.id,
      potionName: potion.name,
    });
  }

  const hits =
    hitCounts.size > 0
      ? [...hitCounts.entries()]
          .map(([name, count]) => `${name} x${count}`)
          .join(" | ")
      : "no exclusive hits";

  const announceText =
    announce && exclusiveHits.length > 0
      ? " | announcement sent"
      : announce
      ? " | no announcement, no exclusive hit"
      : "";

  const msg =
    `TEST ${potion.name} ${samples}x: ${hits}${announceText} | ` +
    `Exclusive: ${
      exclusiveStatus.length ? exclusiveStatus.join(" | ") : "none"
    }`;

  return text(res, truncate(msg));
}
