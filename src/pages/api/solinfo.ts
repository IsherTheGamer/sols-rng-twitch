import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";

const INFO = [
  "!roll — Roll an aura (10s cd)",
  "!roll N — Mod: roll N×4, show N rarest (max 5)",
  "!pop (potion) — Pop a luck potion (cd by tier)",
  "!popop (potion) N — Mod: pop up to 5",
  "!biome — Current biome + time",
  "!changebiome (name) — Mod: force biome",
  "!event (name|off) — Mod: toggle event",
  "!dev (name|off) — Mod: dev biome 1h",
  "!device (name) — Strange Controller / Biome Randomizer",
  "!rollop (aura) — Mod: force roll aura",
  "!solinfo — This list",
].join(" | ");

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return text(res, INFO);
}
