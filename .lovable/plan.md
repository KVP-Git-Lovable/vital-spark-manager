

## Plan: Pharmacy Portal Settings with Real-Time Shop Integration

### Overview
Add a "Settings" tab to the Pharmacy module with portal configuration options. The patient portal Shop will respect these settings when displaying products.

### Step 1 — Create `portal_settings` database table

New table with a single-row config pattern:

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| out_of_stock_behavior | text | 'show_out_of_stock' |
| hide_expiring_products | boolean | false |
| expiring_threshold_days | integer | 90 |
| shop_enabled | boolean | true |
| low_stock_threshold | integer | null (use product reorder_level) |
| created_at / updated_at | timestamptz | now() |

Values for `out_of_stock_behavior`: `'hide'`, `'show_out_of_stock'`, `'accept_backorders'`

Open RLS for anon + authenticated (read/update/insert).

### Step 2 — Add "Settings" tab to Pharma page

In `src/pages/Pharma.tsx`:
- Add a 4th `TabsTrigger` for "Settings" with a gear icon
- Build the Settings tab content with:
  - **Out of Stock Behavior** — radio group with 3 options (hide / show badge / accept backorders)
  - **Expiring Products** — switch to hide products expiring within 90 days
  - **Shop Enabled** — switch to enable/disable the entire shop
  - **Low Stock Threshold** — optional number input override
- Fetch settings on mount via `useQuery`, upsert on Save via mutation

### Step 3 — Update Shop to respect settings

In `src/pages/shop/ShopHome.tsx`:
- Fetch `portal_settings` alongside products
- Fetch stock data (inventory totals - bill totals) per product
- If `shop_enabled === false`, show a "Shop is currently unavailable" message
- Filter/render products based on settings:
  - `hide`: remove zero-stock products from the list
  - `show_out_of_stock`: show with badge, disable Add to Cart
  - `accept_backorders`: show with backorder message, allow Add to Cart
- If `hide_expiring_products`: filter out products with all batches expiring within threshold

### Files to create/edit

- **Migration**: Create `portal_settings` table + seed a default row
- **`src/pages/Pharma.tsx`**: Add Settings tab with config UI
- **`src/pages/shop/ShopHome.tsx`**: Fetch settings + stock, apply filtering and display logic

### Technical notes
- Stock calculation reuses: `SUM(pharma_inventory.quantity) - SUM(pharma_bill_items.quantity)` per product
- Settings use upsert on the single row (fetch first row, update by id)
- The `portal_settings` table uses a single-row pattern — the app always reads/writes the first row

