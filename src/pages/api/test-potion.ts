import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getChannelState } from "@/lib/state";
import { findPotion, auraMap } from "@/lib/data";
import { rollMultiple } from "@/lib/roll-engine";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { formatRarity, truncate } from "@/lib/format";

function parseArgs(query: string): {
  potionQuery: string;
  samples: number;
} {
  const parts = query.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {
      potionQuery: "",
      samples: 0,
    };
  }

  const maybeCount = parseInt(parts[parts.length - 1], 10);

  if (!Number.isNaN(maybeCount) && maybeCount > 0) {
    return {
      potionQuery: parts.slice(0, -1).join(" "),
      samples: Math.min(maybeCount, 2000),
    };
  }

  return {
    potionQuery: query,
    samples: 0,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, channelName } = getChannelContext(req);

  const query = parseQuery(req);
  const { potionQuery, samples } = parseArgs(query);

  if (!potionQuery) {
    return text(
      res,
      "Use: /api/test-potion?args=void heart OR /api/test-potion?args=oblivion 1000"
    );
  }

  const potion = findPotion(potionQuery);

  if (!potion) {
    return error(res, `Unknown potion: ${potionQuery}`);
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

  for (const result of results) {
    if (!exclusiveIds.has(result.aura.id)) continue;

    hitCounts.set(
      result.aura.name,
      (hitCounts.get(result.aura.name) ?? 0) + 1
    );
  }

  const hits =
    hitCounts.size > 0
      ? [...hitCounts.entries()]
          .map(([name, count]) => `${name} x${count}`)
          .join(" | ")
      : "no exclusive hits";

  const msg =
    `TEST ${potion.name} ${samples}x: ${hits} | ` +
    `Exclusive: ${
      exclusiveStatus.length ? exclusiveStatus.join(" | ") : "none"
    }`;

  return text(res, truncate(msg));
}
