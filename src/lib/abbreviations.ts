export const MATERIAL_ABBREVIATIONS: Record<string, string> = {
  scrap: "SC",
  metal_bits: "MB",
  mechanical_scrap: "MS",
  circuit_scrap: "CS",
  signal_fragment: "SIG",
  refined_alloy: "RA",
  stabilized_flux: "STF",
  chrono_dust: "CD",
  quantum_residue: "QR",
  void_glass: "VG",
  stellar_ink: "SI",
  reality_thread: "RT",
  dimensional_seal: "DS",
  anomaly_matter: "AM",
  singularity_shard: "SS",
  glitched_alloy: "GA",
  forbidden_circuit: "FC",
  thermal_paste: "TP",
  conductive_gel: "CG",
  energy_cell: "EC",
  debug_fragment: "DF",
};

export const TOKEN_ABBREVIATIONS: Record<string, string> = {
  recipe_token: "RCP",
  path_token: "PT",
  reactor_token: "RCT",
  crafting_token: "CT",
  quest_token: "QT",
  wall_token: "WT",
  anomaly_token: "AT",
};

const TIER_ABBREVIATIONS = [
  "B",
  "C",
  "R",
  "ST",
  "Q",
  "RE",
  "SG",
  "D",
  "A",
  "F",
] as const;

function words(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function initialism(value: string): string {
  const parts = words(value);
  if (parts.length === 0) return "";

  return parts
    .map((part) => {
      const upper = part.toUpperCase();
      if (upper === "SMD") return "SMD";
      if (/^\d+$/.test(upper)) return upper;
      return upper.charAt(0);
    })
    .join("");
}

export function componentAbbreviation(id: string, label?: string): string {
  const tierMatch = id.match(/_(\d+)$/);
  if (tierMatch) {
    const tier = Math.max(1, Math.min(10, Number(tierMatch[1])));
    const family = id.replace(/_\d+$/, "");
    const familyAbbreviation = initialism(family.replace(/_/g, " "));
    return `${TIER_ABBREVIATIONS[tier - 1]}${familyAbbreviation}`;
  }

  return initialism(label ?? id.replace(/_/g, " "));
}

export function materialAbbreviation(id: string): string {
  return MATERIAL_ABBREVIATIONS[id] ?? initialism(id.replace(/_/g, " "));
}

export function tokenAbbreviation(id: string): string {
  return TOKEN_ABBREVIATIONS[id] ?? initialism(id.replace(/_/g, " "));
}

export function labelWithAbbreviation(label: string, abbreviation: string): string {
  return abbreviation ? `${label} [${abbreviation}]` : label;
}

export function addUniqueAbbreviationAliases<T extends { id: string; label: string; aliases?: readonly string[] }>(
  candidates: readonly T[],
  abbreviationFor: (candidate: T) => string
): T[] {
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    const abbreviation = abbreviationFor(candidate).toLowerCase();
    if (!abbreviation) continue;
    counts.set(abbreviation, (counts.get(abbreviation) ?? 0) + 1);
  }

  return candidates.map((candidate) => {
    const abbreviation = abbreviationFor(candidate);
    if (!abbreviation || counts.get(abbreviation.toLowerCase()) !== 1) {
      return { ...candidate };
    }

    return {
      ...candidate,
      aliases: [...(candidate.aliases ?? []), abbreviation, abbreviation.toLowerCase()],
    };
  });
}
