import { Redis } from "@upstash/redis";
import type { NightbotUser } from "./nightbot";
import { findPotion, potions } from "./data";
import type { PotionDef } from "../types/data";
import type { LevelReward } from "./levels";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

export type TokenKind = "potion" | "percent_luck";
export type TokenEffectMode = "normal" | "exclusive";

export interface TokenDefinition {
  id: string;
  name: string;
  aliases: string[];
  kind: TokenKind;
  effectMode: TokenEffectMode;
  potionId?: string;
  flatLuck?: number;
  percentLuck?: number;
  rareBiomePercentLuck?: number;
  finalLuckMultiplier?: number;
  durationSeconds?: number;
  note?: string;
}

export interface ActiveTokenBuff {
  tokenId: string;
  tokenName: string;
  kind: TokenKind;
  effectMode: TokenEffectMode;
  potionId?: string;
  flatLuck: number;
  percentLuck: number;
  rareBiomePercentLuck: number;
  finalLuckMultiplier: number;
  amount: number;
  activatedAt: number;
  expiresAt: number | null;
  consumeOnRoll: boolean;
}

type LegacyActiveTokenBuff = Partial<ActiveTokenBuff> & {
  potionName?: string;
  luck?: number;
};

export interface ViewerInventory {
  channelId: string;
  userId: string;
  displayName: string;
  tokens: Record<string, number>;
  activeBuffs: ActiveTokenBuff[];
  createdAt: number;
  updatedAt: number;
}

export interface RollTokenEffect {
  flatLuck: number;
  percentLuck: number;
  rareBiomePercentLuck: number;
  finalLuckMultiplier: number;
  potionId?: string;
  exclusive: boolean;
  used: ActiveTokenBuff[];
}

export interface RollTokenPlan {
  effects: RollTokenEffect[];
}

const EXCLUSIVE_POTION_IDS = new Set([
  "oblivion",
  "axis_potion",
  "xyz_potion",
  "word_potion",
  "chaos_potion",
  "overpowered_potion",
]);

