// Which HSN code a billed line carries, from the GST rate it was charged at.
//
// Salesforce's Billing__c has no HSN field - the import wrote `hsn: ""` on every
// line, so the HSN column printed blank on all 18,534 line items. The codes do
// exist, in the clinic's own Tax Master (hsn_tax_master), and the rate is enough
// to pick one because the two active codes are defined by their rate:
//
//   999319  CGST 0   + SGST 0    exempt - a doctor's consultation
//   999722  CGST 2.5 + SGST 2.5  5% - beauty and physical well-being services
//
// 18% is deliberately NOT mapped. 30,682 bills between 2020-08-03 and
// 2025-09-20 were charged at 18%, before the September 2025 rate change; the
// Tax Master has no code at that rate and the clinic asked for those to stay
// blank rather than have one guessed. A wrong HSN on a tax invoice is worse
// than an empty one, because an empty cell is visibly missing and a wrong code
// is not.

export const HSN_EXEMPT = "999319";
export const HSN_SERVICES_5 = "999722";

/** The HSN for a line charged at this GST rate, or "" when none is defined. */
export function hsnForRate(rate: number | string | null | undefined): string {
  // Guard before converting: Number(null) and Number("") are both 0, which
  // would hand the exempt code to a line whose rate is simply unknown.
  if (rate === null || rate === undefined || String(rate).trim() === "") return "";
  const n = Number(rate);
  if (!Number.isFinite(n)) return "";
  if (n === 0) return HSN_EXEMPT;
  if (n === 5) return HSN_SERVICES_5;
  return "";
}
