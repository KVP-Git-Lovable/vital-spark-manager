/**
 * The three money figures a bill shows in a report: Amount, GST % and Total.
 *
 * Reports showed one "Total" column, and the clinic's auditors need to see what
 * was charged before GST, the rate the bill carries, and the total after it.
 *
 * Nothing here writes anything or changes a stored figure. Total is the bill's
 * own total_amount, exactly as before, and Amount is derived from it, so every
 * card, chart and export still adds up to the same money.
 *
 * A note on the rate, because the data is not tidy: of 2,064 bills carrying
 * GST, 2,045 record the rate they were raised at, and on 747 of those the GST
 * actually charged covers only part of the bill - a Rs 9,775 bill with Rs 125
 * of GST records 5% though the charge works out at 1.3% of the amount. The
 * clinic asked for "the GST% a bill carries", so the recorded rate is what
 * shows. Where no rate was recorded but GST was charged (19 bills), it is
 * worked out from the figures rather than left blank.
 */

export interface GstInvoice {
  /** Numerics arrive from the database as strings, hence the loose type. */
  total_amount?: number | string | null;
  tax_amount?: number | string | null;
  tax_rate?: number | string | null;
}

const num = (value: number | string | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** What the bill came to before GST: its total less the GST on it. */
export function amountBeforeGst(row: GstInvoice | null | undefined): number {
  return num(row?.total_amount) - num(row?.tax_amount);
}

/** The bill's total, unchanged - the same figure the summary cards add up. */
export function totalWithGst(row: GstInvoice | null | undefined): number {
  return num(row?.total_amount);
}

/**
 * The rate the bill carries, or null when it carries no GST.
 *
 * The recorded rate first; failing that, worked out from the figures.
 */
export function gstRate(row: GstInvoice | null | undefined): number | null {
  const tax = num(row?.tax_amount);
  if (tax === 0) return null;

  const recorded = num(row?.tax_rate);
  if (recorded > 0) return recorded;

  const base = amountBeforeGst(row);
  if (base <= 0) return null;
  return Math.round((tax / base) * 10000) / 100;
}

/** "5%", "18%", "1.3%" - or null for a bill with no GST, which shows blank. */
export function gstRateLabel(row: GstInvoice | null | undefined): string | null {
  const rate = gstRate(row);
  if (rate === null) return null;
  // Trailing zeros dropped: 5 reads "5%", not "5.00%".
  return `${Number(rate.toFixed(2))}%`;
}
