

## Plan: Auto-include Services fee in Invoice total

### Root cause
In `src/pages/Billing.tsx`, when a service is picked from the dropdown, `updateServiceInput` only stores the name. The Services Subtotal field stays at 0 unless the user manually types an amount. So Services fee is excluded from Subtotal/GST/Grand Total, while Pharma products are auto-summed (because pharma items track their own qty × price).

### Fix
Make Services behave like Pharma — auto-sum from picked service prices.

**1. Track per-row price**
Change `serviceInputs` from `string[]` (just names) to `{ name: string; price: number }[]`. Update `addServiceInput`, `removeServiceInput`, and the prefill effect (line 295–305) accordingly.

**2. Auto-fill price on selection**
In the service Popover `onSelect` (line 807), pass both name and `svc.price` to `updateServiceInput`, which sets `{ name: svc.name, price: svc.price || 0 }` for that row.

**3. Derive Services Subtotal automatically**
Replace the editable `totalAmount` state with a memo:
```ts
const servicesSubtotal = useMemo(
  () => serviceInputs.reduce((sum, s) => sum + (s.price || 0), 0),
  [serviceInputs]
);
```
Show each service's price next to its row (small muted label, like pharma rows show line totals) and a "Services subtotal: ₹X" line under the list — mirroring the pharma section.

**4. Services Subtotal field**
Convert the "Services Subtotal (₹)" Input (line 939) to a read-only display showing the auto-computed total, OR keep it editable as an override (default = computed value). Recommended: read-only display + small "Edit" toggle for manual override (rarely needed).

**5. Update everywhere `totalAmount` is read**
- One-time grand-total calc (line 947): `subtotal = servicesSubtotal + pharmaSubtotal`
- `createInvoice` mutation One-time branch (line ~471): use `servicesSubtotal` instead of `totalAmount`
- `resetForm` and Staged/Recurring reset
- `canCreateInvoice` (no logic change needed)

**6. Existing services in `serviceInputs` array passed to invoice**
`allServices` (line 390) — extract `.name` from objects: `serviceInputs.filter(s => s.name.trim()).map(s => s.name)`.

### Files
- Modified: `src/pages/Billing.tsx`

No DB migration. No changes to pharma logic. Tax (GST) calculation already uses `subtotal = totalAmount + pharmaSubtotal`, so it will correctly include services once `totalAmount` reflects the picked services.

