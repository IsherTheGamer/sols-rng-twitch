import { Redis } from "@upstash/redis";

const INFO_SUFFIX = "Use !info for more info.";

const SOL_RNG_TIPS = [
  "Use !roll followed by a number to multi-roll. Your role determines your maximum.",
  "Viewers can roll 10 at once, VIPs/subscribers 25, and moderators 50.",
  "Trusted and allowlisted users can multi-roll up to 10,000 at once.",
  "Use !biome to check the current biome and remaining time.",
  "Use !luck to see the boosts affecting your current rolls.",
  "Use !profile to check progression and account stats.",
  "Use !info aura <name> to look up an aura and its conditions.",
  "Use !info material circuit_scrap to learn that Circuit Scrap drops from 1/450+ rolls.",
  "Use !info obtain <item> whenever you do not know where an item comes from.",
  "Mechanical Scrap is guaranteed once every 5 successful aura rolls.",
  "Use !craft recipe <item> before spending materials on a complicated component.",
  "Tier 1-5 components normally craft two outputs per batch.",
  "Tier 6-7 components have a built-in duplicate-batch chance.",
  "Core progression gives permanent luck, so keep building chassis, frames, and cores.",
  "The Stellar Hard-Drive stores Stardust and must be full before upgrading.",
  "Use !pquests for personal quests and !gquests for global quests.",
  "Use !knowledge to see Knowledge, Merchant Marks, Relic Shards, and research.",
  "Use !relics to view, forge, collect, equip, or inspect relics.",
  "Use !market to view rotating Merchant Mark offers.",
  "Use !scanner to check activity signals and available discoveries.",
  "Use !records and !firsts to inspect server achievements and discoveries.",
  "Use !update to see the newest systems and balance changes.",
];

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

function indexKey(channelId: string): string {
  return `fun-fact:index:${channelId}`;
}

export function formatFunFact(tip: string): string {
  return `💡 Sol's RNG Tip: ${tip} ${INFO_SUFFIX}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

export async function getNextFunFact(channelId: string): Promise<string> {
  const r = getRedis();
  let index = Math.floor(Date.now() / 60000);

  if (r) {
    try {
      const next = await r.incr(indexKey(channelId));
      index = Math.max(0, next - 1);
    } catch {
      // Time-based fallback.
    }
  }

  return formatFunFact(SOL_RNG_TIPS[index % SOL_RNG_TIPS.length]);
}
