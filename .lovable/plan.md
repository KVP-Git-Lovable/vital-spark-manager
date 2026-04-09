

## Plan: Inventory Summary Section in Product Detail Sheet

### What We Are Building

Adding an "Inventory Summary" section between Product Details and Price History in the Pharma Product side drawer. It shows two cards: **Total Stock** (sum of all inward inventory) and **Available Stock** (total stock minus quantities consumed via prescriptions). A red warning appears when available stock falls at or below the reorder level.

### Implementation

**File: `src/components/pharma/PharmaDetailSheet.tsx`**

1. Add a new query to fetch total inward stock:
   ```sql
   SELECT COALESCE(SUM(quantity), 0) FROM pharma_inventory WHERE product_id = ?
   ```

2. Add a new query to fetch total consumed stock from prescriptions:
   ```sql
   SELECT COALESCE(SUM(quantity), 0) FROM prescriptions WHERE product_id = ?
   ```

3. Calculate:
   - `totalStock` = sum of `pharma_inventory.quantity`
   - `consumedStock` = sum of `prescriptions.quantity`
   - `availableStock` = totalStock - consumedStock

4. Render two styled cards between the product details grid (line ~203) and the Current Pricing section (line ~206):
   - **Total Stock** card showing the inward total
   - **Available Stock** card showing the computed available value
   - If `availableStock <= product.reorder_level`, display the Available Stock text in red with a warning badge

### Technical Details

- Two additional `useQuery` hooks using Supabase `.select("quantity")` on `pharma_inventory` and `prescriptions` filtered by `product_id`
- Sum computed client-side from the returned rows
- Uses existing Card components and Badge for the warning indicator
- No database changes needed -- all data already exists in `pharma_inventory` and `prescriptions` tables

