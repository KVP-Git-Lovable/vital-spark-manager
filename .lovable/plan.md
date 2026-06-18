## Harden Patient dropdown rendering

Make `PatientCombobox` deterministic so a patient row never renders as a bare phone number, even when `first_name` in the DB equals the phone.

### Changes in `src/components/patients/PatientCombobox.tsx`

1. **`displayName(p)`** — drop the `if (name) return name` fallback. Return the trimmed name only when `hasMeaningfulName(p)` is true; otherwise return `"Unnamed"`. This guarantees `displayName` never returns a phone-like string.

2. **`displayRow(p)`** — rewrite as a deterministic builder:
   - `name = hasMeaningfulName(p) ? rawName.trim() : "Unnamed"`
   - `phone = (p.phone || "").trim()`
   - If `phone` → return `` `${name} — ${phone}` ``
   - Else → return `name`
   - Final guard: if the resulting label still matches `PHONE_LIKE_NAME`, prepend `"Unnamed — "`.

3. **Selected trigger button** — replace `displayName(selected)` with `displayRow(selected)` so the closed combobox shows the same `"Name — Phone"` format as the list.

4. **Sort order** (already correct, keep explicit): named patients first (alphabetical by name), then unnamed entries sorted by phone. Add a brief comment so it isn't accidentally reverted.

5. **Test hook** — add `data-testid="patient-row"` on each row button for future verification.

### Out of scope

- No DB migration (phone-as-name rows stay as-is; they'll just render as `"Unnamed — <phone>"`).
- No changes to `StaffCombobox`, `VendorCombobox`, or `ProcedureFormDialog` — already verified clean.
- No service-worker / cache changes; a hard refresh after deploy will pick up the new bundle.

### Verification

Open New Procedure → Patient dropdown:
- Named patients appear first, alphabetically.
- Phone-only patients appear at the bottom as `"Unnamed — 7019029338"`.
- No row renders as a bare phone number.
- Selecting a phone-only patient shows `"Unnamed — 7019029338"` in the trigger.
