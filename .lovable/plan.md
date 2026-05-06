## Reports Module — Salesforce-style Tabular Reports

Replace the current chart-only `Reports` page with a Salesforce-like report center: a list of canned reports, each opening a clean filterable, sortable table where every row drills into the underlying record.

### Reports to include (canned)
1. **Patients** — name, phone, gender, source, campaign, created. Row → `/patients/:id`. Filters: date range (created), source, status.
2. **Appointments** — patient, service, staff, start time, status. Row → `/appointments` (with selected id query param). Filters: date range (start_time), staff, status.
3. **Invoices / Revenue** — invoice #, patient, total, paid, status, date. Row → `/billing`. Filters: date range, payment status, payment mode.
4. **Expenses** — date, title, category, vendor, amount, mode. Row → `/expenses`. Filters: date range, category, payment mode.
5. **Pharma Bills** — bill #, patient, total, payment mode, date. Row → `/pharma`. Filters: date range, payment mode.
6. **Campaigns ROI** — name, type, status, budget, spent, dates. Row → `/campaigns/:id`. Filters: type, status.

### UX (Salesforce-style)
- `/reports` lists all reports as cards grouped by category (Patients / Operations / Finance / Marketing).
- Click a report → `/reports/:key` opens a full-width report view:
  - **Header**: report title, subtitle, "Back to Reports", export CSV button.
  - **Filter bar**: date range picker + report-specific dropdowns (staff, status, etc.) + search box. "Clear filters" link. Active filter chips.
  - **Summary strip**: row count + key totals (e.g. Total Revenue, Avg Invoice).
  - **Table**: sticky header, sortable columns (click header → asc/desc with arrow icon), zebra rows, hover highlight, row cursor pointer, click → navigate to record. Compact rows similar to existing `data-table` style.
  - Pagination (50/page) for large sets.

### Technical

New files:
- `src/pages/Reports.tsx` — rewritten as report catalog (cards linking to `/reports/:key`).
- `src/pages/ReportView.tsx` — generic report viewer driven by a config object.
- `src/lib/reportsCatalog.ts` — declarative config: each report has `key`, `title`, `category`, `description`, data fetcher (Supabase query), columns `[{key, label, render?, sortable, type}]`, filter definitions, `rowHref(row)` for drill-down, optional summary aggregator.
- `src/components/reports/SortableDataTable.tsx` — reusable table with sort state, sticky header, row click handler.
- `src/components/reports/ReportFilterBar.tsx` — renders filter inputs from config (date range, select, text), maintains URL-synced state via `useSearchParams`.

Routing (`src/App.tsx`):
- Add `<Route path="/reports/:key" element={<ProtectedRoute moduleKey="reports"><ReportView /></ProtectedRoute>} />`.

Data fetching: TanStack Query, one query per report keyed on `[reportKey, filters]`. Use `fetchAll` from `src/lib/supabasePaginate.ts` to bypass the 1000-row cap. Client-side sort + filter for already-fetched rows; server-side date filter applied in the query for performance.

Export CSV: simple client-side conversion of currently-visible filtered rows.

Sidebar: "Reports" entry already exists — no change needed.

The existing chart dashboard previously on `/reports` is preserved on the main dashboard (`/`); the Reports page becomes purely the Salesforce-style report center.

### Out of scope
- Saved custom reports (already covered by Report Builder).
- Pivot/grouping (use Report Builder).
- Scheduled report emails.
