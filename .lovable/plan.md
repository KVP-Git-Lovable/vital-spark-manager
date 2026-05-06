## Reports — Chart fixes & chart type switcher

### 1. Patients chart fix (`src/lib/reportsCatalog.ts`)
- Change Patients default chart from "Patients by City" to **"Patients by Source"** (most consistently populated field, already a filter option).
- Update `groupCount` helper to accept an `excludeBlank` flag. When true, skip rows whose value is null/empty/whitespace/`"Unknown"` instead of bucketing them into a fallback. Use this for the Source chart so empty values don't dominate.
- Keep the City grouping logic available but no longer the default; if/when used, also apply the blank filter so only cities with real data appear.

### 2. Chart type switcher (`src/components/reports/ReportChart.tsx`)
- Add a small toggle group in the chart header with 4 icons (lucide): `BarChart3` (Bar), `PieChart` (Pie), `Donut`/`CircleDot` (Doughnut), `LineChart` (Line).
- Local state `chartType` with default `"bar"`. Persist per report in `localStorage` under key `report-chart-type:<reportKey>` so each report remembers its last-used chart type across reloads. Pass `reportKey` as a new prop from `ReportView`.
- Render the selected variant with Recharts:
  - **Bar**: existing implementation (vertical or horizontal based on `orientation` prop).
  - **Line**: `LineChart` with the same `{label, value}` series, single line using `hsl(var(--primary))`, dot markers.
  - **Pie**: `PieChart` + `Pie` with `Cell`s cycling through `PALETTE`, label showing `label` + percent, legend below.
  - **Doughnut**: same as Pie but with `innerRadius` set (e.g. 50–60) for the ring look.
- Keep the empty-state message and the existing card wrapper (`data-table p-4 mb-4`).
- Tooltip styling, axis fonts, and palette tokens reuse the current HSL semantic tokens — no new colors introduced.

### 3. Wire-through (`src/pages/ReportView.tsx`)
- Pass `reportKey={report.key}` to `<ReportChart>` so it can scope its persisted chart-type preference.
- No other changes; switcher applies automatically to all reports that already declare a `chart` config (Patients, Appointments, Invoices, Expenses, Pharmacy Bills, Campaigns ROI).

### Out of scope
- No DB or fetcher changes.
- No new routes, no changes to filters/summary/table.
- Horizontal-bar reports (Campaigns) keep their current orientation when "Bar" is selected; Pie/Doughnut/Line ignore orientation.

### Files touched
- `src/lib/reportsCatalog.ts` — Patients chart switched to Source; helper supports excluding blanks.
- `src/components/reports/ReportChart.tsx` — chart-type toggle, Pie/Doughnut/Line renderers, localStorage persistence.
- `src/pages/ReportView.tsx` — pass `reportKey` prop.
