import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { formatTokenList } from "@/lib/inventory";
import { truncate } from "@/lib/format";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = parseQuery(req);

  return text(res, truncate(formatTokenList(query), 390));
}
