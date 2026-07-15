import { Redis } from "@upstash/redis";

const INFO_SUFFIX = "Use !info for more info.";

const SOL_RNG_TIPS = [
  "Use !roll followed by a number to multi-roll. Your role determines your current maximum.",
  "Viewers can roll up to 10 at once, VIPs and subscribers up to 25, and moderators up to 50.",
  "Trusted and allowlisted users can multi-roll up to 10,000 at once.",
  "Use !biome to check the current biome and how much time remains.",
  "Use !luck to see the boosts affecting your current rolls.",
  "Use !profile to check your roll totals, progression, and account stats.",
  "Use !recent to revisit your latest notable rolls.",
  "Use !info aura <name> to look up an aura and its rarity information.",
  "Use !core recipe to inspect what your next Core upgrade needs.",
  "Core progression gives permanent luck, so remember to craft your next chassis and frame.",
  "The Stellar Hard-Drive stores Stardust. Fill it before attempting an SHD upgrade.",
  "Use !shd to view your Stellar Hard-Drive level, capacity, and next requirement.",
  "Mechanical Scrap is earned from rolling and is an important early crafting limiter.",
  "Circuit Scrap starts dropping from auras with rarity 1/450 or higher.",
  "Rare rolls can drop advanced materials used by later Core and component tiers.",
  "Use !craft recipe <item> before spending materials on a complicated component.",
  "Tier 1-5 components normally craft two outputs per batch.",
  "Tier 6-7 components have a built-in chance to duplicate a crafting batch.",
  "Use !pquests to check personal quests and !gquests to check global quests.",
  "Daily and weekly quests can supply materials, tokens, boxes, and progression rewards.",
  "Use !knowledge to see Knowledge, Merchant Marks, Relic Shards, and research progress.",
  "Research unlocks permanent systems, including the Relic Forge.",
  "Use !relics to view, forge, collect, equip, or inspect your relics.",
  "Core luck improves both aura rolling and parts of the relic system.",
  "Use !market to view rotating items and your available Merchant Marks.",
  "Boss activity can reward Knowledge, Merchant Marks, Relic Shards, and blueprint fragments.",
  "Use !forecast to inspect upcoming Activity of Knowledge events.",
  "Use !scanner to check your current scanner level and available discoveries.",
  "Seasonal events can unlock special biomes and event-exclusive aura pools.",
  "Use !event list to check currently active seasonal channel events.",
  "Use !titles to see unlocked titles and !title to equip one.",
  "Use !flex to show off your best recent result or progression milestone.",
  "Use !records and !firsts to inspect server-wide achievements and discoveries.",
  "Some rare biomes greatly change which auras are native or obtainable, so watch !biome.",
  "One-time roll tokens may be consumed during a roll, so check the token summary afterward.",
  "Your hidden multi-roll limit bonus increases at major lifetime-roll milestones.",
  "Use !active to check active boosts, events, merchants, and temporary effects.",
  "Use !update to see the newest systems and balance changes added to the bot.",
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
  return `💡 Sol's RNG Tip: ${tip} ${INFO_SUFFIX}`.replace(/\s+/g, " ").trim().slice(0, 400);
}

export async function getNextFunFact(channelId: string): Promise<string> {
  const r = getRedis();
  let index = Math.floor(Date.now() / 60000);

  if (r) {
    try {
      const next = await r.incr(indexKey(channelId));
      index = Math.max(0, next - 1);
    } catch {
      // Fall back to a time-based index if Redis temporarily fails.
    }
  }

  const tip = SOL_RNG_TIPS[index % SOL_RNG_TIPS.length];
  return formatFunFact(tip);
}
