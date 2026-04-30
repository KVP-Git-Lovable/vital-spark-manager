## Goal

Allow users to pin saved reports from `/report-builder` onto the main Dashboard (`/`) as live widgets, where each widget renders inline using the report's existing `chart_type` (table/bar/doughnut/line/number) and respects the Dashboard's date/staff filters when applicable.

## 1. Database — new `dashboard_pins` table

Migration:

```sql
create table public.dashboard_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,             -- auth.uid() of pinning user
  report_id uuid not null references public.saved_reports(id) on delete cascade,
  position int not null default 0,   -- ordering on dashboard
  created_at timestamptz not null default now(),
  unique (user_id, report_id)
);
alter table public.dashboard_pins enable row level security;

-- Policies: users see/manage only their own pins
create policy "pins: select own" on public.dashboard_pins
  for select to authenticated using (auth.uid() = user_id);
create policy "pins: insert own" on public.dashboard_pins
  for insert to authenticated with check (auth.uid() = user_id);
create policy "pins: delete own" on public.dashboard_pins
  for delete to authenticated using (auth.uid() = user_id);
create policy "pins: update own" on public.dashboard_pins
  for update to authenticated using (auth.uid() = user_id);
```

Per-user pinning matches existing patterns (each clinician sees their own dashboard). No changes to `saved_reports`.

## 2. Pin action in Report Builder

`src/components/reports/ReportList.tsx` — add a Pin/Unpin icon button next to the existing View/Edit/Delete buttons.

- Component fetches the current user's pins (set of `report_id`).
- Toggle handler calls `supabase.from("dashboard_pins").insert(...)` / `.delete()`.
- Icon: `Pin` (filled when pinned) from `lucide-react`, with tooltip "Pin to Dashboard" / "Unpin from Dashboard".
- Toast on success.

`src/pages/ReportConfigurator.tsx` passes a refreshable pin set into `ReportList`.

Also add the same Pin icon button in `ReportViewer.tsx` header so users can pin while viewing a report.

## 3. New Dashboard section — "Pinned Reports"

New file `src/components/dashboard/PinnedReports.tsx`:

- Loads `dashboard_pins` joined with `saved_reports` for current user, ordered by `position`.
- Renders a responsive grid (1 col mobile / 2 col md / 3 col lg) of `PinnedReportWidget` cards.
- Empty state: muted hint "Pin reports from Report Builder to see them here."

New file `src/components/dashboard/PinnedReportWidget.tsx`:

- Header row: report name (bold) + small badge with chart type + "Updated <relative time>" (using `report.updated_at`).
- Action row (top-right): Open icon → navigates to `/report-builder?view=<id>`; Unpin icon (X / PinOff).
- Body: renders `<ReportPreview {...report} compact />`. Existing `compact` prop already shrinks the inline preview.
- Card height capped (~280px) with internal scroll for tables.
- `chart_type === "number"` and `"table"` get a "summary stat" treatment: the widget pulls the first value/count out of `ReportPreview`'s rendered output via the existing `number` mode.

Mount the section in `src/pages/Index.tsx` directly under the existing 4 stat cards and above `DashboardCharts`, with section heading "Pinned Reports".

## 4. Apply Dashboard filters to widgets

`PinnedReports` receives `{ start, end, staffId }` from `Index.tsx`. For each pinned report it constructs a runtime filter set:

- Start with the saved `report.filters`.
- If the primary object exposes a date field (`created_at`, `start_time`, `procedure_date`, `invoice_date`), append `gte`/`lte` filters using `start`/`end`.
- If primary object has a `staff_id` field and `staffId !== "all"`, append `staff_id equals <staffId>`.
- Pass the merged filter array into `ReportPreview`.

This is best-effort: when a report's object doesn't have the relevant field we silently skip injection (existing report behavior unchanged). A small "Filtered" indicator appears on widgets where Dashboard filters were applied.

## 5. Routing for "open full report"

`/report-builder` already supports `view` mode internally. Update `ReportConfigurator.tsx` to read `?view=<id>` from the URL on mount and auto-open that report in the existing `ReportViewer`.

## Files touched

- New migration: `dashboard_pins` table + RLS policies.
- New: `src/components/dashboard/PinnedReports.tsx`, `src/components/dashboard/PinnedReportWidget.tsx`.
- Edited: `src/components/reports/ReportList.tsx` (Pin button), `src/components/reports/ReportViewer.tsx` (Pin button in header), `src/pages/ReportConfigurator.tsx` (pin-set fetch + `?view=` query handling), `src/pages/Index.tsx` (mount Pinned Reports section, pass filters).

## Out of scope

- Drag-and-drop reordering (uses insertion order; can be added later).
- Sharing pins across users / global org pins.
- Caching/refresh policies beyond TanStack Query defaults — widgets re-fetch when filters change.
