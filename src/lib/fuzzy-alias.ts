export interface AliasCandidate<T> {
  id: string;
  label: string;
  aliases?: readonly string[];
  value: T;
}

export interface AliasSuggestion<T> {
  id: string;
  label: string;
  value: T;
  score: number;
  matchedAlias: string;
}

export type AliasResolution<T> =
  | {
      status: "matched";
      match: AliasSuggestion<T>;
      corrected: boolean;
    }
  | {
      status: "ambiguous";
      suggestions: AliasSuggestion<T>[];
    }
  | {
      status: "none";
      suggestions: AliasSuggestion<T>[];
    };

export interface ResolveAliasOptions {
  /** Maximum suggestions retained for error messages. */
  suggestionLimit?: number;
  /** Lower means stricter. Most commands should leave this automatic. */
  maxScore?: number;
  /** Minimum score gap required before automatically choosing the best match. */
  ambiguityGap?: number;
  /** Exact/compact-exact aliases always win before fuzzy scoring. */
  allowSubstring?: boolean;
}

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};

function deaccent(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalization intentionally keeps word boundaries. This makes inputs such as
 * "circuit bored", "circuit-board", and "Circuit_Board" comparable while
 * still preventing a short typo from matching every item containing the word.
 */
export function normalizeAlias(input: string | undefined | null): string {
  const raw = deaccent(String(input ?? ""))
    .toLowerCase()
    .replace(/^!+/, "")
    .replace(/[013457]/g, (char) => LEET_MAP[char] ?? char)
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return raw;
}

export function compactAlias(input: string | undefined | null): string {
  return normalizeAlias(input).replace(/\s+/g, "");
}

function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0)
  );

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(
          matrix[i][j],
          matrix[i - 2][j - 2] + cost
        );
      }
    }
  }

  return matrix[a.length][b.length];
}

function ratio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length, 1);
  return damerauLevenshtein(a, b) / longest;
}

function tokenRatio(a: string, b: string): number {
  const left = a.split(" ").filter(Boolean);
  const right = b.split(" ").filter(Boolean);
  if (left.length === 0 || right.length === 0) return 1;

  // Ordered dynamic-programming alignment. This handles a missing/extra word
  // without allowing a completely shuffled phrase to look exact.
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0)
  );

  for (let i = 1; i < rows; i++) dp[i][0] = i * 0.55;
  for (let j = 1; j < cols; j++) dp[0][j] = j * 0.55;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const substitution = ratio(left[i - 1], right[j - 1]);
      dp[i][j] = Math.min(
        dp[i - 1][j] + 0.55,
        dp[i][j - 1] + 0.55,
        dp[i - 1][j - 1] + substitution
      );
    }
  }

  return dp[left.length][right.length] / Math.max(left.length, right.length);
}

function autoThreshold(normalizedQuery: string): number {
  const compactLength = normalizedQuery.replace(/\s+/g, "").length;
  if (compactLength <= 3) return 0;
  if (compactLength <= 5) return 0.22;
  if (compactLength <= 8) return 0.28;
  if (compactLength <= 14) return 0.31;
  return 0.34;
}

function unorderedTokenCoverage(query: string, alias: string): number {
  const queryTokens = query.split(" ").filter(Boolean);
  const aliasTokens = alias.split(" ").filter(Boolean);
  if (queryTokens.length === 0 || aliasTokens.length === 0) return 1;

  const queryToAlias =
    queryTokens.reduce(
      (sum, token) =>
        sum + Math.min(...aliasTokens.map((candidate) => ratio(token, candidate))),
      0
    ) / queryTokens.length;

  const aliasToQuery =
    aliasTokens.reduce(
      (sum, token) =>
        sum + Math.min(...queryTokens.map((candidate) => ratio(token, candidate))),
      0
    ) / aliasTokens.length;

  return queryToAlias * 0.65 + aliasToQuery * 0.35;
}

