import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";
import { formatAuraOfDay } from "@/lib/mega-feature-system";
export default async function handler(req: NextApiRequest, res: NextApiResponse) { return text(res, formatAuraOfDay()); }
