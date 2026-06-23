export function rollInt(max: number): number {
  return Math.floor(Math.random() * max) + 1;
}

export function rollHit(luck: number, rarity: number): boolean {
  if (rarity <= 0) return false;
  if (luck >= rarity) return true;
  return rollInt(rarity) <= luck;
}

export function pickWeighted<T>(items: T[], weightFn: (item: T) => number): T {
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function pickEqual<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
