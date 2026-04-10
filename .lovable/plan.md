

## Plan: Add "Lifetime Value" Stat to Engagement Score Card

### What We Are Building

Adding a "Lifetime Value" stat to the existing stats row (Visits, Services, Billed, Last Visit) in the `EngagementScoreCard` component. It will query the `invoices` table directly using `patient_id` to sum `total_amount`, formatted as INR with Indian number formatting.

### Implementation

**File: `src/components/patients/EngagementScoreCard.tsx`**

1. Add a `useQuery` hook (from `@tanstack/react-query`) to fetch the sum of `total_amount` from `invoices` where `patient_id` matches.
2. Insert a new stat column between "Billed" and "Last Visit" in the stats row (line ~193), displaying:
   - The summed value formatted with `toLocaleString('en-IN')` prefixed with ₹
   - Label: "Lifetime Value"
   - Same styling as existing stats (`text-base font-bold` for value, `text-[10px] text-muted-foreground` for label)
3. Add `IndianRupee` icon import from lucide-react for visual consistency.

### Technical Details

- Query: `supabase.from("invoices").select("total_amount").eq("patient_id", patientId)`
- Client-side sum of returned rows' `total_amount`
- Uses existing `flex-1` layout so the new stat fits naturally in the row
- No database changes needed

