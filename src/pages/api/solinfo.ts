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

const MAX_CHARS = 100;

// build pages based on character limit
function buildPages() {
  const pages: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const item of INFO) {
    const addLen = item.length + 3; // " | "

    if (length + addLen > MAX_CHARS && current.length > 0) {
      pages.push(current.join(" | "));
      current = [];
      length = 0;
    }

    current.push(item);
    length += addLen;
  }

  if (current.length) {
    pages.push(current.join(" | "));
  }

  return pages;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const pages = buildPages();

  const raw = (req.query.args as string) ?? "1";
  const page = Math.max(1, parseInt(raw, 10) || 1);

  const index = page - 1;

  if (index < 0 || index >= pages.length) {
    return text(
      res,
      `No page ${page}. Use !solinfo 1-${pages.length}`
    );
  }

  const nextHint =
    index + 1 < pages.length ? ` | next: !solinfo ${page + 1}` : "";

  return text(res, pages[index] + nextHint);
}
