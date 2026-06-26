import { Redis } from "@upstash/redis";
import type { AuraDef } from "../types/data";
import {
  auraAnnouncements,
  auraMap,
  findAuraByQuery,
  potions,
} from "./data";
import { sendNightbotMessage } from "./nightbot";
import { formatRarity, truncate } from "./format";
import {
  getProfileTierId,
  PROFILE_TIER_RANK,
  type ProfileTierId,
} from "./profile";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

export type AnnouncementThreshold =
  | "glorious"
  | "transcendent"
  | "challenged"
  | "dimensional"
  | "challenged+"
  | "dev-exclusive";

export interface AnnouncementSettings {
  enabled: boolean;
  rollMinTier: AnnouncementThreshold;
  potionMinTier: AnnouncementThreshold;
  updatedAt: number;

  /**
   * Old setting support.
   * This keeps existing Redis data from breaking after the upgrade.
   */
  minTier?: AnnouncementThreshold;
}

export const ANNOUNCEMENT_THRESHOLDS: AnnouncementThreshold[] = [
  "glorious",
  "transcendent",
  "challenged",
  "dimensional",
  "challenged+",
  "dev-exclusive",
];

const DEFAULT_SETTINGS: AnnouncementSettings = {
  enabled: true,
  rollMinTier: "glorious",
  potionMinTier: "transcendent",
  updatedAt: 0,
};

function settingsKey(channelId: string): string {
  return `channel:${channelId}:announcement-settings`;
}

export function normalizeAnnouncementThreshold(
  raw: string | undefined | null
): AnnouncementThreshold | null {
  if (!raw) return null;

  const value = raw.toLowerCase().trim();

  if (value === "glorious") return "glorious";
  if (value === "transcendent" || value === "transcendant") {
    return "transcendent";
  }
  if (value === "challenged") return "challenged";
  if (value === "dimensional") return "dimensional";
  if (
    value === "challenged+" ||
    value === "challengedplus" ||
    value === "challenged_plus"
  ) {
    return "challenged+";
  }
  if (
    value === "dev" ||
    value === "dev-exclusive" ||
    value === "devexclusive" ||
    value === "dev_exclusive"
  ) {
    return "dev-exclusive";
  }

  return null;
}

function normalizeSettings(
  input: Partial<AnnouncementSettings> | null | undefined
): AnnouncementSettings {
  if (!input) return { ...DEFAULT_SETTINGS };

  const oldMinTier =
    normalizeAnnouncementThreshold(input.minTier) ?? DEFAULT_SETTINGS.rollMinTier;

  const rollMinTier =
    normalizeAnnouncementThreshold(input.rollMinTier) ?? oldMinTier;

  const potionMinTier =
    normalizeAnnouncementThreshold(input.potionMinTier) ??
    DEFAULT_SETTINGS.potionMinTier;

  return {
    enabled: input.enabled ?? DEFAULT_SETTINGS.enabled,
    rollMinTier,
    potionMinTier,
    updatedAt: input.updatedAt ?? 0,
  };
}

export async function getAnnouncementSettings(
  channelId: string
): Promise<AnnouncementSettings> {
  const r = getRedis();

  if (!r) return { ...DEFAULT_SETTINGS };

  const data = await r.get<AnnouncementSettings>(settingsKey(channelId));

  return normalizeSettings(data);
}

export async function setAnnouncementSettings(
  channelId: string,
  settings: AnnouncementSettings
): Promise<void> {
  const r = getRedis();

  if (!r) return;

  await r.set(settingsKey(channelId), {
    ...settings,
    updatedAt: Date.now(),
  });
}

export function formatAnnouncementSettings(
  settings: AnnouncementSettings
): string {
  if (!settings.enabled) {
    return "Global announcements: OFF";
  }

  return `Global announcements: ON | Roll: ${settings.rollMinTier}+ | Potion: ${settings.potionMinTier}+`;
}

function getThresholdRank(threshold: AnnouncementThreshold): number {
  return PROFILE_TIER_RANK[threshold];
}

function isPotionExclusiveAuraForPotion(
  aura: AuraDef,
  potionId?: string
): boolean {
  if (!potionId) {
    if (aura.potion?.id) return true;

    return potions.some((potion) =>
      (potion.exclusiveAuras ?? []).some(
        (exclusive) => exclusive.auraId === aura.id
      )
    );
  }

  if (aura.potion?.id === potionId) return true;

  const potion = potions.find((p) => p.id === potionId);

  return (potion?.exclusiveAuras ?? []).some(
    (exclusive) => exclusive.auraId === aura.id
  );
}