const TIMED_TOKENS: TokenDefinition[] = [
  {
    id: "clover",
    name: "Token of Clover",
    aliases: ["clover", "token of clover", "clover token"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.5,
    durationSeconds: 120,
  },
  {
    id: "lunar",
    name: "Token of Lunar",
    aliases: ["lunar", "moon", "token of lunar", "token of moon"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.1,
    durationSeconds: 60,
  },
  {
    id: "fortune",
    name: "Token of Fortune",
    aliases: ["fortune", "lucky", "token of fortune", "luck token"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.2,
    durationSeconds: 75,
  },
  {
    id: "eclipse",
    name: "Token of Eclipse",
    aliases: ["eclipse", "token of eclipse"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.25,
    durationSeconds: 90,
  },
  {
    id: "starlight",
    name: "Token of Starlight",
    aliases: ["starlight", "star", "token of starlight"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.35,
    durationSeconds: 90,
  },
  {
    id: "nebula",
    name: "Token of Nebula",
    aliases: ["nebula", "token of nebula"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.6,
    durationSeconds: 120,
  },

  // 20 new balanced timed/special tokens
  {
    id: "spark",
    name: "Token of Spark",
    aliases: ["spark", "token of spark"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.05,
    durationSeconds: 30,
  },
  {
    id: "drizzle",
    name: "Token of Drizzle",
    aliases: ["drizzle", "rain", "token of drizzle"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.07,
    durationSeconds: 45,
  },
  {
    id: "ember",
    name: "Token of Ember",
    aliases: ["ember", "token of ember"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.1,
    durationSeconds: 60,
  },
  {
    id: "frost",
    name: "Token of Frost",
    aliases: ["frost", "ice", "token of frost"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.12,
    durationSeconds: 60,
  },
  {
    id: "bloom",
    name: "Token of Bloom",
    aliases: ["bloom", "flower", "token of bloom"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.14,
    durationSeconds: 75,
  },
  {
    id: "storm",
    name: "Token of Storm",
    aliases: ["storm", "token of storm"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.16,
    durationSeconds: 75,
  },
  {
    id: "prism",
    name: "Token of Prism",
    aliases: ["prism", "rainbow", "token of prism"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.18,
    durationSeconds: 90,
  },
  {
    id: "comet",
    name: "Token of Comet",
    aliases: ["comet", "token of comet"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.2,
    durationSeconds: 90,
  },
  {
    id: "galaxy",
    name: "Token of Galaxy",
    aliases: ["galaxy", "token of galaxy"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.24,
    durationSeconds: 100,
  },
  {
    id: "nova",
    name: "Token of Nova",
    aliases: ["nova", "token of nova"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.28,
    durationSeconds: 105,
  },
  {
    id: "astral",
    name: "Token of Astral",
    aliases: ["astral", "token of astral"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.32,
    durationSeconds: 110,
  },
  {
    id: "supernova",
    name: "Token of Supernova",
    aliases: ["supernova", "token of supernova"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.38,
    durationSeconds: 120,
  },
  {
    id: "focus",
    name: "Token of Focus",
    aliases: ["focus", "token of focus"],
    kind: "percent_luck",
    effectMode: "normal",
    finalLuckMultiplier: 1.03,
    durationSeconds: 60,
    note: "+3% final luck",
  },
  {
    id: "catalyst",
    name: "Token of Catalyst",
    aliases: ["catalyst", "token of catalyst"],
    kind: "percent_luck",
    effectMode: "normal",
    finalLuckMultiplier: 1.05,
    durationSeconds: 75,
    note: "+5% final luck",
  },
  {
    id: "horizon",
    name: "Token of Horizon",
    aliases: ["horizon", "token of horizon"],
    kind: "percent_luck",
    effectMode: "normal",
    rareBiomePercentLuck: 0.2,
    durationSeconds: 90,
    note: "+20% luck in rare/special biomes",
  },
  {
    id: "distortion",
    name: "Token of Distortion",
    aliases: ["distortion", "token of distortion"],
    kind: "percent_luck",
    effectMode: "normal",
    rareBiomePercentLuck: 0.35,
    durationSeconds: 90,
    note: "+35% luck in rare/special biomes",
  },
  {
    id: "resonance",
    name: "Token of Resonance",
    aliases: ["resonance", "token of resonance"],
    kind: "percent_luck",
    effectMode: "normal",
    flatLuck: 2500,
    percentLuck: 0.05,
    durationSeconds: 90,
    note: "+2,500 flat luck and +5% luck",
  },
  {
    id: "pulse",
    name: "Token of Pulse",
    aliases: ["pulse", "token of pulse"],
    kind: "percent_luck",
    effectMode: "normal",
    flatLuck: 7500,
    durationSeconds: 60,
    note: "+7,500 flat luck",
  },
  {
    id: "stability",
    name: "Token of Stability",
    aliases: ["stability", "stable", "token of stability"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.12,
    finalLuckMultiplier: 1.02,
    durationSeconds: 90,
    note: "+12% luck and +2% final luck",
  },
  {
    id: "eclipse_core",
    name: "Token of Eclipse Core",
    aliases: ["eclipse core", "core", "token of eclipse core"],
    kind: "percent_luck",
    effectMode: "normal",
    percentLuck: 0.18,
    rareBiomePercentLuck: 0.15,
    durationSeconds: 100,
    note: "+18% luck and +15% extra in rare/special biomes",
  },
];

function inventoryKey(channelId: string, userId: string): string {
  return `inventory:${channelId}:${userId}`;
}

function pendingGrantKey(channelId: string, username: string): string {
  return `inventory-grants:${channelId}:${normalizeUsername(username)}`;
}

function getUserId(user: NightbotUser | null): string {
  return user?.providerId ?? "anon";
}

function getDisplayName(user: NightbotUser | null): string {
  return user?.displayName ?? user?.name ?? "Player";
}

function normalize(input: string | undefined | null): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/^@+/, "")
    .replace(/^token\s+of\s+/i, "")
    .replace(/^token\s+/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeUsername(input: string | undefined | null): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

function getPossibleUsernames(user: NightbotUser | null): string[] {
  const names = [
    normalizeUsername(user?.name),
    normalizeUsername(user?.displayName),
  ].filter(Boolean);

  return [...new Set(names)];
}

function getPotionEffectMode(potion: PotionDef): TokenEffectMode {
  if (potion.clearsBuffs) return "exclusive";
  if (EXCLUSIVE_POTION_IDS.has(potion.id)) return "exclusive";

  return "normal";
}

function getPotionTokenDefinition(potion: PotionDef): TokenDefinition {
  return {
    id: potion.id,
    name: `Token of ${potion.name}`,
    aliases: [
      potion.id,
      potion.name,
      `token of ${potion.name}`,
      ...(potion.aliases ?? []),
    ],
    kind: "potion",
    effectMode: getPotionEffectMode(potion),
    potionId: potion.id,
    flatLuck: potion.luck,
  };
}

export function getAllTokenDefinitions(): TokenDefinition[] {
  return [
    ...TIMED_TOKENS,
    ...potions.map(getPotionTokenDefinition),
  ];
}

export function findTokenDefinition(query: string): TokenDefinition | null {
  const cleaned = normalize(query);

  if (!cleaned) return null;

  for (const token of getAllTokenDefinitions()) {
    const names = [token.id, token.name, ...token.aliases].map(normalize);

    if (names.includes(cleaned)) {
      return token;
    }
  }

  const potion = findPotion(cleaned);

  if (potion) {
    return getPotionTokenDefinition(potion);
  }

  return null;
}

export function findPotionForToken(query: string): PotionDef | null {
  const token = findTokenDefinition(query);

  if (token?.potionId) {
    return potions.find((potion) => potion.id === token.potionId) ?? null;
  }

  return findPotion(query) ?? null;
}

export function getPotionTokenId(potion: PotionDef): string {
  return potion.id;
}

export function getPotionTokenName(potion: PotionDef): string {
  return `Token of ${potion.name}`;
}

export function formatLuckAmount(luck: number): string {
  return Math.floor(luck).toLocaleString("en-US");
}

export function createDefaultInventory(
  channelId: string,
  userId: string,
  displayName: string
): ViewerInventory {
  const now = Date.now();

  return {
    channelId,
    userId,
    displayName,
    tokens: {},
    activeBuffs: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeInventory(
  input: Partial<ViewerInventory> | null | undefined,
  channelId: string,
  userId: string,
  displayName: string
): ViewerInventory {
  const base = createDefaultInventory(channelId, userId, displayName);

  if (!input) return base;

  return {
    channelId: input.channelId ?? channelId,
    userId: input.userId ?? userId,
    displayName: displayName || input.displayName || base.displayName,
    tokens: input.tokens ?? {},
    activeBuffs: ((input.activeBuffs ?? []) as LegacyActiveTokenBuff[]).map(
      (buff) => ({
        tokenId: buff.tokenId ?? "unknown",
        tokenName:
          buff.tokenName ?? buff.potionName ?? buff.tokenId ?? "Unknown Token",
        kind: buff.kind ?? "potion",
        effectMode: buff.effectMode ?? "normal",
        potionId: buff.potionId,
        flatLuck: buff.flatLuck ?? buff.luck ?? 0,
        percentLuck: buff.percentLuck ?? 0,
        rareBiomePercentLuck: buff.rareBiomePercentLuck ?? 0,
        finalLuckMultiplier: buff.finalLuckMultiplier ?? 1,
        amount: buff.amount ?? 1,
        activatedAt: buff.activatedAt ?? Date.now(),
        expiresAt: buff.expiresAt ?? null,
        consumeOnRoll: buff.consumeOnRoll ?? true,
      })
    ),
    createdAt: input.createdAt ?? base.createdAt,
    updatedAt: Date.now(),
  };
}

function addToken(
  inventory: ViewerInventory,
  tokenId: string,
  amount: number
): void {
  const safeAmount = Math.max(0, Math.floor(amount));

  if (safeAmount <= 0) return;

  inventory.tokens[tokenId] = (inventory.tokens[tokenId] ?? 0) + safeAmount;
}

function removeToken(
  inventory: ViewerInventory,
  tokenId: string,
  amount: number
): boolean {
  const safeAmount = Math.max(1, Math.floor(amount));
  const current = inventory.tokens[tokenId] ?? 0;

  if (current < safeAmount) return false;

  inventory.tokens[tokenId] = current - safeAmount;

  if (inventory.tokens[tokenId] <= 0) {
    delete inventory.tokens[tokenId];
  }

  return true;
}

function removeExpiredBuffs(inventory: ViewerInventory): void {
  const now = Date.now();

  inventory.activeBuffs = inventory.activeBuffs.filter(
    (buff) => !buff.expiresAt || buff.expiresAt > now
  );
}

async function claimPendingGrants(
  inventory: ViewerInventory,
  user: NightbotUser | null
): Promise<boolean> {
  const r = getRedis();

  if (!r) return false;

  const usernames = getPossibleUsernames(user);
  let changed = false;

  for (const username of usernames) {
    const key = pendingGrantKey(inventory.channelId, username);
    const grants = (await r.get<Record<string, number>>(key)) ?? {};

    for (const [tokenId, amount] of Object.entries(grants)) {
      addToken(inventory, tokenId, amount);
      changed = true;
    }

    if (Object.keys(grants).length > 0) {
      await r.del(key);
    }
  }

  return changed;
}

export async function getViewerInventory(
  channelId: string,
  user: NightbotUser | null
): Promise<ViewerInventory> {
  const userId = getUserId(user);
  const displayName = getDisplayName(user);

  const r = getRedis();

  if (!r) {
    return createDefaultInventory(channelId, userId, displayName);
  }

  const key = inventoryKey(channelId, userId);
  const data = await r.get<ViewerInventory>(key);

  const inventory = normalizeInventory(data, channelId, userId, displayName);
  removeExpiredBuffs(inventory);

  const claimed = await claimPendingGrants(inventory, user);

  if (claimed) {
    await setViewerInventory(inventory);
  }

  return inventory;
}

export async function setViewerInventory(
  inventory: ViewerInventory
): Promise<void> {
  const r = getRedis();

  if (!r) return;

  inventory.updatedAt = Date.now();

  await r.set(inventoryKey(inventory.channelId, inventory.userId), inventory);
}

export async function grantTokensToUsername(options: {
  channelId: string;
  username: string;
  tokenQuery: string;
  amount: number;
}): Promise<{ ok: boolean; message: string; token?: TokenDefinition }> {
  const r = getRedis();

  if (!r) {
    return {
      ok: false,
      message: "Inventory database is not connected.",
    };
  }

  const username = normalizeUsername(options.username);

  if (!username) {
    return {
      ok: false,
      message: "Invalid username.",
    };
  }

  const token = findTokenDefinition(options.tokenQuery);

  if (!token) {
    return {
      ok: false,
      message: `Unknown token: ${options.tokenQuery}`,
    };
  }

  const amount = Math.max(1, Math.floor(options.amount));
  const key = pendingGrantKey(options.channelId, username);
  const grants = (await r.get<Record<string, number>>(key)) ?? {};

  grants[token.id] = (grants[token.id] ?? 0) + amount;

  await r.set(key, grants);

  return {
    ok: true,
    message: `Gave ${token.name} x${amount} to ${username}. They will receive it when their inventory loads.`,
    token,
  };
}

export async function grantLevelRewardTokens(options: {
  channelId: string;
  user: NightbotUser | null;
  rewards: LevelReward[];
}): Promise<void> {
  const tokenRewards = options.rewards.filter(
    (reward) => reward.type === "token"
  );

  if (tokenRewards.length === 0) return;

  const inventory = await getViewerInventory(options.channelId, options.user);

  for (const reward of tokenRewards) {
    const token = findTokenDefinition(reward.id);

    addToken(inventory, token?.id ?? reward.id, reward.amount ?? 1);
  }

  await setViewerInventory(inventory);
}

function hasActiveExclusiveBuff(inventory: ViewerInventory): boolean {
  removeExpiredBuffs(inventory);

  return inventory.activeBuffs.some(
    (buff) => buff.effectMode === "exclusive" && buff.amount > 0
  );
}

function formatTimedTokenEffect(token: TokenDefinition): string {
  const parts: string[] = [];

  if ((token.flatLuck ?? 0) > 0) {
    parts.push(`+${formatLuckAmount(token.flatLuck ?? 0)} flat`);
  }

  if ((token.percentLuck ?? 0) > 0) {
    parts.push(`+${Math.round((token.percentLuck ?? 0) * 100)}% luck`);
  }

  if ((token.rareBiomePercentLuck ?? 0) > 0) {
    parts.push(
      `+${Math.round((token.rareBiomePercentLuck ?? 0) * 100)}% rare-biome luck`
    );
  }

  if ((token.finalLuckMultiplier ?? 1) > 1) {
    parts.push(
      `+${Math.round(((token.finalLuckMultiplier ?? 1) - 1) * 100)}% final luck`
    );
  }

  return parts.join(", ") || "special timed effect";
}

export async function useToken(options: {
  channelId: string;
  user: NightbotUser | null;
  tokenQuery: string;
  amount: number;
}): Promise<{ ok: boolean; message: string; inventory: ViewerInventory }> {
  const inventory = await getViewerInventory(options.channelId, options.user);
  const token = findTokenDefinition(options.tokenQuery);
  const amount = Math.max(1, Math.floor(options.amount));

  if (!token) {
    return {
      ok: false,
      message: `Unknown token: ${options.tokenQuery}`,
      inventory,
    };
  }

  const owned = inventory.tokens[token.id] ?? 0;

  if (owned < amount) {
    return {
      ok: false,
      message: `You have ${owned} ${token.name}(s).`,
      inventory,
    };
  }

  if (token.effectMode !== "exclusive" && hasActiveExclusiveBuff(inventory)) {
    return {
      ok: false,
      message:
        "An exclusive potion token is active. Roll it first or use !token refund before activating other tokens.",
      inventory,
    };
  }

  removeToken(inventory, token.id, amount);

  const now = Date.now();

  if (token.effectMode === "exclusive") {
    inventory.activeBuffs = [];
  }

  const existing =
    token.effectMode === "exclusive"
      ? null
      : inventory.activeBuffs.find((buff) => buff.tokenId === token.id);

  const durationMs = token.durationSeconds
    ? token.durationSeconds * 1000 * amount
    : 0;

  if (existing) {
    existing.amount += amount;
    existing.activatedAt = now;

    if (token.kind === "percent_luck" && token.durationSeconds) {
      const currentEnd =
        existing.expiresAt && existing.expiresAt > now
          ? existing.expiresAt
          : now;

      existing.expiresAt = currentEnd + durationMs;
    }
  } else {
    inventory.activeBuffs.push({
      tokenId: token.id,
      tokenName: token.name,
      kind: token.kind,
      effectMode: token.effectMode,
      potionId: token.potionId,
      flatLuck: token.flatLuck ?? 0,
      percentLuck: token.percentLuck ?? 0,
      rareBiomePercentLuck: token.rareBiomePercentLuck ?? 0,
      finalLuckMultiplier: token.finalLuckMultiplier ?? 1,
      amount,
      activatedAt: now,
      expiresAt:
        token.kind === "percent_luck" && token.durationSeconds
          ? now + durationMs
          : null,
      consumeOnRoll: token.kind === "potion",
    });
  }

  await setViewerInventory(inventory);

  if (token.kind === "percent_luck") {
    return {
      ok: true,
      message: `Activated ${token.name} x${amount}: ${formatTimedTokenEffect(
        token
      )} for ${(token.durationSeconds ?? 0) * amount}s.`,
      inventory,
    };
  }

  if (token.effectMode === "exclusive") {
    return {
      ok: true,
      message: `Activated ${token.name} x${amount}: exclusive potion effect. Other token luck will not combine with it.`,
      inventory,
    };
  }

  return {
    ok: true,
    message: `Activated ${token.name} x${amount}: uses 1 token per roll, +${formatLuckAmount(
      token.flatLuck ?? 0
    )} luck each roll.`,
    inventory,
  };
}

// Backward compatibility for old pop.ts, in case the file still exists.
export async function activatePotionTokens(options: {
  channelId: string;
  user: NightbotUser | null;
  potion: PotionDef;
  amount: number;
}): Promise<{
  ok: boolean;
  message: string;
  inventory: ViewerInventory;
  totalLuck: number;
}> {
  const result = await useToken({
    channelId: options.channelId,
    user: options.user,
    tokenQuery: options.potion.id,
    amount: options.amount,
  });

  const totalLuck =
    options.potion.luck * Math.max(1, Math.floor(options.amount));

  return {
    ok: result.ok,
    message: result.message,
    inventory: result.inventory,
    totalLuck,
  };
}

function consumeOne(buff: ActiveTokenBuff): ActiveTokenBuff {
  return {
    ...buff,
    amount: 1,
  };
}

function emptyRollTokenEffect(): RollTokenEffect {
  return {
    flatLuck: 0,
    percentLuck: 0,
    rareBiomePercentLuck: 0,
    finalLuckMultiplier: 1,
    exclusive: false,
    used: [],
  };
}

function addFinalMultiplier(base: number, extra: number): number {
  if (extra <= 1) return base;

  return base + (extra - 1);
}

function getPotionIdForUsedBuffs(buffs: ActiveTokenBuff[]): string | undefined {
  const potionBuffs = buffs.filter((buff) => buff.potionId);

  const withExclusivePool = potionBuffs.find((buff) => {
    const potion = potions.find((p) => p.id === buff.potionId);
    return (potion?.exclusiveAuras ?? []).length > 0;
  });

  return withExclusivePool?.potionId ?? potionBuffs[0]?.potionId;
}

function buildTimedEffect(timedBuffs: ActiveTokenBuff[]): RollTokenEffect {
  const effect = emptyRollTokenEffect();

  for (const buff of timedBuffs) {
    effect.flatLuck += buff.flatLuck;
    effect.percentLuck += buff.percentLuck;
    effect.rareBiomePercentLuck += buff.rareBiomePercentLuck;
    effect.finalLuckMultiplier = addFinalMultiplier(
      effect.finalLuckMultiplier,
      buff.finalLuckMultiplier
    );
    effect.used.push(buff);
  }

  return effect;
}

function consumeOneRollFromActiveBuffs(
  activeBuffs: ActiveTokenBuff[]
): {
  effect: RollTokenEffect;
  nextBuffs: ActiveTokenBuff[];
} {
  const exclusiveBuff = activeBuffs.find(
    (buff) =>
      buff.effectMode === "exclusive" &&
      buff.consumeOnRoll &&
      buff.amount > 0
  );

  if (exclusiveBuff) {
    const used = consumeOne(exclusiveBuff);
    const effect: RollTokenEffect = {
      flatLuck: exclusiveBuff.flatLuck,
      percentLuck: 0,
      rareBiomePercentLuck: 0,
      finalLuckMultiplier: 1,
      potionId: exclusiveBuff.potionId,
      exclusive: true,
      used: [used],
    };

    const nextBuffs = activeBuffs
      .map((buff) => {
        if (buff.tokenId !== exclusiveBuff.tokenId) return buff;

        return {
          ...buff,
          amount: buff.amount - 1,
        };
      })
      .filter((buff) => buff.amount > 0);

    return {
      effect,
      nextBuffs,
    };
  }

  const timedBuffs = activeBuffs.filter(
    (buff) =>
      buff.kind === "percent_luck" &&
      !buff.consumeOnRoll &&
      buff.amount > 0
  );

  const potionBuffs = activeBuffs.filter(
    (buff) =>
      buff.kind === "potion" &&
      buff.consumeOnRoll &&
      buff.effectMode === "normal" &&
      buff.amount > 0
  );

  const usedPotionBuffs = potionBuffs.map(consumeOne);
  const effect = buildTimedEffect(timedBuffs);

  for (const buff of usedPotionBuffs) {
    effect.flatLuck += buff.flatLuck;
    effect.used.push(buff);
  }

  effect.potionId = getPotionIdForUsedBuffs(usedPotionBuffs);

  const consumedIds = usedPotionBuffs.map((buff) => buff.tokenId);
  const remaining = [...consumedIds];

  const nextBuffs = activeBuffs
    .map((buff) => {
      const index = remaining.indexOf(buff.tokenId);

      if (index === -1) return buff;

      remaining.splice(index, 1);

      return {
        ...buff,
        amount: buff.amount - 1,
      };
    })
    .filter((buff) => buff.amount > 0);

  return {
    effect,
    nextBuffs,
  };
}

export async function consumeRollTokenBuffsForRolls(options: {
  channelId: string;
  user: NightbotUser | null;
  rolls: number;
}): Promise<RollTokenPlan> {
  const inventory = await getViewerInventory(options.channelId, options.user);
  const rolls = Math.max(0, Math.floor(options.rolls));

  removeExpiredBuffs(inventory);

  const effects: RollTokenEffect[] = [];
  let activeBuffs = inventory.activeBuffs;

  for (let i = 0; i < rolls; i++) {
    const result = consumeOneRollFromActiveBuffs(activeBuffs);

    effects.push(result.effect);
    activeBuffs = result.nextBuffs;
  }

  inventory.activeBuffs = activeBuffs;

  await setViewerInventory(inventory);

  return {
    effects,
  };
}

export async function consumeRollTokenBuffs(options: {
  channelId: string;
  user: NightbotUser | null;
}): Promise<RollTokenEffect> {
  const plan = await consumeRollTokenBuffsForRolls({
    channelId: options.channelId,
    user: options.user,
    rolls: 1,
  });

  return plan.effects[0] ?? emptyRollTokenEffect();
}

// Backward compatibility for old roll.ts names.
export async function consumeActiveTokenBuffs(options: {
  channelId: string;
  user: NightbotUser | null;
}): Promise<{
  totalLuck: number;
  used: ActiveTokenBuff[];
}> {
  const consumed = await consumeRollTokenBuffs(options);

  return {
    totalLuck: consumed.flatLuck,
    used: consumed.used,
  };
}

export async function refundActiveTokenBuffs(options: {
  channelId: string;
  user: NightbotUser | null;
}): Promise<{ refunded: ActiveTokenBuff[] }> {
  const inventory = await getViewerInventory(options.channelId, options.user);

  removeExpiredBuffs(inventory);

  const refunded = [...inventory.activeBuffs];

  for (const buff of refunded) {
    addToken(inventory, buff.tokenId, buff.amount);
  }

  inventory.activeBuffs = [];

  await setViewerInventory(inventory);

  return {
    refunded,
  };
}

function formatTokenEntry(tokenId: string, amount: number): string {
  const token = findTokenDefinition(tokenId);
  const name = token?.name ?? `Token of ${tokenId}`;

  return `${name} x${amount}`;
}

function formatSecondsRemaining(expiresAt: number | null): string {
  if (!expiresAt) return "queued";

  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

  return `${remaining}s`;
}

function formatActiveBuff(buff: ActiveTokenBuff): string {
  if (buff.kind === "percent_luck") {
    const parts: string[] = [];

    if (buff.flatLuck > 0) parts.push(`+${formatLuckAmount(buff.flatLuck)} flat`);
    if (buff.percentLuck > 0) parts.push(`+${Math.round(buff.percentLuck * 100)}%`);
    if (buff.rareBiomePercentLuck > 0) {
      parts.push(`+${Math.round(buff.rareBiomePercentLuck * 100)}% rare`);
    }
    if (buff.finalLuckMultiplier > 1) {
      parts.push(`+${Math.round((buff.finalLuckMultiplier - 1) * 100)}% final`);
    }

    const effect = parts.length > 0 ? parts.join(", ") : "special";

    return `${buff.tokenName} x${buff.amount} (${effect} | ${formatSecondsRemaining(
      buff.expiresAt
    )})`;
  }

  if (buff.effectMode === "exclusive") {
    return `${buff.tokenName} x${buff.amount} (exclusive | queued rolls)`;
  }

  return `${buff.tokenName} x${buff.amount} (+${formatLuckAmount(
    buff.flatLuck
  )} each roll | queued rolls)`;
}

export function formatTokenUsage(options: {
  flatLuck: number;
  percentLuck: number;
  rareBiomePercentLuck?: number;
  finalLuckMultiplier?: number;
  exclusive?: boolean;
}): string {
  const parts: string[] = [];

  if (options.exclusive) {
    parts.push("exclusive potion effect");
  }

  if (options.flatLuck > 0) {
    parts.push(`+${formatLuckAmount(options.flatLuck)} luck`);
  }

  if (options.percentLuck > 0) {
    parts.push(`+${Math.round(options.percentLuck * 100)}% luck`);
  }

  if ((options.rareBiomePercentLuck ?? 0) > 0) {
    parts.push(`+${Math.round((options.rareBiomePercentLuck ?? 0) * 100)}% rare-biome luck`);
  }

  if ((options.finalLuckMultiplier ?? 1) > 1) {
    parts.push(
      `+${Math.round(((options.finalLuckMultiplier ?? 1) - 1) * 100)}% final luck`
    );
  }

  return parts.join(" and ");
}

export function formatConsumedRollTokenEffects(effects: RollTokenEffect[]): string {
  const consumed = new Map<string, { name: string; amount: number }>();
  const timed = new Map<string, string>();

  for (const effect of effects) {
    for (const buff of effect.used) {
      if (buff.consumeOnRoll) {
        const current = consumed.get(buff.tokenId);

        consumed.set(buff.tokenId, {
          name: buff.tokenName,
          amount: (current?.amount ?? 0) + 1,
        });
      } else {
        timed.set(buff.tokenId, buff.tokenName);
      }
    }
  }

  const parts: string[] = [];

  if (consumed.size > 0) {
    parts.push(
      [...consumed.values()]
        .map((entry) => `${entry.name} x${entry.amount}`)
        .join(", ")
    );
  }

  if (timed.size > 0) {
    parts.push(`timed: ${[...timed.values()].join(", ")}`);
  }

  return parts.join(" | ");
}

function shorten(input: string, max = 390): string {
  if (input.length <= max) return input;

  return `${input.slice(0, max - 3)}...`;
}

function shortTokenName(name: string): string {
  return name
    .replace(/^Token of\s+/i, "")
    .replace(/^Potion of\s+/i, "")
    .replace(/\s+Potion$/i, "")
    .trim();
}

function formatPercent(percent: number): string {
  return `${Math.round(percent * 100)}%`;
}

function isSpecialTimedToken(token: TokenDefinition): boolean {
  return Boolean(
    (token.flatLuck ?? 0) > 0 ||
      (token.rareBiomePercentLuck ?? 0) > 0 ||
      (token.finalLuckMultiplier ?? 1) > 1
  );
}

function formatTokenDefinitionShort(token: TokenDefinition): string {
  const name = shortTokenName(token.name);

  if (token.kind === "percent_luck") {
    const parts: string[] = [];

    if ((token.percentLuck ?? 0) > 0) {
      parts.push(`+${formatPercent(token.percentLuck ?? 0)}`);
    }

    if ((token.flatLuck ?? 0) > 0) {
      parts.push(`+${formatLuckAmount(token.flatLuck ?? 0)} flat`);
    }

    if ((token.rareBiomePercentLuck ?? 0) > 0) {
      parts.push(`+${formatPercent(token.rareBiomePercentLuck ?? 0)} rare`);
    }

    if ((token.finalLuckMultiplier ?? 1) > 1) {
      parts.push(
        `+${Math.round(((token.finalLuckMultiplier ?? 1) - 1) * 100)}% final`
      );
    }

    return `${name} ${parts.join("/")} ${token.durationSeconds ?? 0}s`;
  }

  if (token.effectMode === "exclusive") {
    return `${name} +${formatLuckAmount(token.flatLuck ?? 0)} exclusive`;
  }

  return `${name} +${formatLuckAmount(token.flatLuck ?? 0)} each roll`;
}


export function formatTokenDefinitionPage(
  tokens: TokenDefinition[],
  rawPage: string | undefined,
  title: string,
  pageSize = 8
): string {
  const totalPages = Math.max(1, Math.ceil(tokens.length / pageSize));
  const pageValue = Number(String(rawPage ?? "1").replace(/,/g, ""));
  const page = Math.max(
    1,
    Math.min(totalPages, Number.isFinite(pageValue) ? Math.floor(pageValue) : 1)
  );
  const start = (page - 1) * pageSize;
  const shown = tokens.slice(start, start + pageSize).map(formatTokenDefinitionShort);

  return shorten(`${title} ${page}/${totalPages}: ${shown.join(" | ")}`);
}

export function formatTokenList(query = ""): string {
  const parts = normalize(query).split(" ").filter(Boolean);
  const mode = parts.join(" ");
  const last = parts[parts.length - 1];
  const page = /^\d+$/.test(last ?? "") ? last : "1";

  const timedTokens = TIMED_TOKENS;
  const normalTimedTokens = timedTokens.filter((token) => !isSpecialTimedToken(token));
  const specialTimedTokens = timedTokens.filter(isSpecialTimedToken);
  const potionTokens = potions.map(getPotionTokenDefinition);

  if (
    mode.includes("special") ||
    mode.includes("rare") ||
    mode.includes("final") ||
    mode.includes("flat")
  ) {
    return formatTokenDefinitionPage(specialTimedTokens, page, "✨ Special Tokens");
  }

  if (
    mode.includes("boost") ||
    mode.includes("percent") ||
    mode.includes("%") ||
    mode.includes("timed")
  ) {
    return formatTokenDefinitionPage(normalTimedTokens, page, "🎟️ Boost Tokens");
  }

  if (
    mode.includes("potion") ||
    mode.includes("roll")
  ) {
    return formatTokenDefinitionPage(potionTokens, page, "🧪 Potion Tokens");
  }

  return shorten(
    "🎟️ Token help: !token boosts [page] | !token special [page] | !token potions [page] | !token use <token> [amount] | !token refund."
  );
}

export function formatInventory(inventory: ViewerInventory): string {
  removeExpiredBuffs(inventory);

  const tokens = Object.entries(inventory.tokens)
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tokenId, amount]) => formatTokenEntry(tokenId, amount));

  const active = inventory.activeBuffs.map(formatActiveBuff);

  const tokenText = tokens.length > 0 ? tokens.join(", ") : "No tokens";
  const activeText = active.length > 0 ? active.join(", ") : "No active buffs";

  return `${inventory.displayName} Inventory | Tokens: ${tokenText} | Active: ${activeText}`;
}
