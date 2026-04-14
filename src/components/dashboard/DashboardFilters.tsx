import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  specialization: string;
}

interface Service {
  id: string;
  name: string;
}

interface Props {
  staffList: StaffMember[];
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
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <Select value={selectedStaff} onValueChange={onStaffChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="All Staff" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All Staff</SelectItem>
          {staffList.map((d) => (
            <SelectItem key={d.id} value={d.id} className="text-xs">
              {d.first_name} {d.last_name}
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
