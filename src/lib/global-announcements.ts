import { Redis } from "@upstash/redis";
import type { AuraDef } from "../types/data";
import { potions } from "./data";
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
  minTier: AnnouncementThreshold;
  updatedAt: number;
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
  minTier: "glorious",
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

  const minTier =
    normalizeAnnouncementThreshold(input.minTier) ??
    DEFAULT_SETTINGS.minTier;

  return {
    enabled: input.enabled ?? DEFAULT_SETTINGS.enabled,
    minTier,
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

  return `Global announcements: ON | Minimum: ${settings.minTier}`;
}

function getThresholdRank(threshold: AnnouncementThreshold): number {
  return PROFILE_TIER_RANK[threshold];
}

function isPotionExclusiveAuraForPotion(
  aura: AuraDef,
  potionId?: string
): boolean {
  if (!potionId) {
    return !!aura.potion?.id;
  }

  if (aura.potion?.id === potionId) return true;

  const potion = potions.find((p) => p.id === potionId);

  return (potion?.exclusiveAuras ?? []).some(
    (exclusive) => exclusive.auraId === aura.id
  );
}

function isNativeRarity(
  aura: AuraDef,
  effectiveRarity: number
): boolean {
  return (
    aura.nativeRarity != null &&
    aura.nativeRarity === effectiveRarity &&
    aura.rarity !== effectiveRarity
  );
}

function formatAuraRarityForAnnouncement(options: {
  aura: AuraDef;
  effectiveRarity: number;
  potionId?: string;
}): string {
  const { aura, effectiveRarity, potionId } = options;

  if (isPotionExclusiveAuraForPotion(aura, potionId)) {
    return "";
  }

  if (isNativeRarity(aura, effectiveRarity)) {
    return ` ${formatRarity(effectiveRarity)} native/base ${formatRarity(
      aura.rarity
    )}`;
  }

  return ` ${formatRarity(effectiveRarity)}`;
}

function getTierRank(
  aura: AuraDef,
  effectiveRarity: number
): { tierId: ProfileTierId; rank: number } {
  const tierId = getProfileTierId(aura, effectiveRarity);

  return {
    tierId,
    rank: PROFILE_TIER_RANK[tierId],
  };
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

  const { tierId } = getTierRank(aura, effectiveRarity);
  const sourceText = formatSourceText({ source, potionName });

  const rarityText = formatAuraRarityForAnnouncement({
    aura,
    effectiveRarity,
    potionId,
  });

  return truncate(
    `🌍 GLOBAL: ${displayName} ${sourceText} ${aura.name}${rarityText} [${tierId}]`,
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

  return truncate(
    `📌 PIN 5m: ${options.displayName} ${sourceText} DEV-EXCLUSIVE ${options.aura.name}!`,
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

  const minRank = getThresholdRank(settings.minTier);

  const qualifying = options.results
    .map((result) => {
      const tier = getTierRank(result.aura, result.effectiveRarity);

      return {
        ...result,
        tierId: tier.tierId,
        tierRank: tier.rank,
      };
    })
    .filter((result) => result.tierRank >= minRank)
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
