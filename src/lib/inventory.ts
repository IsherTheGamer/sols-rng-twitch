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

export interface ActiveTokenBuff {
  tokenId: string;
  potionId: string;
  potionName: string;
  luck: number;
  amount: number;
  activatedAt: number;
}

export interface ViewerInventory {
  channelId: string;
  userId: string;
  displayName: string;
  tokens: Record<string, number>;
  activeBuffs: ActiveTokenBuff[];
  createdAt: number;
  updatedAt: number;
}

function inventoryKey(channelId: string, userId: string): string {
  return `inventory:${channelId}:${userId}`;
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
    .replace(/^token\s+of\s+/i, "")
    .replace(/^token\s+/i, "")
    .replace(/\s+/g, " ");
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
    activeBuffs: input.activeBuffs ?? [],
    createdAt: input.createdAt ?? base.createdAt,
    updatedAt: Date.now(),
  };
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

  return normalizeInventory(data, channelId, userId, displayName);
}

export async function setViewerInventory(
  inventory: ViewerInventory
): Promise<void> {
  const r = getRedis();

  if (!r) return;

  inventory.updatedAt = Date.now();

  await r.set(inventoryKey(inventory.channelId, inventory.userId), inventory);
}

export function findPotionForToken(query: string): PotionDef | null {
  const cleaned = normalize(query);

  if (!cleaned) return null;

  const direct = findPotion(cleaned);

  if (direct) return direct;

  return (
    potions.find((potion) => {
      const id = normalize(potion.id);
      const name = normalize(potion.name);

      return id === cleaned || name === cleaned;
    }) ?? null
  );
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

export function addToken(
  inventory: ViewerInventory,
  tokenId: string,
  amount: number
): void {
  const safeAmount = Math.max(0, Math.floor(amount));

  if (safeAmount <= 0) return;

  inventory.tokens[tokenId] = (inventory.tokens[tokenId] ?? 0) + safeAmount;
}

export function removeToken(
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
    const potion = findPotionForToken(reward.id);
    const tokenId = potion ? getPotionTokenId(potion) : reward.id;

    addToken(inventory, tokenId, reward.amount ?? 1);
  }

  await setViewerInventory(inventory);
}

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
  const inventory = await getViewerInventory(options.channelId, options.user);
  const tokenId = getPotionTokenId(options.potion);
  const amount = Math.max(1, Math.floor(options.amount));
  const owned = inventory.tokens[tokenId] ?? 0;

  if (owned < amount) {
    return {
      ok: false,
      message: `You have ${owned} ${getPotionTokenName(
        options.potion
      )}(s).`,
      inventory,
      totalLuck: 0,
    };
  }

  removeToken(inventory, tokenId, amount);

  const existing = inventory.activeBuffs.find(
    (buff) => buff.tokenId === tokenId
  );

  if (existing) {
    existing.amount += amount;
    existing.luck = options.potion.luck;
    existing.activatedAt = Date.now();
  } else {
    inventory.activeBuffs.push({
      tokenId,
      potionId: options.potion.id,
      potionName: options.potion.name,
      luck: options.potion.luck,
      amount,
      activatedAt: Date.now(),
    });
  }

  await setViewerInventory(inventory);

  return {
    ok: true,
    message: `Activated ${getPotionTokenName(options.potion)} x${amount}`,
    inventory,
    totalLuck: options.potion.luck * amount,
  };
}

export async function consumeActiveTokenBuffs(options: {
  channelId: string;
  user: NightbotUser | null;
}): Promise<{
  totalLuck: number;
  used: ActiveTokenBuff[];
}> {
  const inventory = await getViewerInventory(options.channelId, options.user);
  const used = [...inventory.activeBuffs];

  if (used.length === 0) {
    return {
      totalLuck: 0,
      used: [],
    };
  }

  const totalLuck = used.reduce(
    (sum, buff) => sum + buff.luck * buff.amount,
    0
  );

  inventory.activeBuffs = [];

  await setViewerInventory(inventory);

  return {
    totalLuck,
    used,
  };
}

export async function refundActiveTokenBuffs(options: {
  channelId: string;
  user: NightbotUser | null;
}): Promise<{
  refunded: ActiveTokenBuff[];
}> {
  const inventory = await getViewerInventory(options.channelId, options.user);
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
  const potion = potions.find((p) => p.id === tokenId);
  const name = potion ? getPotionTokenName(potion) : `Token of ${tokenId}`;

  return `${name} x${amount}`;
}

function formatActiveBuff(buff: ActiveTokenBuff): string {
  return `${buff.potionName} x${buff.amount} (+${formatLuckAmount(
    buff.luck * buff.amount
  )})`;
}

export function formatInventory(inventory: ViewerInventory): string {
  const tokens = Object.entries(inventory.tokens)
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tokenId, amount]) => formatTokenEntry(tokenId, amount));

  const active = inventory.activeBuffs.map(formatActiveBuff);

  const tokenText = tokens.length > 0 ? tokens.join(", ") : "No tokens";
  const activeText = active.length > 0 ? active.join(", ") : "No active buffs";

  return `${inventory.displayName} Inventory | Tokens: ${tokenText} | Active: ${activeText}`;
}
