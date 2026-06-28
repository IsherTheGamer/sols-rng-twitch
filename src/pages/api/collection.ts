import type { NextApiRequest, NextApiResponse } from "next";
import { auras, potions } from "@/lib/data";
import { text, parseQuery } from "@/lib/api-helpers";
import { formatRarity, truncate } from "@/lib/format";
import {
  getProfileTierId,
  PROFILE_TIER_ORDER,
  type ProfileTierId,
} from "@/lib/profile";
import type { AuraDef } from "@/types/data";

type CollectionCategory =
  | "all"
  | "potion"
  | "event"
  | "biome"
  | "normal"
  | ProfileTierId;

const PER_PAGE = 3;

function normalize(input: string | undefined | null): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function displayTier(tier: string): string {
  return tier.replace("_", "-");
}

function parsePage(raw: string | undefined, fallback = 1): number {
  const page = parseInt(raw ?? "", 10);

  if (!Number.isFinite(page) || page < 1) return fallback;

  return page;
}

function getPotionExclusiveInfo(aura: AuraDef): {
  potionName: string;
  rarity?: number;
} | null {
  if (aura.potion?.id) {
    const potion = potions.find((p) => p.id === aura.potion?.id);

    return {
      potionName: potion?.name ?? aura.potion.id,
      rarity: aura.potion.rarity,
    };
  }

  for (const potion of potions) {
    const exclusive = (potion.exclusiveAuras ?? []).find(
      (entry) => entry.auraId === aura.id
    );

    if (exclusive) {
      return {
        potionName: potion.name,
        rarity: exclusive.rarity,
      };
    }
  }

  return null;
}

function getAuraTier(aura: AuraDef): ProfileTierId {
  return getProfileTierId(aura, aura.rarity);
}

function isTierCategory(input: string): input is ProfileTierId {
  return PROFILE_TIER_ORDER.includes(input as ProfileTierId);
}

function parseCategoryAndPage(query: string): {
  category: CollectionCategory;
  page: number;
} {
  const parts = query.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {
      category: "all",
      page: 1,
    };
  }

  const first = normalize(parts[0]);
  const second = parts[1];

  if (first === "page") {
    return {
      category: "all",
      page: parsePage(second, 1),
    };
  }

  if (
    first === "all" ||
    first === "potion" ||
    first === "potions" ||
    first === "exclusive" ||
    first === "event" ||
    first === "events" ||
    first === "biome" ||
    first === "biomes" ||
    first === "normal"
  ) {
    let category: CollectionCategory = "all";

    if (first === "potion" || first === "potions" || first === "exclusive") {
      category = "potion";
    } else if (first === "event" || first === "events") {
      category = "event";
    } else if (first === "biome" || first === "biomes") {
      category = "biome";
    } else if (first === "normal") {
      category = "normal";
    }

    return {
      category,
      page: parsePage(second, 1),
    };
  }

  if (first === "transcendant") {
    return {
      category: "transcendent",
      page: parsePage(second, 1),
    };
  }

  if (
    first === "challengedplus" ||
    first === "challenged_plus" ||
    first === "challenged+"
  ) {
    return {
      category: "challenged+",
      page: parsePage(second, 1),
    };
  }

  if (
    first === "dev" ||
    first === "devexclusive" ||
    first === "dev_exclusive"
  ) {
    return {
      category: "dev-exclusive",
      page: parsePage(second, 1),
    };
  }

  if (isTierCategory(first)) {
    return {
      category: first,
      page: parsePage(second, 1),
    };
  }

  return {
    category: "all",
    page: parsePage(parts[0], 1),
  };
}

function filterAuras(category: CollectionCategory): AuraDef[] {
  const obtainable = auras.filter((aura) => !aura.deleted);

  if (category === "all") {
    return obtainable;
  }

  if (category === "potion") {
    return obtainable.filter((aura) => getPotionExclusiveInfo(aura));
  }

  if (category === "event") {
    return obtainable.filter((aura) => aura.event);
  }

  if (category === "biome") {
    return obtainable.filter((aura) => aura.biome || aura.devBiome);
  }

  if (category === "normal") {
    return obtainable.filter(
      (aura) =>
        !aura.event &&
        !aura.biome &&
        !aura.devBiome &&
        !getPotionExclusiveInfo(aura)
    );
  }

  return obtainable.filter((aura) => getAuraTier(aura) === category);
}

function formatAuraLine(aura: AuraDef): string {
  const tier = getAuraTier(aura);
  const potionInfo = getPotionExclusiveInfo(aura);

  const parts = [
    aura.name,
    displayTier(tier),
    formatRarity(aura.rarity),
  ];

  if (potionInfo) {
    const potionRarity = potionInfo.rarity
      ? ` ${formatRarity(potionInfo.rarity)}`
      : "";

    parts.push(`Potion: ${potionInfo.potionName}${potionRarity}`);
  } else if (aura.event) {
    parts.push(`Event: ${aura.event}`);
  } else if (aura.devBiome) {
    parts.push(`Dev biome: ${aura.devBiome}`);
  } else if (aura.biome) {
    parts.push(`Biome: ${aura.biome}`);
  }

  if (aura.luckImmune) {
    parts.push("Raw luck only");
  }

  if (aura.unobtainable) {
    parts.push("Unobtainable");
  }

  return parts.join(" | ");
}

function sortAuras(list: AuraDef[]): AuraDef[] {
  return [...list].sort((a, b) => {
    const tierA = getAuraTier(a);
    const tierB = getAuraTier(b);

    const rankA = PROFILE_TIER_ORDER.indexOf(tierA);
    const rankB = PROFILE_TIER_ORDER.indexOf(tierB);

    if (rankB !== rankA) return rankB - rankA;

    if (b.rarity !== a.rarity) return b.rarity - a.rarity;

    return a.name.localeCompare(b.name);
  });
}

function formatMenu(): string {
  return truncate(
    "Aura Collection: !collection all 1 | tiers: basic, epic, unique, legendary, mythic, exalted, glorious, transcendent, challenged, dimensional, challenged+ | filters: potion, event, biome, normal",
    390
  );
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query = parseQuery(req);

  if (!query) {
    return text(res, formatMenu());
  }

  const { category, page } = parseCategoryAndPage(query);

  const list = sortAuras(filterAuras(category));

  if (list.length === 0) {
    return text(res, `Collection ${category}: no auras found.`);
  }

  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const shown = list.slice(start, start + PER_PAGE);

  const body = shown.map(formatAuraLine).join(" || ");

  return text(
    res,
    truncate(
      `Collection ${category} ${safePage}/${totalPages} (${list.length}): ${body}`,
      390
    )
  );
}
