

## Plan: Convert Tax Master to Full-Page Add/Edit with Versioning

### 1. Routing (`src/App.tsx`)
Add two new protected routes inside `AppLayout`:
- `/settings/tax-master/new` → `TaxMasterForm`
- `/settings/tax-master/:id` → `TaxMasterForm`

### 2. New file: `src/pages/TaxMasterForm.tsx`
Full-page form (mobile-friendly, matches existing Master Data page style — header with Back button, sticky Save) containing:
- **Fields**: Tax Name, Description, CGST %, SGST %, IGST % (computed total displayed), Active/Inactive toggle
- **Mapped Products** section: searchable multi-select (reuse existing Popover+Command pattern from Settings.tsx) listing `pharma_products`, with chips + remove (X)
- **Back** button (top-left) → `navigate("/settings?tab=tax")`
- **Save** button (top-right + bottom)
- On edit, loads `tax_master` row + `tax_master_products` links + each linked product's current `gst_percent`

### 3. Versioning behavior on Save (when editing existing tax with mapped products and rate changed)
Show `AlertDialog` with warning **"This will affect all mapped products."** and two actions:
- **Update All** — apply new rate to every mapped product
- **Update Specific** — opens a checklist of mapped products; user picks which receive the new rate

Save flow when rate changed AND products selected to update:
1. Mark old `tax_master` row `is_active = false` (preserved for history; invoices already snapshot `tax_rate`/`tax_amount` so old invoices remain unaffected)
2. Insert NEW `tax_master` row with new CGST/SGST/IGST/rate, `is_active = true`, same name (or name + version suffix)
3. For selected products: re-link in `tax_master_products` to NEW tax id and update `pharma_products.gst_percent` to new total rate
4. Unselected products remain linked to OLD (now inactive) tax row

If only metadata (name/description/products list) changed without rate change → simple in-place UPDATE (current behavior).

If creating new tax OR editing tax with no mapped products → no warning, plain insert/update.

### 4. Update `src/pages/Settings.tsx` (Tax Master tab)
- Remove the existing Add/Edit Dialog and all related state/mutations (`taxOpen`, `openEditTax`, `saveTax`, form fields, product picker)
- Keep the list table + active toggle + delete
- Replace **+ Add Tax Rate** button → `navigate("/settings/tax-master/new")`
- Make table rows clickable + pencil icon → `navigate("/settings/tax-master/{id}")`
- Optionally filter list to show Active by default with an "Include inactive (history)" toggle

### 5. Historical preservation
Already supported — `invoices.tax_rate`, `invoices.tax_amount`, `pharma_bills.tax_rate`, `pharma_bills.tax_amount` are snapshot columns. No DB migration required. Inactive tax rows remain in `tax_master` for reference.

### Files
- New: `src/pages/TaxMasterForm.tsx`
- Modified: `src/App.tsx` (2 routes), `src/pages/Settings.tsx` (remove dialog, add navigation)

