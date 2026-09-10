/** Named dashboards on the home overview: which widgets each one shows. */
export interface DashboardTab {
  id: string;
  name: string;
  widgets: string[];
  custom?: boolean;
}

export const DASHBOARD_WIDGETS = [
  { key: "appointments_total", label: "Total Appointments" },
  { key: "appointments_confirmed", label: "Confirmed Appointments" },
  { key: "appointments_completed", label: "Completed Appointments" },
  { key: "revenue", label: "Revenue" },
  { key: "staff_present", label: "Staff Present" },
  { key: "new_patients", label: "New Patients Added" },
  { key: "total_patients", label: "Total Patients" },
  { key: "active_campaigns", label: "Active Campaigns" },
  { key: "pinned_reports", label: "Pinned Reports" },
  { key: "charts", label: "Charts" },
  { key: "today_appointments", label: "Today's Appointments" },
  { key: "pending_invoices", label: "Pending Invoices" },
];

export const DEFAULT_DASHBOARDS: DashboardTab[] = [
  {
    id: "dr360",
    name: "Dr. 360 Dashboard",
    widgets: [
      "appointments_total",
      "appointments_confirmed",
      "appointments_completed",
      "revenue",
      "staff_present",
      "pinned_reports",
      "charts",
      "today_appointments",
      "pending_invoices",
    ],
  },
  {
    id: "patient360",
    name: "Patient 360 Dashboard",
    widgets: ["new_patients", "total_patients", "today_appointments"],
  },
  {
    id: "marketing360",
    name: "Marketing 360 Dashboard",
    widgets: ["active_campaigns", "charts"],
  },
];

const KEY = "dashboard-tabs-v1";

export function loadDashboardTabs(): DashboardTab[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_DASHBOARDS;
    const saved = JSON.parse(raw) as DashboardTab[];
    if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_DASHBOARDS;
    return saved;
  } catch {
    return DEFAULT_DASHBOARDS;
  }
}

export function saveDashboardTabs(tabs: DashboardTab[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tabs));
  } catch {
    /* ignore storage failures */
  }
}
