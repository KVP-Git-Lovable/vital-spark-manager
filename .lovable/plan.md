## Problem

The dashboard queries already exist but the numbers feel "empty/wrong" because:

- **Today (2026-04-27 IST)** genuinely has 0 appointments in the DB, while 2026-04-28 has 3. The "Today" filter currently uses local browser midnight converted to UTC ISO, which is correct in IST but the empty result looks like a bug.
- **Revenue** sums only `paid_amount`. Today's 2 invoices have `paid_amount = 0` and `total_amount = ₹9,243`, so the card shows ₹0 even though invoices exist.
- **Revenue Trend** chart is hard-coded to the current calendar month — ignores the Date Range filter.
- **Billing-by-Staff** only attributes invoices that have an `appointment_id`. Invoices without that link silently disappear when a staff filter is applied.
- **Appointment Status** pie has color entries only for Scheduled / Completed / Cancelled / In Progress / No Show — real data also contains Proposed, Requested, Rescheduled which fall back to grey.

## Fix

### 1. Stat cards
- **Appointments**: keep filtered count, subtitle becomes `X completed • Y scheduled • {dateLabel}`.
- **Revenue**: show `₹{paid}` as primary value, with subtitle `of ₹{invoiced} invoiced • {dateLabel}` (per your choice). Both numbers use the filtered invoice list.

### 2. Appointment Status pie
- Use real status counts from filtered appointments (already correct).
- Add color mappings for `Proposed`, `Requested`, `Rescheduled`, `No-show` so every slice is themed.

### 3. Appointments by Staff bar
- Already correct logic. Sort descending by count, drop "Unassigned" if zero, cap to top 8 with "Other" rollup so the chart stays readable.

### 4. Billing by Staff bar — main fix
Today most invoices don't have `appointment_id`. Two changes:
- Sum `paid_amount` per staff via the appointment join when available.
- For invoices without `appointment_id`, group as "Walk-in / Direct billing" instead of dropping them when a staff filter is active (only hide them when a specific staff is selected).
- Show both Paid and Invoiced as grouped bars (matches new revenue definition).

### 5. Revenue Trend chart
- Build the day-by-day series from the **selected date range** (not current month).
- For Today / Yesterday → bucket by hour. For ranges ≤ 31 days → bucket by day. For longer → bucket by week.
- Render two lines: **Paid** (solid) and **Invoiced** (dashed).

### 6. Filter wiring
- Staff filter: appointments filtered by `staff_id`; invoices filtered via the appointment lookup or `staff_id` if present on the invoice.
- Service filter: appointments filtered by `service`; invoices filtered to those linked to a matching appointment.
- Date range: every query refetches when `startISO` / `endISO` change (already wired); Revenue Trend now also uses these.

## Files to edit

- `src/pages/Index.tsx` — change `chartData` calc (revenue trend uses `start`/`end`, billing-by-staff handles null appointment_id, both paid+invoiced totals), update Revenue + Appointments stat cards, expand status color map.
- `src/components/dashboard/DashboardCharts.tsx` — accept `revenueByDate` items as `{ date, paid, invoiced }`, render two lines; update billing bar to grouped Paid/Invoiced; expand `STATUS_COLORS`.
- `src/components/dashboard/StatCard.tsx` — no change needed; subtitle already supported via `change` prop.

No schema changes. No new queries beyond what's already fetched.