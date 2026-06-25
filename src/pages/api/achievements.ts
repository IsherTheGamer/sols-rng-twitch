import type { NextApiRequest, NextApiResponse } from "next";
import {
  getAchievementProgress,
  getAchievementBonuses,
} from "@/lib/global-stats";
import { text } from "@/lib/api-helpers";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const progress = await getAchievementProgress();
  const bonuses = await getAchievementBonuses();

  return text(
    res,
    `${progress} | +Luck ${bonuses.flatLuck} | x${bonuses.finalLuckMultiplier.toFixed(
      2
    )} | +Rolls ${bonuses.extraRolls} | CD -${bonuses.cooldownReductionSeconds}s`
  );
}
