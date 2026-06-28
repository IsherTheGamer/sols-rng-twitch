import type { NextApiRequest, NextApiResponse } from "next";
import { text } from "@/lib/api-helpers";

const INFO = [
  "!roll — Roll an aura",
  "!roll N — Mod: roll N×4, show N rarest max 5",
  "!pop (potion) — Use a potion",
  "!popop (potion) N — Mod: pop up to 4",
  "!biome — Current biome + time",
  "!changebiome (name) — Mod: force biome",
  "!event (name|off) — Mod: toggle event",
  "!dev (name|off) — Mod: dev biome 1h",
  "!device (name) — Strange Controller / Biome Randomizer",
  "!rollop (aura) — Mod: force roll aura",
  "!profile — Show your rolls + best auras",
  "!achievements — Show achievement categories",
  "!achievements (category) (page) — View achievements",
  "!counter — Show counter categories",
  "!counter (category) (page) — View counters",
  "!announce — Mod: show announcement settings",
  "!announce on/off — Mod: toggle global announcements",
  "!announce roll (tier) — Mod: set roll announce tier",
  "!announce potion (tier) — Mod: set potion announce tier",
  "!solinfo (page) — This command list",
];

const MAX_CHARS = 100;

function buildPages() {
  const pages: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const item of INFO) {
    const addLen = item.length + 3;

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
    return text(res, `No page ${page}. Use !solinfo 1-${pages.length}`);
  }

  const nextHint =
    index + 1 < pages.length ? ` | next: !solinfo ${page + 1}` : "";

  return text(res, pages[index] + nextHint);
}
