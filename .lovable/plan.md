

## Plan: Per-line auto-tax in Create Invoice (remove manual tax selector, fix double-counting)

### Problems today
1. A single Tax Configuration dropdown overrides per-item mappings — user has to pick one rate for the whole invoice.
2. Summary shows "Services Tax + Products Tax" AND "CGST + SGST" — both derived from the same total, so the visual reads like double tax even though the grand total math is fine.
3. Tax rate is uniform across lines, ignoring that each product/service can map to a different rate in Tax Master.

### Goal
- Each line item resolves its own tax rate from Tax Master mapping (`tax_master_products` for pharma, `tax_master_services` for services).
- No manual Tax Configuration dropdown.
- Summary shows CGST + SGST breakdown only (single representation), derived by summing per-line tax. Grand Total = Subtotal + (CGST + SGST).

### Changes — `src/pages/Billing.tsx`

**1. Build per-item tax lookup maps (replace the single `selectedTaxId` model)**
- New query: fetch all active `tax_master` rows once, build `taxById: Map<tax_id, { rate, cgst, sgst, igst, name }>`.
- Reuse existing `tax-master-services-active` and product mappings to build:
  - `serviceTaxRateById: Map<service_id, tax_id>`
  - `productTaxRateById: Map<product_id, tax_id>` (already exists in some form via pharma flow).
- Helper `getLineTax(taxId, amount)` → `{ rate, cgst, sgst, igst, taxAmount }`. If `taxId` missing → all zeros (No Tax).

**2. Remove Tax Configuration UI block**
- Delete the `<Select>` for `selectedTaxId` (around the summary card area).
- Delete `selectedTaxId` state, `getSelectedTax`, `currentTaxRate`, and the `lineTaxAmount(amount)` helper that depended on it.
- Remove the auto-population effects that set `selectedTaxId` when picking a service/product (no longer needed).

**3. Service row UI** (around the per-service price line)
- Resolve `taxId = serviceTaxRateById.get(svc.id)` → compute line tax from its own rate.
- Below price show: `Tax (18%): ₹X.XX` or `No tax` — same compact muted style, but **per-line rate**, not invoice-wide.

**4. Pharma row UI** (line-total cell)
- Resolve `taxId = productTaxRateById.get(item.product_id)`.
- Stack: line subtotal on top, `Tax (12%): ₹Y.YY` (or `No tax`) underneath, right-aligned.

**5. Summary block — single representation**
Compute by aggregation across all lines:
```
totalCgst = Σ line.cgst
totalSgst = Σ line.sgst
totalIgst = Σ line.igst   (if any line uses IGST)
totalTax  = totalCgst + totalSgst + totalIgst
```
Display:
- Services Subtotal: ₹X
- Products Subtotal: ₹Y
- Subtotal: ₹(X+Y)
- **CGST: ₹A**
- **SGST: ₹B**
- (IGST: ₹C — only if any line is IGST)
- **Grand Total = Subtotal + CGST + SGST (+ IGST)**

Remove the "Services Tax / Products Tax" rows entirely. Remove the "Tax derived from line items" note (now self-evident). No double display.

**6. Invoice persistence**
The `invoices` table currently snapshots `tax_id`, `tax_rate`, `tax_amount`. With multi-rate lines there's no single `tax_id`/`tax_rate` to store. Approach:
- `tax_id` → `null`
- `tax_rate` → `null` (or weighted effective rate; nullable is cleaner)
- `tax_amount` → `totalTax` (sum across lines) — preserves grand total integrity for existing invoice list/PDF.
- Invoice items already store per-line price/qty; line tax is recomputable on view from current mappings, and the aggregate is preserved on `invoices.tax_amount`. No schema change needed.

**7. Edge cases**
- Mixed: some lines mapped, some not → unmapped lines contribute 0 tax, summary still correct.
- All lines unmapped → CGST/SGST rows hidden, Grand Total = Subtotal.
- Installments / staged billing: same per-line resolution applied to the items belonging to each stage (existing stage logic untouched, just swap the tax computation).

### Files
- Modified: `src/pages/Billing.tsx` (remove dropdown + state, add per-line tax resolver, update Service & Pharma row UI, rewrite summary, adjust mutation payload).

No DB migration. No changes to other modules (PDF/invoice list read `tax_amount` which still holds the correct aggregate).

