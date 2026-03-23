import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Service {
  id: string;
  name: string;
}

interface Props {
  staffList: Staff[];
  serviceList: Service[];
  selectedStaff: string;
  selectedDateRange: string;
  selectedService: string;
  onStaffChange: (v: string) => void;
  onDateRangeChange: (v: string) => void;
  onServiceChange: (v: string) => void;
}

export const DATE_RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7", label: "Last 7 Days" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "Current Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "Current Quarter" },
];

export function DashboardFilters({
  staffList,
  serviceList,
  selectedStaff,
  selectedDateRange,
  selectedService,
  onStaffChange,
  onDateRangeChange,
  onServiceChange,
}: Props) {
  const doctors = staffList.filter((s) => s.role === "Doctor" || s.role === "Dermatologist");

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <Select value={selectedStaff} onValueChange={onStaffChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="All Doctors" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All Doctors</SelectItem>
          {doctors.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              Dr. {s.first_name} {s.last_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedDateRange} onValueChange={onDateRangeChange}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.key} value={o.key} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedService} onValueChange={onServiceChange}>
        <SelectTrigger className="w-[180px] h-8 text-xs">
          <SelectValue placeholder="All Services" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All Services</SelectItem>
          {serviceList.map((s) => (
            <SelectItem key={s.id} value={s.name} className="text-xs">{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
