import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery, text } from "@/lib/api-helpers";
import { formatUpdateNotes } from "@/lib/social-system";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return text(res, formatUpdateNotes(parseQuery(req)));
}
