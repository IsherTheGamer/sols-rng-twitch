import { POTION_COOLDOWN_TIERS } from "./data";

export function getPotionCooldownSeconds(luck: number): number {
  for (const tier of POTION_COOLDOWN_TIERS) {
    if (tier.maxLuck === null || luck <= tier.maxLuck) {
      return tier.seconds;
    }
  }
  return POTION_COOLDOWN_TIERS[POTION_COOLDOWN_TIERS.length - 1].seconds;
}

export const ROLL_COOLDOWN_MS = 10000;

export async function checkCooldown(
  key: string,
  cooldownMs: number
): Promise<{ allowed: boolean; remainingMs: number }> {
  const { getCooldown } = await import("./state");
  const until = await getCooldown(key);
  const now = Date.now();
  if (until > now) {
    return { allowed: false, remainingMs: until - now };
  }
  return { allowed: true, remainingMs: 0 };
}

export async function applyCooldown(key: string, cooldownMs: number): Promise<void> {
  const { setCooldown } = await import("./state");
  await setCooldown(key, Date.now() + cooldownMs);
}
