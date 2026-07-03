import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { getChannelContext } from "@/lib/nightbot";
import { formatBoxesStatus, openLootbox } from "@/lib/core-system";

function parseBoxOpenArgs(args: string[]): { box: string; amount: string } {
  const boxParts = [...args];
  let amount = "1";

  const last = boxParts[boxParts.length - 1];

  if (last && /^\d{1,5}$/.test(last)) {
    amount = last;
    boxParts.pop();
  }

  const box = boxParts.join(" ");

  return {
    box: box || "quest_box",
    amount,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, user } = getChannelContext(req);
  const args = parseQuery(req).trim().split(/\s+/).filter(Boolean);
  const action = (args[0] ?? "").toLowerCase();

  if (action === "open") {
    const parsed = parseBoxOpenArgs(args.slice(1));

    return text(
      res,
      await openLootbox(channelId, user, parsed.box, parsed.amount)
    );
  }

  return text(res, await formatBoxesStatus(channelId, user));
}
