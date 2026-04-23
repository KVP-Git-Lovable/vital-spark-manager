

## Multiple Unit Conversions per Product

Today each product supports a **single** Base→Sub conversion (`pharma_products.sub_unit`, `conversion_value`). We'll replace this with a child table so a product can have many conversions (e.g. 1 Box = 10 Strips, 1 Strip = 10 Tablets, 1 Bottle = 100 ml), each with its own active/inactive flag.

### Database (migration)

**New table `pharma_product_units`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid | references `pharma_products.id` (cascade delete) |
| sub_unit | text | e.g. "ml", "Tablet", "Strip" |
| conversion_value | numeric | sub units per base unit (e.g. 100) |
| is_active | boolean | default true |
| is_default | boolean | default false — the one used in stock/billing UI as the primary sub-unit |
| sort_order | int | for stable ordering |
| created_at / updated_at | timestamptz | |

- RLS: same anon + authenticated ALL pattern as `pharma_products`.
- Backfill: for every existing row in `pharma_products` where `sub_unit IS NOT NULL` AND `conversion_value > 1`, insert one row into `pharma_product_units` with `is_default = true`, `is_active = true`. No data lost.
- Legacy columns `pharma_products.sub_unit`, `conversion_value`, `qty_per_unit` are kept (nullable) to avoid breaking anything that still reads them, but the UI will stop writing to them. They become read-only legacy mirrors of the default active row (kept in sync via app code on save) so old reports keep working.

### Product form (Add + Edit)

Replace the single Sub Unit + Units fields in:
- `src/pages/Pharma.tsx` (Add Product dialog, ~line 431-446)
- `src/components/pharma/PharmaDetailSheet.tsx` (Edit form, ~line 640-654)

with a new **"Unit Conversions"** section:

```text
Unit Conversions                                       [+ Add conversion]
┌──────────────────────────────────────────────────────────────────────┐
│ Sub Unit ▼ [Strip]   Units per Base [10]   ☑ Default   ☑ Active  🗑 │
│ Sub Unit ▼ [Tablet]  Units per Base [100]  ○ Default   ☑ Active  🗑 │
│ Sub Unit ▼ [ml]      Units per Base [50]   ○ Default   ☐ Active  🗑 │
└──────────────────────────────────────────────────────────────────────┘
1 Bottle = 100 Tablets · 1 Box = 10 Strips
```

Behavior:
- Sub Unit dropdown is sourced from `unit_master` (same as today).
- "Default" is a single-select (radio-like) across rows; required when at least one active conversion exists.
- "Active" toggle per row. Inactive rows are kept for history but excluded from stock/billing dropdowns.
- Empty product = no conversion rows; product is then just sold by its Base Unit.
- Save is transactional: upsert `pharma_products` then replace `pharma_product_units` rows for that product (delete missing, upsert present).

### Stock (Inward) and Billing — use only active conversions

- **Add Stock dialog** (`Pharma.tsx` ~470-524): the "Conversion" hint and the "per X" sub-unit price hint now read from the **default active** conversion. If multiple active conversions exist, show a small `Sub Unit` selector inside the dialog (defaults to the default row) so the operator can enter MRP/SP per the chosen unit. Stored `mrp` / `selling_price` remain in **base unit** (we convert on entry).
- **Pharmacy Bill (Outward)** (`Pharma.tsx` from ~536): when picking a product, the sub-unit price column is computed using the default active conversion (`baseSP / conversion_value`). If multiple actives exist, show a unit toggle on the bill row.
- **Patient Portal Shop & Cart** (`ShopProduct.tsx`, etc.): `formatProductUnit()` and `getActiveBatchPrice()` switch to reading from the default active row in `pharma_product_units` (with fallback to legacy `sub_unit`/`conversion_value` when no rows exist, so nothing breaks during transition).

### Helpers to update

- `src/lib/unitDisplay.ts` — `formatProductUnit(product, units?)` accepts an optional units array and renders `Base (conv1 sub1, conv2 sub2)` for multi-conversion display, falling back to the legacy single-conversion render.
- `src/lib/productPricing.ts` — `getActiveBatchPrice(product, inventory, units?)` resolves `subUnit`/`subUnitPrice` from the default active row in `units`, falling back to legacy fields.
- A new `usePharmaProductUnits()` query hook to fetch `pharma_product_units` once and group by `product_id`, used wherever products are listed (Pharma list, ProductDetailSheet, ShopProduct, billing).

### Files changed

- New migration: create `pharma_product_units` + RLS + backfill.
- `src/pages/Pharma.tsx` — replace sub-unit form fields with the conversions repeater; rewire stock + bill UI.
- `src/components/pharma/PharmaDetailSheet.tsx` — same repeater in edit form; product detail view shows the active conversions list.
- `src/lib/unitDisplay.ts`, `src/lib/productPricing.ts` — multi-conversion aware with legacy fallback.
- `src/pages/shop/ShopProduct.tsx`, `src/pages/shop/ShopHome.tsx`, `src/pages/shop/ShopCart.tsx` — pass conversions to helpers.
- New `src/hooks/usePharmaProductUnits.ts`.

### Out of scope

- Storing inventory quantity per arbitrary sub-unit (we keep stock in base units; sub-units are display/pricing only).
- Cross-conversion math (e.g. 1 Box → 10 Strips → 100 Tablets implied chain). Each conversion is independent: `Base → Sub`. If you need chained conversions, that's a follow-up.
- Migrating away from legacy `pharma_products.sub_unit` columns (kept for safety; can be dropped in a future cleanup once everything reads from the new table).

### Decision needed

1. **Chained conversions** (Box → Strip → Tablet) or just **flat list of Base→Sub pairs**? Plan above is flat (simpler, covers most pharmacy SKUs). Confirm or upgrade to chained.
2. When a product has no active conversions, should bill/stock UIs **hide the sub-unit price hint entirely**, or show "Sold per [Base Unit] only"? Default in plan: show the latter.

