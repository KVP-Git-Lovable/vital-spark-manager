

## Plan: Per-line tax display in Create Invoice

### Goal
Show the applicable tax % and tax amount on every Service and Pharma Product row. Keep the overall summary, but compute it from per-line taxes (so totals always reconcile with the line items shown).

### Approach

Single tax configuration is shared across the invoice (existing behavior — auto-populated from product/service mapping, manually overridable). Each line item simply applies that selected tax rate to its own line subtotal.

### Changes in `src/pages/Billing.tsx`

**1. Helper (near line 374)**
Add `lineTaxAmount(amount)` that returns `amount * totalRate / 100` using the currently selected tax — and `currentTaxRate` memo for the effective % to display.

**2. Service row UI (around line 832–871)**
Below each picked service price, render a small muted label:
- If tax selected: `Tax (18%): ₹X.XX`
- If no tax: `No tax`

Place it as a thin line under the row (not beside, to keep the row uncluttered on mobile width 1021px and below).

**3. Pharma row UI (around line 919–937)**
In the third column (currently shows line total `₹{qty*price}`), stack the line total on top and a smaller `Tax (18%): ₹X.XX` underneath, right-aligned. Mirrors the services treatment.

**4. Subtotals reconciliation (around line 939–1013)**
- Compute `servicesTax = lineTaxAmount(servicesSubtotal)` and `pharmaTax = lineTaxAmount(pharmaSubtotal)` (mathematically identical to applying rate to combined subtotal — totals always match line-by-line sums).
- Update the One-time summary block to show:
  - Services ₹X  +  Services Tax ₹Y (if tax)
  - Products ₹X  +  Products Tax ₹Y (if tax)
  - Subtotal, CGST/SGST/IGST breakdown (unchanged), Grand Total (unchanged formula)
- Add a one-line note below subtotal: "Tax derived from line items"

**5. No DB / mutation changes**
Storage of `tax_rate` / `tax_amount` on `invoices` already snapshots the total — line-level display is purely UI. Grand total math is unchanged.

### Files
- Modified: `src/pages/Billing.tsx` (helpers + service row + pharma row + summary copy)

No migration. No changes to PDF, invoice list, or other modules.

