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
  const chunk = Number(req.query.chunk ?? 1);

  // how many commands per message (safe for Nightbot)
  const PER_PAGE = 3;

  const start = (chunk - 1) * PER_PAGE;
  const page = INFO.slice(start, start + PER_PAGE);

  const next = start + PER_PAGE < INFO.length ? ` | next: !solinfo ${chunk + 1}` : "";

  return text(res, page.join(" | ") + next);
}
