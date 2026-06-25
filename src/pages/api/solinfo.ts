import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";

const INFO = [
  "!roll — Roll an aura (10s cd)",
  "!roll N — Mod: roll N×4 (max 5)",
  "!pop (potion) — Pop a luck potion",
  "!popop (potion) N — Mod: pop up to 5",
  "!biome — Current biome + time",
  "!changebiome (name) — Mod: force biome",
  "!event (name|off) — Toggle event",
  "!dev (name|off) — Dev biome 1h",
  "!device (name) — Controller / Randomizer",
  "!rollop (aura) — Mod: force aura",
  "!solinfo — Command list",
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ FIX: read Nightbot args properly
  const raw = (req.query.args as string) ?? "1";
  const chunk = Math.max(1, parseInt(raw, 10) || 1);

  const PER_PAGE = 3;

  const start = (chunk - 1) * PER_PAGE;
  const page = INFO.slice(start, start + PER_PAGE);

  const hasNext = start + PER_PAGE < INFO.length;

  const nextText = hasNext
    ? ` | next: !solinfo ${chunk + 1}`
    : "";

  return text(res, page.join(" | ") + nextText);
}
