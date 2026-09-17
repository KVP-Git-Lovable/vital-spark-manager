/**
 * Grouping the many spellings of a payment mode into the handful of
 * instruments the clinic actually reconciles against.
 *
 * Invoices raised in this app store one of five modes (Cash, Card, UPI,
 * Cheque, Bank Transfer). Everything imported from Salesforce does not: that
 * history carries "Google Pay", "Credit Card", "Part-Payment" and friends. A
 * report that lists those verbatim cannot answer "how much came in on UPI
 * yesterday", which is the question the collection figure is for.
 */

export const PAYMENT_BUCKETS = ["UPI", "Cash", "Card", "Bank Transfer", "Cheque", "Other"] as const;
export type PaymentBucket = (typeof PAYMENT_BUCKETS)[number];

/**
 * Matched in order, first hit wins, so the more specific spellings come first.
 * Note there is deliberately no bare "pay" rule: "Part-Payment" is a Salesforce
 * value meaning the bill was only partly settled, not an instrument, and a
 * "pay" rule would file it under UPI.
 */
const RULES: { bucket: PaymentBucket; needles: string[] }[] = [
  { bucket: "UPI", needles: ["upi", "google pay", "googlepay", "g pay", "gpay", "phonepe", "phone pe", "paytm", "bhim", "qr code", "scan and pay"] },
  { bucket: "Cheque", needles: ["cheque", "check", "demand draft"] },
  { bucket: "Bank Transfer", needles: ["bank transfer", "banktransfer", "net banking", "netbanking", "neft", "imps", "rtgs", "wire", "online transfer", "bank"] },
  { bucket: "Card", needles: ["credit card", "debit card", "credit/debit", "card", "swipe", "pos machine", "visa", "mastercard", "rupay"] },
  { bucket: "Cash", needles: ["cash"] },
];

export function paymentBucket(mode: string | null | undefined): PaymentBucket {
  const value = String(mode ?? "").trim().toLowerCase();
  if (!value) return "Other";
  for (const rule of RULES) {
    if (rule.needles.some((needle) => value.includes(needle))) return rule.bucket;
  }
  return "Other";
}

export interface PaidRow {
  paid_amount?: number | string | null;
  payment_mode?: string | null;
  payment_splits?: unknown;
}

interface Split {
  mode?: string | null;
  amount?: number | string | null;
}

const splitsOf = (row: PaidRow): Split[] =>
  Array.isArray(row?.payment_splits) ? (row.payment_splits as Split[]) : [];

interface Attribution {
  bucket: PaymentBucket;
  /** The mode exactly as it is stored, trimmed. "" when nothing was recorded. */
  mode: string;
  amount: number;
}

/**
 * Every rupee of `paid_amount`, attributed to the mode it was paid with.
 *
 * One walk over the rows, so the bucket totals and the breakdown of what is
 * inside a bucket can never disagree about where a payment went.
 *
 * A split payment is broken up across its parts; anything left over between the
 * splits and `paid_amount` is attributed to the invoice's own mode, so a
 * half-entered split cannot lose money. That remainder is deliberately allowed
 * to be negative when the splits overshoot - dropping it would silently
 * overstate the collection.
 */
function* attributions(rows: PaidRow[]): Generator<Attribution> {
  const at = (mode: string | null | undefined, amount: number): Attribution => ({
    bucket: paymentBucket(mode),
    mode: String(mode ?? "").trim(),
    amount,
  });

  for (const row of rows) {
    const paid = Number(row?.paid_amount ?? 0) || 0;
    const splits = splitsOf(row);
    if (splits.length === 0) {
      yield at(row?.payment_mode, paid);
      continue;
    }
    let attributed = 0;
    for (const split of splits) {
      const amount = Number(split?.amount ?? 0) || 0;
      attributed += amount;
      yield at(split?.mode, amount);
    }
    yield at(row?.payment_mode, paid - attributed);
  }
}

/**
 * What was collected, per instrument.
 *
 * Every rupee in `paid_amount` lands in exactly one bucket, so the buckets add
 * up to the old "Collected" total - an invoice whose mode nobody recognises
 * shows up under "Other" rather than quietly going missing.
 */
export function collectionsByBucket(rows: PaidRow[]): Map<PaymentBucket, number> {
  const totals = new Map<PaymentBucket, number>();
  for (const { bucket, amount } of attributions(rows)) {
    if (!amount) continue;
    totals.set(bucket, (totals.get(bucket) ?? 0) + amount);
  }
  return totals;
}

/** The buckets with money in them, in a fixed order, for the KPI cards. */
export function collectionCards(
  rows: PaidRow[],
  formatValue: (amount: number) => string,
): { label: string; value: string }[] {
  const totals = collectionsByBucket(rows);
  return PAYMENT_BUCKETS.filter((bucket) => (totals.get(bucket) ?? 0) !== 0).map((bucket) => ({
    label: bucket,
    value: formatValue(totals.get(bucket) ?? 0),
  }));
}
