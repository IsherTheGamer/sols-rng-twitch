import type { NextApiRequest, NextApiResponse } from "next";
import {
  getGlobalRolls,
  getGlobalLuck,
  getNextLuckMilestone,
} from "@/lib/global-stats";
import { text } from "@/lib/api-helpers";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const rolls = await getGlobalRolls();
  const luck = getGlobalLuck(rolls);
  const next = getNextLuckMilestone(rolls);

  return text(
    res,
    `Global rolls: ${rolls} | Luck: ${luck}x | Next: ${next.target} (${next.remaining} left)`
  );
}
