## Problem

`patients` table now has **17,442 rows**. Both screens currently fetch the entire table client-side and then paginate in memory:

- `src/pages/Patients.tsx` calls `fetchAll(...)` (18 sequential 1000-row Supabase requests) then passes **all 17K patient IDs** into `useEngagementScores`, which POSTs them in a single request to the `patient-engagement` edge function. The edge call is what makes the page sit on the spinner — it either times out or returns a payload that takes seconds to parse.
- `src/pages/ReportView.tsx` runs the Patients report via `report.fetcher` in `src/lib/reportsCatalog.ts`, which also uses `fetchAll` over the full table. With no engagement call it eventually finishes, but it blocks the UI for many seconds and exhausts memory on lower-end devices.

Fix: switch both screens to true **server-side pagination + lazy loading**, and only compute engagement for the rows currently on screen.

---

## 1. Patients page — `src/pages/Patients.tsx`

Convert from "fetch everything, paginate locally" to "fetch one page at a time".

- Replace `fetchPatients` with a paged query keyed on `[page, debouncedSearch]`:
  - Use `supabase.from("patients").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to)`.
  - When `search` is non-empty, add an `or(...)` filter on `first_name`, `last_name`, `email`, `phone` using `ilike`.
  - Debounce `search` (~300 ms) before it hits the query key so typing doesn't fire a request per keystroke.
- Drive pagination from the server `count` instead of `filtered.length`. Keep page size 50.
- Keep `keepPreviousData: true` so the table doesn't flash empty between pages (smooth lazy loading feel).
- Remove the in-memory `filtered` / `paged` slicing.
- Pass **only the current page's IDs** to `useEngagementScores`. Engagement badges will load lazily per page — exactly what the user sees. (Cache it via React Query's default cache so re-visiting a page is instant.)
- Bulk delete: `selectedIds` already lives outside the page slice, so the existing delete-by-id call still works. After delete, `refetch()` the current page.
- "Select all" checkbox only selects the visible page (already the case).

## 2. Patients report — `src/lib/reportsCatalog.ts` + `src/pages/ReportView.tsx`

The report architecture currently assumes "fetcher returns all rows, then filter / sort / chart / paginate client-side". For 17K+ rows that's the bottleneck. Two options — proposing the lighter one:

**Add a `paged` mode for the Patients report only** (other reports stay as-is since their tables are much smaller):

- Extend `ReportConfig` with optional `paged?: { pageSize: number; fetchPage: (args) => Promise<{ rows: any[]; total: number }>; chartFetch?: () => Promise<{label,value}[]> }`.
- For the Patients report, implement `fetchPage` using the same server-side pattern as the Patients page (range + count + ilike search + date range).
- For the chart ("Patients by Source"), do a single lightweight aggregation query (`select source` paged in 1000-row chunks but only the `source` column — fast even for 17K rows, ~50 KB) and group in memory. Cache via React Query (`["report-chart","patients"]`).
- `ReportView.tsx`:
  - When `report.paged` is set, ignore `fetcher`. Drive the table from the paged query (with a local `page` state + filter state in the query key) and pass server `total` into the summary bar / pagination.
  - `SortableDataTable` currently sorts the rows it receives. For the paged Patients report we accept that sorting only sorts the visible page (Salesforce behaves the same for very large datasets). Add a small note in the header: *"Sort applies to current page"*. No structural change to `SortableDataTable`.
  - CSV export for the paged report: when the user clicks **Export**, fetch all matching rows in the background using the same paged query (chunks of 1000) and stream to CSV. Show a small spinner on the button while it runs.

Other reports (Appointments, Invoices, Expenses, Pharmacy Bills, Campaigns) keep their current full-fetch behavior — their row counts are well under the danger zone.

## 3. Out of scope

- No DB schema or RLS changes.
- No changes to `patient-engagement` edge function (we just stop sending it 17K IDs at once).
- No changes to other report keys, filter bar, chart switcher, or `SortableDataTable` internals beyond the small "current page" hint.

## Files touched

- `src/pages/Patients.tsx` — server-side paged query, debounced search, per-page engagement.
- `src/lib/reportsCatalog.ts` — `paged` field on `ReportConfig`; Patients report gets `paged.fetchPage` + lightweight chart aggregator.
- `src/pages/ReportView.tsx` — branch on `report.paged` to drive table + summary + CSV export from the paged fetcher.
