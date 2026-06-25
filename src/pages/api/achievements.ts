import type { NextApiRequest, NextApiResponse } from "next";
import { getAchievementMenuLine } from "@/lib/global-stats";
import { text } from "@/lib/api-helpers";

function getArgs(req: NextApiRequest): string[] {
  const raw = ((req.query.args as string) ?? "").trim();

  if (!raw) return [];

  return raw.split(/\s+/).filter(Boolean);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const args = getArgs(req);

  const category = args[0];
  const page = args[1];

  const msg = await getAchievementMenuLine(category, page);

  return text(res, msg);
}
