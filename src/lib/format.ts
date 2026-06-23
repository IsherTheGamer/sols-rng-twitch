export function formatRarity(rarity: number): string {
  return `1/${rarity.toLocaleString("en-US")}`;
}

export function formatRollResult(
  displayName: string,
  auraName: string,
  rarity: number
): string {
  return `${displayName} rolled ${auraName} (${formatRarity(rarity)})`;
}

export function formatPopResult(
  displayName: string,
  potionName: string,
  auraName: string,
  rarity: number
): string {
  return `${displayName} popped ${potionName} and got: ${auraName} (${formatRarity(rarity)})`;
}

export function formatBiomeStatus(
  biomeName: string,
  remaining: string,
  timeOfDay: string
): string {
  return `Active biome: ${biomeName} — ${remaining} remaining | Time: ${timeOfDay.toUpperCase()}`;
}

export function truncate(msg: string, max = 390): string {
  if (msg.length <= max) return msg;
  return msg.slice(0, max - 3) + "...";
}

export function formatMultiRoll(
  results: Array<{ name: string; rarity: number }>
): string {
  const parts = results.map((r) => `${r.name} (${formatRarity(r.rarity)})`);
  return truncate(parts.join(" | "));
}