function isNativeRarity(aura: AuraDef, effectiveRarity: number): boolean {
  return (
    aura.nativeRarity != null &&
    aura.nativeRarity === effectiveRarity &&
    aura.rarity !== effectiveRarity
  );
}

function getAnnouncementTierInfo(options: {
  aura: AuraDef;
  effectiveRarity: number;
  source: "roll" | "potion";
  potionId?: string;
}): { tierId: ProfileTierId; rank: number; tierRarity: number } {
  const isPotionExclusive = isPotionExclusiveAuraForPotion(
    options.aura,
    options.potionId
  );

  const tierRarity =
    options.source === "potion" && isPotionExclusive
      ? options.aura.rarity
      : options.effectiveRarity;

  const tierId = getProfileTierId(options.aura, tierRarity);

  return {
    tierId,
    rank: PROFILE_TIER_RANK[tierId],
    tierRarity,
  };
}

function formatAuraRarityForAnnouncement(options: {
  aura: AuraDef;
  effectiveRarity: number;
  source: "roll" | "potion";
  potionId?: string;
}): string {
  const { aura, effectiveRarity, source, potionId } = options;

  if (source === "potion" && isPotionExclusiveAuraForPotion(aura, potionId)) {
    return "";
  }

  if (isNativeRarity(aura, effectiveRarity)) {
    return ` ${formatRarity(effectiveRarity)} native/base ${formatRarity(
      aura.rarity
    )}`;
  }

  return ` ${formatRarity(effectiveRarity)}`;
}

function formatSourceText(options: {
  source: "roll" | "potion";
  potionName?: string;
}): string {
  if (options.source === "potion") {
    return `popped ${options.potionName ?? "a potion"} and got`;
  }

  return "rolled";
}

function fillTemplate(template: string, displayName: string): string {
  return template
    .replaceAll("{user}", displayName)
    .replaceAll("{username}", displayName)
    .replaceAll("[Username]", displayName)
    .replaceAll("[username]", displayName)
    .replaceAll("[@username]", displayName)
    .replaceAll("@Username", displayName)
    .replaceAll("@username", displayName);
}

function getAuraAnnouncementLine(
  aura: AuraDef,
  displayName: string
): string | null {
  const template = auraAnnouncements[aura.id];

  if (!template) return null;

  return fillTemplate(template, displayName);
}

function isPotionExclusiveAura(aura: AuraDef): boolean {
  return isPotionExclusiveAuraForPotion(aura);
}

function shouldAnnounceResult(options: {
  source: "roll" | "potion";
  tierRank: number;
  minRank: number;
  aura: AuraDef;
  potionId?: string;
}): boolean {
  if (options.source === "potion") {
    if (isPotionExclusiveAuraForPotion(options.aura, options.potionId)) {
      return true;
    }
  }

  return options.tierRank >= options.minRank;
}

export function buildAuraAnnouncement(options: {
  displayName: string;
  aura: AuraDef;
  effectiveRarity: number;
  source: "roll" | "potion";
  potionId?: string;
  potionName?: string;
}): string {
  const {
    displayName,
    aura,
    effectiveRarity,
    source,
    potionId,
    potionName,
  } = options;

  const tier = getAnnouncementTierInfo({
    aura,
    effectiveRarity,
    source,
    potionId,
  });

  const sourceText = formatSourceText({ source, potionName });

  const rarityText = formatAuraRarityForAnnouncement({
    aura,
    effectiveRarity,
    source,
    potionId,
  });

  const messageLine = getAuraAnnouncementLine(aura, displayName);
  const messageText = messageLine ? ` — ${messageLine}` : "";

  return truncate(
    `🌍 GLOBAL: ${displayName} ${sourceText} ${aura.name}${rarityText} [${tier.tierId}]${messageText}`,
    390
  );
}

