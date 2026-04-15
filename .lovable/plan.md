

## Plan: Replace Sales Info with Revenue Analytics

### Overview
Replace the current price history table in the "Sales Info" section with two stat cards (Total Units Sold, Total Revenue) and a two-row breakdown table showing Clinic Procedures vs Portal Orders contributions.

### Data Sources
- **Clinic Procedures**: `prescriptions` table filtered by `product_id`. Has `quantity` but no sell price — will use current product `selling_price` as approximation (prescriptions don't store transaction price).
- **Portal Orders**: `portal_order_items` table filtered by `product_id`. Has `quantity`, `unit_price`, and `total_price` — use `total_price` for revenue (captures actual transaction price).

### Step 1 — Add two new queries in ProductDetailSheet

Add queries for:
1. `portal_order_items` where `product_id = productId` — to get portal sales qty and revenue
2. The existing `prescriptionItems` query already fetches prescription quantities

### Step 2 — Replace Sales Info section (lines 369-428)

Remove the old price history table (Status, MRP, Sell, Buy, GST%, From, Notes columns) and the "New Price" button/form.

Replace with:
1. **Two stat cards** side by side:
   - "Total Units Sold" = sum of prescription quantities + sum of portal order quantities
   - "Total Revenue" = (prescription qty × product selling_price) + sum of portal `total_price`
2. **Breakdown table** with columns: Source | Units Sold | Revenue
   - Row 1: Clinic Procedures (Stethoscope icon) — prescription totals
   - Row 2: Portal Orders (ShoppingBag icon) — portal order totals

### Step 3 — Relocate price management

Move the "New Price" button and the price form into a new "Price Management" sub-section below the Sales Info, keeping the price form functionality intact but separating it from the sales analytics view.

### Files changed
- `src/components/pharma/PharmaDetailSheet.tsx` — replace Sales Info section, add portal orders query

### Technical details
- Import `Stethoscope`, `ShoppingBag` from lucide-react
- New query: `useQuery({ queryKey: ["product-portal-sales", productId], queryFn: ... })` fetching from `portal_order_items`
- Revenue from prescriptions approximated using current `product.selling_price` since prescriptions don't store transaction price
- Revenue from portal orders uses stored `total_price` (actual transaction value)

