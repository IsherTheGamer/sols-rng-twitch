import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import {
  getViewerInventory,
  findTokenDefinition,
  type ActiveTokenBuff,
  type ViewerInventory,
} from "@/lib/inventory";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { truncate } from "@/lib/format";

const PAGE_SIZE = 6;

const TOKEN_PRIORITY: Record<string, number> = {
  overpowered_potion: 10000,
  oblivion: 9500,
  godlike: 9000,
  chaos_potion: 8800,
  axis_potion: 8700,
  xyz_potion: 8600,
  word_potion: 8500,
  pump_kings_blood: 8200,
  red_fragment_ii: 8000,
  void_heart: 7800,
  dune: 7600,
  heavenly: 7000,
  bound: 6500,
  popping: 6000,

  eclipse_core: 5600,
  distortion: 5400,
  supernova: 5200,
  nebula: 5000,
  starlight: 4800,
  eclipse: 4600,
  astral: 4400,
  nova: 4200,
  galaxy: 4000,
  catalyst: 3800,
  horizon: 3600,
  resonance: 3400,
  pulse: 3200,
  stability: 3000,
  clover: 2800,
  fortune: 2600,
  comet: 2400,
  prism: 2200,
  storm: 2000,
  bloom: 1800,
  frost: 1600,
  ember: 1400,
  lunar: 1200,
  drizzle: 1000,
  spark: 800,
};

function parsePage(query: string): number {
  const parts = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 1;

  const direct = Number(parts[0]);

  if (Number.isFinite(direct) && direct >= 1) {
    return Math.floor(direct);
  }

  const pageIndex = parts.findIndex((part) => part === "page" || part === "p");

  if (pageIndex !== -1) {
    const next = Number(parts[pageIndex + 1]);

    if (Number.isFinite(next) && next >= 1) {
      return Math.floor(next);
    }
  }

  return 1;
}

function shortTokenName(tokenId: string): string {
  const token = findTokenDefinition(tokenId);
  const name = token?.name ?? `Token of ${tokenId}`;

  return name
    .replace(/^Token of\s+/i, "")
    .replace(/^Potion of\s+/i, "")
    .replace(/\s+Potion$/i, "")
    .trim();
}

function tokenPriority(tokenId: string): number {
  return TOKEN_PRIORITY[tokenId] ?? 0;
}

function formatTokenEntry([tokenId, amount]: [string, number]): string {
  return `${shortTokenName(tokenId)} x${amount}`;
}

function formatSecondsRemaining(expiresAt: number | null): string {
  if (!expiresAt) return "queued";

  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

  return `${remaining}s`;
}

function formatActiveBuff(buff: ActiveTokenBuff): string {
  const name = buff.tokenName
    .replace(/^Token of\s+/i, "")
    .replace(/^Potion of\s+/i, "")
    .replace(/\s+Potion$/i, "")
    .trim();

  if (buff.consumeOnRoll) {
    return `${name} x${buff.amount} queued`;
  }

  return `${name} x${buff.amount} ${formatSecondsRemaining(buff.expiresAt)}`;
}

function formatInventoryPage(inventory: ViewerInventory, page: number): string {
  const tokenEntries = Object.entries(inventory.tokens)
    .filter(([, amount]) => amount > 0)
    .sort(([tokenA, amountA], [tokenB, amountB]) => {
      const priorityDiff = tokenPriority(tokenB) - tokenPriority(tokenA);

      if (priorityDiff !== 0) return priorityDiff;

      return amountB - amountA;
    });

  const activeEntries = inventory.activeBuffs.map((buff) => [
    `active:${buff.tokenId}:${buff.activatedAt}`,
    1,
    formatActiveBuff(buff),
  ] as const);

  const combined = [
    ...activeEntries.map(([id, amount, formatted]) => ({
      id,
      amount,
      formatted: `Active ${formatted}`,
      priority: 999999,
    })),
    ...tokenEntries.map(([id, amount]) => ({
      id,
      amount,
      formatted: formatTokenEntry([id, amount]),
      priority: tokenPriority(id),
    })),
  ];

  if (combined.length === 0) {
    return `${inventory.displayName} Inventory | No tokens | No active buffs`;
  }

  const totalPages = Math.max(1, Math.ceil(combined.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const shown = combined.slice(start, start + PAGE_SIZE);

  const body = shown.map((entry) => entry.formatted).join(" | ");

  return `${inventory.displayName} Inventory p.${safePage}/${totalPages}: ${body}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { channelId, user } = getChannelContext(req);

  if (!user) {
    return error(res, "Inventory only works from Twitch chat.");
  }

  const query = parseQuery(req);
  const page = parsePage(query);
  const inventory = await getViewerInventory(channelId, user);

  return text(res, truncate(formatInventoryPage(inventory, page), 390));
}