function scoreAlias(query: string, alias: string, allowSubstring: boolean): number {
  const q = normalizeAlias(query);
  const a = normalizeAlias(alias);
  const qc = q.replace(/\s+/g, "");
  const ac = a.replace(/\s+/g, "");

  if (!q || !a) return 1;
  if (q === a || qc === ac) return 0;

  let score = Math.min(ratio(q, a), ratio(qc, ac), tokenRatio(q, a));
  const queryTokens = q.split(" ").filter(Boolean);
  const aliasTokens = a.split(" ").filter(Boolean);

  if (allowSubstring && Math.min(qc.length, ac.length) >= 5) {
    if (ac.startsWith(qc) || qc.startsWith(ac)) score = Math.min(score, 0.12);
    else if (ac.includes(qc) || qc.includes(ac)) score = Math.min(score, 0.18);
  }

  // Apply phrase coverage last so a generic one-word substring cannot erase
  // the penalty for ignoring the user's other words.
  if (queryTokens.length > 1 || aliasTokens.length > 1) {
    const coverage = unorderedTokenCoverage(q, a);
    score = Math.max(score, coverage * 0.88);

    if (queryTokens.length > 1 && aliasTokens.length === 1) {
      score = Math.min(1, score + 0.09);
    }
  }

  return score;
}

function candidateAliases<T>(candidate: AliasCandidate<T>): string[] {
  return Array.from(
    new Set([candidate.id, candidate.label, ...(candidate.aliases ?? [])])
  ).filter(Boolean);
}

/**
 * Fuzzy-resolves a user-facing name while refusing close ties. Write commands
 * should treat both `ambiguous` and `none` as a hard stop before spending.
 */
export function resolveAlias<T>(
  query: string,
  candidates: readonly AliasCandidate<T>[],
  options: ResolveAliasOptions = {}
): AliasResolution<T> {
  const normalizedQuery = normalizeAlias(query);
  const compactQuery = compactAlias(query);
  const suggestionLimit = Math.max(1, options.suggestionLimit ?? 3);
  const allowSubstring = options.allowSubstring ?? true;

  if (!normalizedQuery) {
    return { status: "none", suggestions: [] };
  }

  // Exact matches are deterministic and bypass fuzzy ambiguity.
  for (const candidate of candidates) {
    for (const alias of candidateAliases(candidate)) {
      const normalizedAlias = normalizeAlias(alias);
      if (
        normalizedAlias === normalizedQuery ||
        compactAlias(alias) === compactQuery
      ) {
        return {
          status: "matched",
          match: {
            id: candidate.id,
            label: candidate.label,
            value: candidate.value,
            score: 0,
            matchedAlias: alias,
          },
          corrected: normalizedAlias !== normalizedQuery,
        };
      }
    }
  }

  const ranked = candidates
    .map((candidate): AliasSuggestion<T> => {
      let bestScore = 1;
      let bestAlias = candidate.label;

      for (const alias of candidateAliases(candidate)) {
        const score = scoreAlias(normalizedQuery, alias, allowSubstring);
        if (score < bestScore) {
          bestScore = score;
          bestAlias = alias;
        }
      }

      return {
        id: candidate.id,
        label: candidate.label,
        value: candidate.value,
        score: bestScore,
        matchedAlias: bestAlias,
      };
    })
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));

  const threshold = options.maxScore ?? autoThreshold(normalizedQuery);
  const acceptable = ranked.filter((item) => item.score <= threshold);

  if (acceptable.length === 0) {
    return {
      status: "none",
      suggestions: ranked.slice(0, suggestionLimit),
    };
  }

  const best = acceptable[0];
  const second = acceptable[1];
  const requiredGap = options.ambiguityGap ?? 0.055;

  if (second) {
    const absoluteGap = second.score - best.score;
    const relativeGap = absoluteGap / Math.max(best.score, 0.04);

    if (absoluteGap < requiredGap || relativeGap < 0.28) {
      return {
        status: "ambiguous",
        suggestions: acceptable.slice(0, suggestionLimit),
      };
    }
  }

  return {
    status: "matched",
    match: best,
    corrected: true,
  };
}

export function aliasSuggestionText<T>(
  resolution: Extract<AliasResolution<T>, { status: "ambiguous" | "none" }>,
  subject: string
): string {
  if (resolution.suggestions.length === 0) {
    return `Unknown ${subject}.`;
  }

  const names = resolution.suggestions.map((item) => item.label).join(", ");

  return resolution.status === "ambiguous"
    ? `Ambiguous ${subject}. Be more specific: ${names}.`
    : `Unknown ${subject}. Closest: ${names}.`;
}
