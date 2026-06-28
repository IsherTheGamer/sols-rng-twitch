import type { PotionDef } from "../types/data";
import {
  type ProfileTierId,
  type ViewerProfile,
  hasTierAtLeast,
} from "./profile";

export interface PotionRestriction {
  minRolls?: number;
  requiredTier?: ProfileTierId;
  modOnly?: boolean;
  cooldownSeconds: number;
}

const HOUR = 60 * 60;

export const POTION_RESTRICTIONS: Record<string, PotionRestriction> = {
  popping: {
    minRolls: 2500,
    cooldownSeconds: 1 * HOUR,
  },

  bound: {
    minRolls: 5000,
    cooldownSeconds: 4 * HOUR,
  },

  heavenly: {
    minRolls: 10000,
    cooldownSeconds: 8 * HOUR,
  },

  dune: {
    minRolls: 15000,
    cooldownSeconds: 10 * HOUR,
  },

  void_heart: {
    minRolls: 15000,
    cooldownSeconds: 12 * HOUR,
  },

  red_fragment_i: {
    minRolls: 20000,
    requiredTier: "glorious",
    cooldownSeconds: 12 * HOUR,
  },

  godlike: {
    minRolls: 25000,
    cooldownSeconds: 16 * HOUR,
  },

  oblivion: {
    minRolls: 50000,
    cooldownSeconds: 24 * HOUR,
  },

  red_fragment_ii: {
    minRolls: 50000,
    requiredTier: "transcendent",
    cooldownSeconds: 24 * HOUR,
  },

  pump_kings_blood: {
    minRolls: 50000,
    cooldownSeconds: 12 * HOUR,
  },

  axis_potion: {
    minRolls: 150000,
    requiredTier: "challenged+",
    cooldownSeconds: 48 * HOUR,
  },

  xyz_potion: {
    minRolls: 150000,
    requiredTier: "challenged+",
    cooldownSeconds: 48 * HOUR,
  },

  word_potion: {
    minRolls: 150000,
    requiredTier: "challenged+",
    cooldownSeconds: 48 * HOUR,
  },

  chaos_potion: {
    minRolls: 150000,
    requiredTier: "challenged+",
    cooldownSeconds: 48 * HOUR,
  },

  overpowered_potion: {
    modOnly: true,
    requiredTier: "challenged+",
    cooldownSeconds: 60,
  },
};

export function getPotionRestriction(
  potion: PotionDef,
  fallbackCooldownSeconds: number
): PotionRestriction {
  return (
    POTION_RESTRICTIONS[potion.id] ?? {
      cooldownSeconds: fallbackCooldownSeconds,
    }
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function validatePotionRestriction(options: {
  potion: PotionDef;
  profile: ViewerProfile;
  restriction: PotionRestriction;
  isMod: boolean;
}): string | null {
  const { potion, profile, restriction, isMod } = options;

  if (restriction.modOnly && !isMod) {
    return `${potion.name} is mod+ only.`;
  }

  if (restriction.minRolls && profile.rolls < restriction.minRolls) {
    return `${potion.name} requires ${formatNumber(
      restriction.minRolls
    )} rolls. You have ${formatNumber(profile.rolls)}.`;
  }

  if (
    restriction.requiredTier &&
    !hasTierAtLeast(profile, restriction.requiredTier)
  ) {
    const current = profile.highestTierId ?? "none";

    return `${potion.name} requires ${restriction.requiredTier}+ aura. Your best tier: ${current}.`;
  }

  return null;
}
