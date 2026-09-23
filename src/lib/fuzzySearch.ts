// Shared fuzzy-matching helpers for patient (and similar) lookups.

export const normalize = (s: string) =>
  (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export const tokenize = (s: string) => normalize(s).split(" ").filter(Boolean);

/** Escapes characters that break PostgREST `or(...)` filters. */
export const sanitizeTerm = (s: string) => (s || "").replace(/[%,()*]/g, " ").trim();

/**
 * Builds a tight filter that prioritizes exact full-name matches.
 * For "abhishek shenoy", matches "first_name LIKE abhishek AND last_name LIKE shenoy" first.
 * Falls back to individual token matching if no two-token input.
 */
export const buildOrFilter = (term: string, columns: string[]) => {
  const tokens = sanitizeTerm(term).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  // If searching with 2+ tokens (e.g., "abhishek shenoy"),
  // prioritize matches where first_name matches first token AND last_name matches second token
  if (tokens.length >= 2) {
    const [firstName, ...restTokens] = tokens;
    const filters = [
      `and(first_name.ilike.%${firstName}%,last_name.ilike.%${restTokens.join(" ")}%)`,
    ];
    // Also add single-token exact matches as fallback
    filters.push(
      tokens
        .flatMap((t) => ["first_name", "last_name", "email", "phone"].map((c) => `${c}.ilike.%${t}%`))
        .join(",")
    );
    return filters.join(",");
  }

  // Single token: search in priority order (name > contact)
  return tokens
    .flatMap((t) => ["first_name", "last_name", "email", "phone"].map((c) => `${c}.ilike.%${t}%`))
    .join(",");
};

/**
 * One PostgREST `or(...)` expression per token, each covering every column.
 *
 * Applied as SEPARATE `.or()` calls, which PostgREST ANDs together, so a record
 * has to contain every token somewhere:
 *
 *   .or("first_name.ilike.%nisha%,last_name.ilike.%nisha%,…")
 *   .or("first_name.ilike.%rai%,last_name.ilike.%rai%,…")
 *
 * This is what buildOrFilter could not do. It comma-joins everything into one
 * `or`, so "nisha rai" matched any record containing nisha OR rai - returning
 * Dr Supriya Rai, NISHA DSOUZA, Punya Rai and Sulan Raiker (that last on the
 * substring "rai"), while the actual Anisha Rai was nowhere near the top.
 *
 * Substring matching is deliberate: "nisha" has to keep finding "Anisha", who is
 * exactly the person such a search is looking for.
 */
export const buildTokenFilters = (term: string, columns: string[]): string[] => {
  const tokens = Array.from(new Set(sanitizeTerm(term).split(/\s+/).filter(Boolean)));
  if (tokens.length === 0 || columns.length === 0) return [];
  return tokens.map((t) => columns.map((c) => `${c}.ilike.%${t}%`).join(","));
};

/** Loose filter used for the typo-tolerant fallback query (first 3 chars of each token). */
export const buildFuzzyOrFilter = (term: string, columns: string[]) => {
  const tokens = sanitizeTerm(term)
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => t.slice(0, 3));
  if (tokens.length === 0) return "";
  return Array.from(new Set(tokens))
    .flatMap((t) => columns.map((c) => `${c}.ilike.%${t}%`))
    .join(",");
};

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 similarity of a search term against a haystack (name, phone, email...). */
export function fuzzyScore(term: string, haystack: string): number {
  const t = normalize(term);
  const h = normalize(haystack);
  if (!t || !h) return 0;
  if (h.includes(t)) return 1;
  const words = h.split(" ");
  // The WEAKEST token decides the score, not the strongest. Taking the best
  // token meant "Punya Rai" scored a perfect 1 against "nisha rai" purely on
  // "rai", so half the Rais in the clinic outranked the person being looked for.
  // Every token has to find something for a row to rank well. With one token
  // this is identical to what it did before.
  let worst = 1;
  for (const tok of t.split(" ")) {
    let tokBest = 0;
    for (const w of words) {
      if (w.startsWith(tok) || tok.startsWith(w)) {
        tokBest = Math.max(tokBest, 0.9);
        continue;
      }
      const d = levenshtein(tok, w);
      const sim = 1 - d / Math.max(tok.length, w.length);
      tokBest = Math.max(tokBest, sim);
    }
    worst = Math.min(worst, tokBest);
  }
  return worst;
}

/** Ranks and filters rows by fuzzy similarity against the given text accessor. */
export function fuzzyRank<T>(
  rows: T[],
  term: string,
  getText: (row: T) => string,
  threshold = 0.6
): T[] {
  return rows
    .map((row) => ({ row, score: fuzzyScore(term, getText(row)) }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.row);
}