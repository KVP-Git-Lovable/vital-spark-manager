

## Plan: Enforce single-active tax mapping per product

### Schema change (migration)
Add `is_active` (boolean, default true) column to `tax_master_products` to track per-product active status within a tax rate.

### TaxMasterForm.tsx changes

**1. Load all active mappings across tax rates**
New query fetches every `tax_master_products` row joined with `tax_master` (only active tax + active mapping), excluding the current tax id being edited. Build a `Map<product_id, { taxId, taxName, rate }>` of "claimed" products.

**2. Product picker — disable already-mapped products**
- In the Command list, each product item checks the claim map.
- If claimed: render with `opacity-50 pointer-events-none` style, disable selection, wrap in Tooltip showing `Already mapped to {taxName} {rate}% — deactivate there first`.
- If currently selected on this tax: always selectable (toggle off allowed).

**3. Mapped products list — per-row Active toggle**
Replace the current chip-only view with a structured list. Each row shows:
- Product name (greyed when inactive)
- Switch (Active/Inactive) — toggles `tax_master_products.is_active` for this link
- Remove (X) button

State shape changes: `productIds: string[]` becomes `productLinks: { product_id: string; is_active: boolean }[]`.

**4. Save logic updates**
- When inserting/updating `tax_master_products` rows, include `is_active` per row.
- A product marked inactive in this tax becomes selectable in other tax rates (because the cross-tax claim map filters by `tax_master_products.is_active = true`).
- Keep existing versioning flow intact — old invoices retain snapshot rates (already handled via `invoices.tax_rate`/`tax_amount`).

**5. Removing vs deactivating**
- **Remove (X)** → deletes the link row entirely (product becomes free).
- **Inactive toggle** → keeps row for history, frees product for mapping elsewhere, greys it visually.

### Files
- New migration: `ALTER TABLE tax_master_products ADD COLUMN is_active boolean NOT NULL DEFAULT true;`
- Modified: `src/pages/TaxMasterForm.tsx` (claim map query, picker disable + tooltip, per-row toggle UI, updated save payload)

No changes to invoice/billing tables — historical immutability already enforced by snapshot columns.