export function buildDevExclusivePinAnnouncement(options: {
  displayName: string;
  aura: AuraDef;
  source: "roll" | "potion";
  potionName?: string;
}): string {
  const sourceText = formatSourceText({
    source: options.source,
    potionName: options.potionName,
  });

  const messageLine = getAuraAnnouncementLine(
    options.aura,
    options.displayName
  );

  const messageText = messageLine ? ` — ${messageLine}` : "";

  return truncate(
    `📌 PIN 5m: ${options.displayName} ${sourceText} DEV-EXCLUSIVE ${options.aura.name}!${messageText}`,
    390
  );
}

export async function announceAuraResults(options: {
  channelId: string;
  displayName: string;
  results: Array<{ aura: AuraDef; effectiveRarity: number }>;
  source: "roll" | "potion";
  potionId?: string;
  potionName?: string;
}): Promise<void> {
  const settings = await getAnnouncementSettings(options.channelId);

  if (!settings.enabled) return;

  const minTier =
    options.source === "potion"
      ? settings.potionMinTier
      : settings.rollMinTier;

  const minRank = getThresholdRank(minTier);

  const qualifying = options.results
    .map((result) => {
      const tier = getAnnouncementTierInfo({
        aura: result.aura,
        effectiveRarity: result.effectiveRarity,
        source: options.source,
        potionId: options.potionId,
      });

      return {
        ...result,
        tierId: tier.tierId,
        tierRank: tier.rank,
        isPotionExclusive: isPotionExclusiveAuraForPotion(
          result.aura,
          options.potionId
        ),
      };
    })
    .filter((result) =>
      shouldAnnounceResult({
        source: options.source,
        tierRank: result.tierRank,
        minRank,
        aura: result.aura,
        potionId: options.potionId,
      })
    )
    .sort((a, b) => {
      if (b.tierRank !== a.tierRank) return b.tierRank - a.tierRank;
      return b.effectiveRarity - a.effectiveRarity;
    });

  if (qualifying.length === 0) return;

  const maxMessages = 3;
  const shown = qualifying.slice(0, maxMessages);

  for (const result of shown) {
    const isDevExclusive = result.tierId === "dev-exclusive";

    const msg = isDevExclusive
      ? buildDevExclusivePinAnnouncement({
          displayName: options.displayName,
          aura: result.aura,
          source: options.source,
          potionName: options.potionName,
        })
      : buildAuraAnnouncement({
          displayName: options.displayName,
          aura: result.aura,
          effectiveRarity: result.effectiveRarity,
          source: options.source,
          potionId: options.potionId,
          potionName: options.potionName,
        });

    await sendNightbotMessage(msg);
  }

  const hidden = qualifying.length - shown.length;

  if (hidden > 0) {
    await sendNightbotMessage(
      truncate(`🌍 GLOBAL: +${hidden} more rare aura(s) were rolled.`, 390)
    );
  }
}

export function buildTestAnnouncementResult(options: {
  displayName: string;
  auraQuery: string;
  source: "roll" | "potion";
  potionId?: string;
  potionName?: string;
}): {
  aura: AuraDef | null;
  result: { aura: AuraDef; effectiveRarity: number } | null;
  message: string;
} {
  const aura = findAuraByQuery(options.auraQuery);

  if (!aura) {
    return {
      aura: null,
      result: null,
      message: `Unknown aura: ${options.auraQuery}`,
    };
  }

  const effectiveRarity =
    options.source === "potion" && aura.potion?.rarity
      ? aura.potion.rarity
      : aura.rarity;

  const result = {
    aura,
    effectiveRarity,
  };

  const message = buildAuraAnnouncement({
    displayName: options.displayName,
    aura,
    effectiveRarity,
    source: options.source,
    potionId: options.potionId ?? aura.potion?.id,
    potionName: options.potionName,
  });

  return {
    aura,
    result,
    message,
  };
}

export function isAuraPotionExclusive(aura: AuraDef): boolean {
  return isPotionExclusiveAura(aura);
}

export function findPotionForExclusiveAura(aura: AuraDef): {
  potionId?: string;
  potionName?: string;
} {
  if (aura.potion?.id) {
    const potion = potions.find((p) => p.id === aura.potion?.id);

    return {
      potionId: aura.potion.id,
      potionName: potion?.name,
    };
  }

  const potion = potions.find((p) =>
    (p.exclusiveAuras ?? []).some((exclusive) => exclusive.auraId === aura.id)
  );

  return {
    potionId: potion?.id,
    potionName: potion?.name,
  };
}
