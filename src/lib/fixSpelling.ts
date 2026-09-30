/**
 * Correct the spelling of a clinical field in one press.
 *
 * The browser underlines a misspelt word and offers suggestions on right-click,
 * which is one interaction per word. Doctors asked for the whole field at once.
 *
 * What comes back is checked before it is accepted. A spelling correction has
 * properties a rewrite does not: the same number of words, the same lines, and
 * the same numbers. If the returned text breaks any of those it is a rewrite,
 * not a correction, and the doctor's own text is kept. That guard matters more
 * than the correction itself - a note that quietly gained a sentence, lost a
 * line, or had "500mg" turned into "50mg" would be worse than a typo.
 */

const SPELLING_FUNCTION = "fix-spelling";

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const lines = (text: string) => text.split("\n").length;
/** Every run of digits, in order - doses, strengths, dates, session counts. */
const numbers = (text: string) => text.match(/\d+/g) ?? [];

/**
 * The text to keep: the correction when it is one, the original otherwise.
 */
export function acceptCorrection(original: string, corrected: string | null | undefined): string {
  const next = (corrected ?? "").trim();
  if (!next) return original;
  if (next === original.trim()) return original;

  // A correction replaces words; it does not add or remove them.
  if (words(next).length !== words(original).length) return original;
  // Nor does it reflow the note.
  if (lines(next) !== lines(original)) return original;
  // Nor does it touch a single figure.
  const before = numbers(original);
  const after = numbers(next);
  if (before.length !== after.length || before.some((n, i) => n !== after[i])) return original;

  return next;
}

/** True when the correction actually changed something worth telling the user about. */
export function didChange(original: string, accepted: string): boolean {
  return original.trim() !== accepted.trim();
}

/**
 * Ask the edge function to correct one field. Returns the text to keep, so a
 * failure or a rewrite leaves what the doctor typed exactly as it was.
 */
export async function fixSpelling(text: string): Promise<string> {
  const original = text ?? "";
  if (!original.trim()) return original;

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${SPELLING_FUNCTION}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text: original }),
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error("Spelling check is not deployed yet.");
    const err = await res.json().catch(() => ({ error: "Spelling check failed" }));
    throw new Error(err.error || "Spelling check failed");
  }

  const { text: corrected } = await res.json();
  return acceptCorrection(original, corrected);
}
