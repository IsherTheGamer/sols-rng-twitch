import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatBoxesStatus, openLootbox } from "@/lib/core-system";
import { resolveBox, resolveTextAlias } from "@/lib/command-aliases";

function parseBoxOpenArgs(args: string[]): { box: string; amount: string } {
  const boxParts = [...args];
  let amount = "1";
  const last = boxParts[boxParts.length - 1];
  if (last && /^\d{1,5}$/.test(last)) {
    amount = last;
    boxParts.pop();
  }
  return { box: boxParts.join(" ") || "quest_box", amount };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);

  if (args.length === 0 || /^\d+$/.test(args[0])) {
    return text(res, await formatBoxesStatus(channelId, user, args[0] ?? "1"));
  }

  const action = resolveTextAlias(
    args[0],
    [
      { id: "open", label: "open", aliases: ["use", "unbox", "claim"], value: "open" as const },
      { id: "status", label: "status", aliases: ["list", "show", "inventory"], value: "status" as const },
    ],
    "box action"
  );

  if (!action.value) return text(res, action.error ?? "Unknown box action.");
  if (action.value === "status") return text(res, await formatBoxesStatus(channelId, user, args[1] ?? "1"));

  const parsed = parseBoxOpenArgs(args.slice(1));
  const box = resolveBox(parsed.box);
  if (!box.value) return text(res, box.error ?? "Unknown box.");

  return text(res, await openLootbox(channelId, user, box.value, parsed.amount));
}
