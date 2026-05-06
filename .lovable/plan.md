## Goal

The Reports module already has a Salesforce-style viewer (summary KPIs, filters, sortable table, drill-down rows, CSV export). The piece missing from the user's spec is a **visual chart section** between the summary bar and the data table, plus richer summary metrics. This plan adds that without disturbing the existing structure.

## Changes

### 1. Extend `ReportConfig` in `src/lib/reportsCatalog.ts`

Add an optional `chart` definition per report:

```ts
chart?: {
  type: "bar" | "horizontalBar";
  title: string;
  // Build chart series from filtered rows
  build: (rows: any[]) => { label: string; value: number }[];
  valueLabel?: string; // e.g. "Patients", "₹ Revenue"
};
```

Define `chart` for each report:
- **Patients** → group by `city` (top 10), value = count.
- **Appointments** → group by `status`, value = count.
- **Invoices** → group by month of `created_at`, value = sum of `total_amount`.
- **Expenses** → group by month, value = sum of `amount`.
- **Pharmacy Bills** → group by `payment_mode`, value = sum of `net_amount`.
- **Campaigns ROI** → bar per campaign comparing budget vs spent (use horizontal bar with two series — see note below; if simpler, plot `amount_spent` per campaign).

Also enrich `summary` where useful:
- Patients: add **Total LTV** (sum of `total_amount` across joined invoices is heavy — instead show "New this month" count).
- Appointments: add **Completion rate %**.
- Invoices: already strong.

### 2. New component `src/components/reports/ReportChart.tsx`

Recharts-based, responsive bar chart:
- Uses `BarChart` + `ResponsiveContainer` from recharts (already a dep — see `DashboardCharts.tsx`).
- Reads HSL semantic tokens (`--primary`, `--chart-1`, etc.) for color — no hardcoded colors.
- Renders inside a card-styled wrapper matching `.data-table` look.
- Empty state: "No data to chart for current filters."
- Height ~260px, `XAxis` label rotated 45° if >6 categories.

### 3. Wire chart into `src/pages/ReportView.tsx`

Layout becomes:
1. Header (title + back + Export CSV)
2. Filter bar
3. Summary KPI cards
4. **Chart card** (only if `report.chart` defined and rows present)
5. Sortable data table

Pass `report.chart.build(filteredRows)` to `<ReportChart>`.

### 4. Layout polish

- Summary cards remain `grid-cols-2 md:grid-cols-4`.
- Chart card full-width, mt-4.
- Table sits beneath chart.

## Out of scope

- No new routes, no DB changes.
- No grouped/pivot tables (handled by separate Report Configurator).
- Pagination, sorting, drill-down, CSV export are already implemented — left untouched.

## Files

- Edit `src/lib/reportsCatalog.ts` — add `chart` configs + minor summary tweaks.
- Add `src/components/reports/ReportChart.tsx`.
- Edit `src/pages/ReportView.tsx` — render `<ReportChart>` between summary and table.
