import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { craftByIdAmount, formatCraftRecipe } from "@/lib/core-system";
import { resolveCraftItem, resolveTextAlias } from "@/lib/command-aliases";

function isAmountToken(input: string | undefined): boolean {
  return /^\d{1,7}(k|m)?$/i.test(input ?? "");
}

function parseAmount(raw: string): number {
  const match = raw.toLowerCase().match(/^(\d+)(k|m)?$/);
  const base = Number(match?.[1] ?? 1);
  const suffix = match?.[2];
  const amount = suffix === "m" ? base * 1_000_000 : suffix === "k" ? base * 1_000 : base;
  return Math.max(1, Math.min(10_000, amount));
}

function parseRecipeItem(args: string[]): string {
  if (args.length <= 2) return args.join(" ");
  const last = args[args.length - 1];
  return isAmountToken(last) ? args.slice(0, -1).join(" ") : args.join(" ");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);

  if (args.length === 0) {
    return text(res, "Use !craft <component> [amount], !craft chassis, !craft frame, or !craft recipe <item>.");
  }

  const recipeAction = resolveTextAlias(
    args[0],
    [{ id: "recipe", label: "recipe", aliases: ["recepie", "recipie", "cost", "requirements"], value: "recipe" as const }],
    "craft action"
  );

  if (recipeAction.value) {
    const rawItem = parseRecipeItem(args.slice(1));
    if (!rawItem) return text(res, "Use !craft recipe <item>.");
    const item = resolveCraftItem(rawItem);
    if (!item.value) return text(res, item.error ?? "Unknown crafting item.");
    return text(res, await formatCraftRecipe(channelId, user, item.value));
  }

  let amount = 1;
  const last = args[args.length - 1];
  if (isAmountToken(last)) {
    amount = parseAmount(last);
    args.pop();
  }

  const rawItem = args.join(" ");
  if (!rawItem) return text(res, "Use !craft <component> [amount]. Example: !craft wire_1 100");

  const item = resolveCraftItem(rawItem);
  if (!item.value) return text(res, item.error ?? "Unknown crafting item.");

  return text(res, await craftByIdAmount(channelId, user, item.value, amount));
}
