

## Plan: Fix Negative Stock Display & Block Insufficient Stock Dispensing

### What We're Fixing

Available Stock shows negative values because prescriptions consume stock that was never added. We need to clamp the display to 0, block dispensing when stock is insufficient, and alert staff to add opening stock.

### Changes

**File: `src/components/pharma/PharmaDetailSheet.tsx`** (Product detail panel)

1. **Clamp Available Stock to 0 minimum**: Change `availableStock = totalStock - consumedStock` to `Math.max(0, totalStock - consumedStock)`
2. **Add "No opening stock" banner**: When `totalStock === 0` and `consumedStock > 0`, show an amber alert banner prompting staff to add opening stock (e.g. "No stock has been added for this product. Please add opening stock via Inventory.")
3. Keep existing Low Stock badge for when stock is positive but below reorder level

**File: `src/pages/Pharma.tsx`** (Outward billing)

4. **Block dispensing when insufficient stock**: In the `createBill` mutation, before inserting the bill, check each bill item's available stock. If any item has insufficient stock, show a toast error ("Insufficient stock for [product name]") and abort the mutation.
5. **Validate on item add**: When adding an item to the bill, warn if the selected batch/inventory quantity is less than the requested quantity.

**File: `src/components/procedures/ProcedureFormDialog.tsx`** (Prescription creation)

6. **Stock check on prescription save**: Before inserting prescription rows, query available stock for each prescribed product. If available stock is 0, show a warning toast but still allow saving (prescriptions are clinical records — warn but don't block).

### Summary

| File | Change |
|------|--------|
| `PharmaDetailSheet.tsx` | Clamp to 0, add "add opening stock" banner |
| `Pharma.tsx` | Block bill creation on insufficient stock |
| `ProcedureFormDialog.tsx` | Warn on zero stock when prescribing |

