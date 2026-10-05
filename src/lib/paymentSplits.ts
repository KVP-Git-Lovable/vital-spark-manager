/**
 * A bill paid in more than one way.
 *
 * The clinic takes a single payment across two modes often enough that the
 * create form offers it: Basavaraju's ₹32,175 was ₹30,000 cash and ₹2,175 UPI.
 * The rows are stored on the invoice in payment_splits, and payment_mode reads
 * "Split" so every list and the printed copy can say so in one word.
 *
 * These rules lived inline in the create path, which is why Edit Invoice had
 * none of them: it offered a mode list with no "Split" in it, so the box came up
 * blank, and it saved payment_mode without ever touching the rows underneath -
 * one click from a bill that said "Cash" above two payments that said otherwise.
 * One copy now, used by both forms.
 */

export interface PaymentSplit {
  mode: string;
  amount: number;
}

/** The rows stored on an invoice, or none. */
export function splitsFromInvoice(stored: unknown): PaymentSplit[] {
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({ mode: String(row.mode ?? ""), amount: Number(row.amount) || 0 }));
}

export function splitTotal(rows: PaymentSplit[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

/**
 * What payment_mode should say.
 *
 * One row names its own mode - a "split" of one is just that payment. Two or
 * more read "Split". No rows at all leave the single mode the form holds.
 */
export function paymentModeForSplits(rows: PaymentSplit[], fallback: string): string {
  if (rows.length === 0) return fallback;
  return rows.length === 1 ? rows[0].mode : "Split";
}

/**
 * Why these rows cannot be saved, or null when they can.
 *
 * Compared in paise, because 30000 + 2175 and 32175 are the same money however
 * the browser adds them up.
 */
export function splitProblem(rows: PaymentSplit[], paidAmount: number): string | null {
  if (rows.length === 0) return null;
  if (rows.some((row) => !row.mode)) return "Each split row needs a payment mode";
  if (rows.some((row) => !(Number(row.amount) > 0))) return "Each split row needs an amount above zero";
  if (Math.round(splitTotal(rows) * 100) !== Math.round((Number(paidAmount) || 0) * 100)) {
    return "Split amounts must equal paid amount";
  }
  return null;
}
