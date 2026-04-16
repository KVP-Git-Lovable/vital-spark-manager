

## Plan: Clickable Sales Rows + Revenue Calculation Fix

### Problem Analysis

**1. Sales rows not clickable**: "Clinic Procedures" and "Portal Orders" in the Sales Info table are static rows with no drill-down.

**2. Revenue calculation issue**: Clinic revenue is estimated as `clinicUnits × selling_price` (current product selling price), which is inaccurate — it should use the actual sell price at time of sale. However, the `prescriptions` table has no price column, so this is the best available estimate. The real issue may be that revenue shows ₹0 or wrong values because the selling_price on the product is 0 or outdated.

### Changes — Single File: `src/components/pharma/PharmaDetailSheet.tsx`

**Step 1: Enhance data queries**
- Update the prescriptions query to fetch `quantity, created_at, procedure_id` and join to procedures to get `patient_id`, then to patients to get patient name.
- Update the portal sales query to fetch full details including order info (patient_name, date) via `portal_order_items` joined with `portal_orders`.

**Step 2: Add clickable rows with modals**
- Add two new state variables: `showClinicSales` and `showPortalSales` (booleans).
- Make the "Clinic Procedures" row clickable → opens a Dialog showing a table with columns: Patient Name, Date, Qty, Sell Price, Total.
- Make the "Portal Orders" row clickable → opens a similar Dialog.
- Add cursor-pointer styling and an Eye icon to indicate clickability.

**Step 3: Fix revenue calculation**
- For clinic sales: use the product's selling price × quantity (current approach, but ensure selling_price is correctly read as a number).
- For portal sales: already using `total_price` from `portal_order_items` which is accurate.
- Add a tooltip or note if selling_price is 0 to flag potential data issues.

### Technical Details

- Prescriptions query changes to: `supabase.from("prescriptions").select("quantity, created_at, procedure_id, procedures(patient_id, patients(first_name, last_name))").eq("product_id", productId)` — but since there are no foreign keys, we'll need a two-step fetch: get prescriptions, then get procedure IDs, then fetch procedures with patient info.
- Portal query: fetch `portal_order_items` with product_id filter, then fetch parent `portal_orders` for patient_name and date.
- Two new `<Dialog>` components for the drill-down modals.

