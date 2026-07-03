import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { formatSolInfo } from "@/lib/sol-info";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return text(res, formatSolInfo(parseQuery(req)));
}
