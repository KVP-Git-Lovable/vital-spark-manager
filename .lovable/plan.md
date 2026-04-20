

## Plan: Move pricing to Inventory (per batch) + auto sub-unit price

### Current state
- `pharma_products` holds `selling_price`, `mrp`, `gst_percent` (product-level pricing).
- `pharma_inventory` only has `purchase_price` per batch — no MRP, no selling price.
- Billing/Shop reads pricing from `pharma_products`.

### Target
Pricing lives **per batch** in inventory. Product Master keeps only catalog info (name, units, conversion, HSN, GST%). Sub-unit price is auto-derived = `base price ÷ conversion_value`.

### 1. Schema migration (`pharma_inventory`)
Add:
- `mrp` numeric default 0 — MRP per base unit for this batch
- `selling_price` numeric default 0 — selling price per base unit (optional override; defaults to MRP if blank)

Backfill existing inventory rows: copy `pharma_products.mrp` → `pharma_inventory.mrp`, `pharma_products.selling_price` → `pharma_inventory.selling_price` for each batch's product.

Keep `pharma_products.mrp` / `selling_price` columns for now (read-only fallback) — remove from Add/Edit Product UI but don't drop yet, so existing displays don't break.

### 2. Product Form (`Pharma.tsx` Add/Edit)
Remove pricing fields: **MRP**, **Selling Price** (and any "Volume per Bottle" leftovers). Keep:
- Name, Generic, Manufacturer, Category, Vendor
- Base Unit / Sub Unit / Conversion Value (already added)
- HSN, GST %
- Reorder level, Image

Helper note above where price used to be: *"Pricing is captured per batch in Inventory."*

### 3. Inventory Form (Inward Stock — `Pharma.tsx` inventory tab / dialog)
Replace current minimal form with:
- **Product** (searchable select) — required
- *Read-only display once product picked:* `Base Unit: Bottle` and `Conversion: 1 Bottle = 100 ml` (via `formatProductUnit`)
- **Batch No** — required
- **Expiry Date** — required
- **Quantity (in {base_unit})** — label dynamic, required
- **Purchase Price (per {base_unit})** — required
- **MRP (per {base_unit})** — required
- **Selling Price (per {base_unit})** — optional, defaults to MRP
- **Supplier**, **Invoice No**

Below MRP/SP, show live derived sub-unit price when sub-unit exists:
> *"= ₹2.00 per ml"* (calculated as `mrp / conversion_value`)

### 4. Display surfaces — pricing source
Switch reads from product to **latest active batch** (non-expired, qty > 0, most recent `received_date`):
- **Pharma list / Detail sheet**: show batch MRP + derived sub-unit price. If no batch → "Not in stock".
- **Billing pharma picker** (`Billing.tsx`): use batch `selling_price` (fallback MRP) for `unit_price`.
- **Portal Shop / Public Shop** (`PortalShop.tsx`, `ShopProduct.tsx`, `ShopHome.tsx`): same — show batch MRP, derived per-sub-unit price as secondary line.

Helper: new `src/lib/productPricing.ts` exporting `getActiveBatchPrice(product, inventoryRows)` → `{ mrp, sellingPrice, subUnitPrice | null }` with fallback to legacy `pharma_products.mrp/selling_price` when no batch exists.

### 5. Files
- New migration: add `mrp`, `selling_price` to `pharma_inventory` + backfill
- New: `src/lib/productPricing.ts` (batch-price resolver + sub-unit math)
- Modified: `src/pages/Pharma.tsx` — strip price fields from product form; expand inward-stock form with new fields, read-only unit/conversion display, derived sub-unit price hint
- Modified: `src/components/pharma/PharmaDetailSheet.tsx` — show batch pricing
- Modified: `src/pages/Billing.tsx` — pharma picker reads batch price
- Modified: `src/components/portal/PortalShop.tsx`, `src/pages/shop/ShopHome.tsx`, `src/pages/shop/ShopProduct.tsx` — batch pricing + sub-unit line

No invoice math changes — `unit_price` is still per base unit, just sourced from batch.

