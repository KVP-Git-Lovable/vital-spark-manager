## Goal
Allow split/part payments at invoice creation in Billing → Create Invoice, with up to 3 payment rows whose amounts sum to the Paid Amount. Display the split breakdown in the invoice view and PDF. Single payment mode flow continues to work unchanged.

## Database
Add a `payment_splits` JSONB column to `public.invoices` (nullable, default `null`).
- Shape: `[{ "mode": "Cash", "amount": 2000 }, { "mode": "UPI", "amount": 3000 }]`
- When null/empty → behaves as today using single `payment_mode` + `paid_amount`.
- Keep existing `payment_mode` populated (set to first split's mode, or `"Split"` when multiple) for backward compatibility with reports/CSV exports.

## UI changes — `src/pages/Billing.tsx` (Create Invoice dialog)
Near the existing Payment Mode select (~line 1270):
- Add a `+ Split Payment` text button next to the Payment Mode label.
- New state: `splits: { mode: string; amount: number }[]` (empty = single-mode flow).
- When toggled on:
  - Hide the single Payment Mode `<Select>`.
  - Render a list of split rows (max 3), each with a Payment Mode `<Select>` (same options as today) + Amount `<Input type="number">` + remove (×) button.
  - `+ Add row` button (disabled at 3 rows).
  - Live total under the rows: `Split total ₹X / Paid ₹Y`. If mismatch, inline error in destructive color: "Split amounts must equal paid amount".
  - Submit handler blocks save with a toast when `sum(splits.amount) !== paid_amount` or any row missing mode/amount.
- On save:
  - If splits used → write `payment_splits` array to invoice; set `payment_mode = "Split"` (or single mode if rows collapsed to 1).
  - Otherwise → existing behavior (single `payment_mode`).
- Reset splits in the existing form-reset path (~line 941).

## UI changes — Invoice view dialog (~line 1718)
- If `viewInvoice.payment_splits?.length > 1`, replace the single "Payment Mode" cell with a list:
  `Cash: ₹2,000`  ·  `UPI: ₹3,000`
- Otherwise show today's single payment mode.

## PDF — `supabase/functions/generate-invoice-pdf/index.ts`
- After the existing `Payment: …` line, if `inv.payment_splits` has entries, render each on its own line: `Cash: Rs. 2,000.00`, `UPI: Rs. 3,000.00`. Otherwise unchanged.

## Out of scope
- Editing splits in the "Add Payment" / "Edit Invoice" dialogs (these continue to use single payment mode as today).
- Stage / recurring invoice generation paths keep using single `payment_mode` (only the standard Create Invoice flow gets split support, matching the request).
- No changes to CSV export columns; "Payment Mode" column will show `"Split"` when split is used.

## Files touched
- New migration: add `payment_splits jsonb` to `public.invoices`.
- `src/pages/Billing.tsx` — split UI, validation, save payload, view dialog rendering, reset.
- `supabase/functions/generate-invoice-pdf/index.ts` — render splits when present.
