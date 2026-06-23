import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getChannelState } from "@/lib/state";
import { findAuraByQuery } from "@/lib/data";
import { rollOnce } from "@/lib/roll-engine";
import { text, error, parseQuery } from "@/lib/api-helpers";
import { formatRollResult } from "@/lib/format";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName, user, isMod } = getChannelContext(req);
  if (!isMod) return error(res, "Mod only.");

  const query = parseQuery(req);
  if (!query) return error(res, "Usage: !rollop aura name (e.g. chromatic:genesis)");

  const aura = findAuraByQuery(query);
  if (!aura) return error(res, `Aura not found: ${query}`);

  const state = await getChannelState(channelId, channelName);
  const result = rollOnce({
    state,
    luck: 1,
    forceAuraId: aura.id,
    includeDeleted: true,
    includeUnobtainable: true,
  });

  const name = user?.displayName ?? user?.name ?? "Mod";
  return text(res, formatRollResult(name, result.aura.name, result.effectiveRarity));
}
