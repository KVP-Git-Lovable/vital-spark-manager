

## Plan: Prescription Stock Validation & Dosage Removal

### What changes

1. **Remove Dosage field** from the prescription form UI and data model
   - Remove `dosage` from the `PrescriptionInput` interface
   - Remove the dosage `<Input>` from the prescription grid (line 336)
   - Remove `dosage` from the initial empty prescription object (line 220)
   - Remove `dosage` from the insert payload (line 198)
   - Change the medicine/qty grid layout from `grid-cols-2` to full-width for the medicine select

2. **Add real-time stock display on medicine selection**
   - Track stock per prescription index using a `stockMap` state (`Record<number, {available: number, loading: boolean}>`)
   - When a medicine is selected (`updatePrescription` with `product_id`), fetch `pharma_inventory` totals and `prescriptions` consumed for that product, compute available stock
   - Display below the medicine dropdown:
     - If stock = 0 → amber/red warning: "⚠️ This medicine is currently out of stock"
     - If stock > 0 → green info: "Available stock: X units"
   - Message updates instantly on re-selection

### Files to edit

- **`src/components/procedures/ProcedureFormDialog.tsx`** — all changes in this single file

### Technical details

- Stock calculation reuses the same logic already in `createMutation`: `totalInward - totalConsumed`, clamped to 0
- Stock fetch happens inside `updatePrescription` when `field === "product_id"`, stored in state keyed by prescription index
- The dosage field in the DB insert can safely be set to empty string or omitted — existing `prescriptions` table column remains but won't receive new values

