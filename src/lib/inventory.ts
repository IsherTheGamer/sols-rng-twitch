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

export interface TokenDefinition {
  id: string;
  name: string;
  aliases: string[];
  kind: TokenKind;
  potionId?: string;
  flatLuck?: number;
  percentLuck?: number;
  durationSeconds?: number;
}

export interface ActiveTokenBuff {
  tokenId: string;
  tokenName: string;
  kind: TokenKind;
  potionId?: string;
  flatLuck: number;
  percentLuck: number;
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

const BOOST_TOKENS: TokenDefinition[] = [
  {
    id: "clover",
    name: "Token of Clover",
    aliases: ["clover", "token of clover", "clover token"],
    kind: "percent_luck",
    percentLuck: 0.5,
    durationSeconds: 120,
  },
  {
    id: "lunar",
    name: "Token of Lunar",
    aliases: ["lunar", "moon", "token of lunar", "token of moon"],
    kind: "percent_luck",
    percentLuck: 0.1,
    durationSeconds: 60,
  },
  {
    id: "fortune",
    name: "Token of Fortune",
    aliases: ["fortune", "lucky", "token of fortune", "luck token"],
    kind: "percent_luck",
    percentLuck: 0.2,
    durationSeconds: 75,
  },
  {
    id: "eclipse",
    name: "Token of Eclipse",
    aliases: ["eclipse", "token of eclipse"],
    kind: "percent_luck",
    percentLuck: 0.25,
    durationSeconds: 90,
  },
  {
    id: "starlight",
    name: "Token of Starlight",
    aliases: ["starlight", "star", "token of starlight"],
    kind: "percent_luck",
    percentLuck: 0.35,
    durationSeconds: 90,
  },
  {
    id: "nebula",
    name: "Token of Nebula",
    aliases: ["nebula", "token of nebula"],
    kind: "percent_luck",
    percentLuck: 0.6,
    durationSeconds: 120,
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
    potionId: potion.id,
    flatLuck: potion.luck,
  };
}

export function getAllTokenDefinitions(): TokenDefinition[] {
  return [
    ...BOOST_TOKENS,
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
        tokenName: buff.tokenName ?? buff.potionName ?? buff.tokenId ?? "Unknown Token",
        kind: buff.kind ?? "potion",
        potionId: buff.potionId,
        flatLuck: buff.flatLuck ?? buff.luck ?? 0,
        percentLuck: buff.percentLuck ?? 0,
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

  removeToken(inventory, token.id, amount);

  const now = Date.now();

  const buff: ActiveTokenBuff = {
    tokenId: token.id,
    tokenName: token.name,
    kind: token.kind,
    potionId: token.potionId,
    flatLuck: token.flatLuck ?? 0,
    percentLuck: token.percentLuck ?? 0,
    amount,
    activatedAt: now,
    expiresAt: token.durationSeconds ? now + token.durationSeconds * 1000 : null,
    consumeOnRoll: token.kind === "potion",
  };

  inventory.activeBuffs.push(buff);

  await setViewerInventory(inventory);

  if (token.kind === "percent_luck") {
    return {
      ok: true,
      message: `Activated ${token.name} x${amount}: +${Math.round(
        (token.percentLuck ?? 0) * 100 * amount
      )}% luck for ${token.durationSeconds}s.`,
      inventory,
    };
  }

  return {
    ok: true,
    message: `Activated ${token.name} x${amount}: +${formatLuckAmount(
      (token.flatLuck ?? 0) * amount
    )} luck on your next !roll.`,
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

  const totalLuck = options.potion.luck * Math.max(1, Math.floor(options.amount));

  return {
    ok: result.ok,
    message: result.message,
    inventory: result.inventory,
    totalLuck,
  };
}

export async function consumeRollTokenBuffs(options: {
  channelId: string;
  user: NightbotUser | null;
}): Promise<{
  flatLuck: number;
  percentLuck: number;
  used: ActiveTokenBuff[];
}> {
  const inventory = await getViewerInventory(options.channelId, options.user);
  const now = Date.now();

  const active = inventory.activeBuffs.filter(
    (buff) => !buff.expiresAt || buff.expiresAt > now
  );

  const used = [...active];

  const flatLuck = active.reduce(
    (sum, buff) => sum + buff.flatLuck * buff.amount,
    0
  );

  const percentLuck = active.reduce(
    (sum, buff) => sum + buff.percentLuck * buff.amount,
    0
  );

  inventory.activeBuffs = active.filter((buff) => !buff.consumeOnRoll);

  await setViewerInventory(inventory);

  return {
    flatLuck,
    percentLuck,
    used,
  };
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
  const now = Date.now();

  const refunded = inventory.activeBuffs.filter(
    (buff) => !buff.expiresAt || buff.expiresAt > now
  );

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
  if (!expiresAt) return "next roll";

  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

  return `${remaining}s`;
}

function formatActiveBuff(buff: ActiveTokenBuff): string {
  if (buff.kind === "percent_luck") {
    return `${buff.tokenName} x${buff.amount} (+${Math.round(
      buff.percentLuck * 100 * buff.amount
    )}% | ${formatSecondsRemaining(buff.expiresAt)})`;
  }

  return `${buff.tokenName} x${buff.amount} (+${formatLuckAmount(
    buff.flatLuck * buff.amount
  )} | next roll)`;
}

export function formatTokenUsage(options: {
  flatLuck: number;
  percentLuck: number;
}): string {
  const parts: string[] = [];

  if (options.flatLuck > 0) {
    parts.push(`+${formatLuckAmount(options.flatLuck)} luck`);
  }

  if (options.percentLuck > 0) {
    parts.push(`+${Math.round(options.percentLuck * 100)}% luck`);
  }

  return parts.join(" and ");
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

function formatTokenDefinitionShort(token: TokenDefinition): string {
  const name = shortTokenName(token.name);

  if (token.kind === "percent_luck") {
    return `${name} +${formatPercent(token.percentLuck ?? 0)} ${
      token.durationSeconds ?? 0
    }s`;
  }

  return `${name} +${formatLuckAmount(token.flatLuck ?? 0)} next roll`;
}

export function formatTokenList(query = ""): string {
  const mode = normalize(query);

  const boostTokens = BOOST_TOKENS;
  const potionTokens = potions.map(getPotionTokenDefinition);

  if (
    mode.includes("boost") ||
    mode.includes("percent") ||
    mode.includes("%")
  ) {
    return shorten(
      `🎟️ Boost Tokens: ${boostTokens
        .map(formatTokenDefinitionShort)
        .join(" | ")}`
    );
  }

  if (
    mode.includes("potion") ||
    mode.includes("flat") ||
    mode.includes("roll")
  ) {
    return shorten(
      `🧪 Potion Tokens: ${potionTokens
        .map(formatTokenDefinitionShort)
        .join(" | ")}`
    );
  }

  return shorten(
    `🎟️ Tokens: ${boostTokens
      .map(formatTokenDefinitionShort)
      .join(" | ")} | Potion tokens exist too. Use !tokens potions`
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
