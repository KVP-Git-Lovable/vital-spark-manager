

## Plan: Per-product unit conversion in Product Master

### Concept
Unit Master stays as a flat list of unit names (Bottle, Box, ml, Tablet, etc.) — no conversion logic baked in. Each product declares its own Base Unit + Sub Unit + how many sub-units make one base unit.

### Schema (migration on `pharma_products`)
Add three columns:
- `base_unit` text — the larger sellable unit (e.g. Bottle, Box, Strip)
- `sub_unit` text — the smaller dispensable unit (e.g. ml, Tablet, Capsule). Nullable.
- `conversion_value` numeric — how many sub-units per 1 base unit (e.g. 100). Default 1.

Backfill: copy existing `unit` → `base_unit`, copy existing `qty_per_unit` → `conversion_value`. Keep `unit` and `qty_per_unit` columns for now (read-only fallback) so nothing breaks elsewhere; new code reads/writes the new fields.

### Unit Master (`src/pages/UnitMaster.tsx`)
Already a flat list with name + optional sub-unit + active flag. **Drop the `sub_unit_name` field from this screen** — units are now just names. Keep name + active toggle. Sub-units come from the same unit list (any unit can be picked as a sub-unit on a product).

### Product form (`src/components/pharma/...` — Add/Edit Product)
Replace the current single "Unit" + "Volume per Bottle" pair with:
- **Base Unit** (Searchable Select from Unit Master active list) — required
- **Sub Unit** (Searchable Select from Unit Master active list) — optional
- **Units per Base Unit** (number input) — label dynamically reads e.g. "ml per Bottle" once both units are picked, otherwise "Units per Base Unit". Required when Sub Unit is set, default 1.

Helper text below: *"e.g. 1 Bottle = 100 ml, 1 Box = 100 Tablets"*

### Display (Pharma list, Detail sheet, Shop, Billing pickers)
Where today shows `unit` / `Volume per Bottle`:
- Show as `Base Unit (Conversion × Sub Unit)` — e.g. `Bottle (100 ml)` or `Box (100 Tablets)`.
- If no sub-unit: show just `Bottle`.

Files touched for display: `src/pages/Pharma.tsx`, `src/components/pharma/PharmaDetailSheet.tsx`, `src/pages/Billing.tsx` (pharma picker), `src/components/portal/PortalShop.tsx`, `src/pages/shop/ShopProduct.tsx`. Read from new fields with fallback to legacy (`base_unit ?? unit`, `conversion_value ?? qty_per_unit`).

### Files
- New migration: add `base_unit`, `sub_unit`, `conversion_value` to `pharma_products` + backfill
- Modified: `src/pages/UnitMaster.tsx` (remove sub_unit_name field)
- Modified: `src/components/pharma/` product form (new 3-field block, dynamic label)
- Modified: pharma display surfaces listed above (label rendering helper)

No changes to invoice/billing math — pricing remains per base unit as before.

