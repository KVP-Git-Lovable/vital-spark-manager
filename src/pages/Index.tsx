import { useState, useMemo } from "react";
import { Users, Calendar, IndianRupee, UserCheck, Clock, Receipt, ClipboardList, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardFilters, DATE_RANGE_OPTIONS } from "@/components/dashboard/DashboardFilters";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardDrillDown } from "@/components/dashboard/DashboardDrillDown";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subMonths, startOfQuarter, eachDayOfInterval,
} from "date-fns";
import { useNavigate } from "react-router-dom";

const statusColors: Record<string, string> = {
  Scheduled: "bg-info/10 text-info",
  Completed: "bg-success/10 text-success",
  Cancelled: "bg-destructive/10 text-destructive",
  "In Progress": "bg-warning/10 text-warning",
  "No Show": "bg-destructive/10 text-destructive",
};

const invoiceStatusColors: Record<string, string> = {
  Paid: "bg-success/10 text-success",
  Partial: "bg-warning/10 text-warning",
  Pending: "bg-destructive/10 text-destructive",
};

function getDateRange(key: string): { start: Date; end: Date } {
  const now = new Date();
  switch (key) {
    case "yesterday": {
      const d = subDays(now, 1);
      return { start: startOfDay(d), end: endOfDay(d) };
    }
    case "last_7":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
    case "last_week": {
      const s = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
      return { start: s, end: endOfWeek(s, { weekStartsOn: 1 }) };
    }
    case "this_month":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "last_month": {
      const m = subMonths(now, 1);
      return { start: startOfMonth(m), end: endOfMonth(m) };
    }
    case "this_quarter":
      return { start: startOfQuarter(now), end: endOfDay(now) };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

const Index = () => {
  const navigate = useNavigate();
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [selectedDateRange, setSelectedDateRange] = useState("today");
  const [selectedService, setSelectedService] = useState("all");
  const [drillDown, setDrillDown] = useState<{ open: boolean; type: string; title: string }>({
    open: false, type: "", title: "",
  });

  const { start, end } = useMemo(() => getDateRange(selectedDateRange), [selectedDateRange]);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Queries
  const { data: staffList = [] } = useQuery({
    queryKey: ["dashboard-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctors").select("id, name, specialization, status").eq("status", "Active").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: serviceList = [] } = useQuery({
    queryKey: ["dashboard-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["dashboard-appointments", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(first_name, last_name), staff(first_name, last_name)")
        .gte("start_time", startISO)
        .lte("start_time", endISO)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["dashboard-invoices", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ["dashboard-pending-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices").select("*")
        .in("status", ["Pending", "Partial"])
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: totalPatients = 0 } = useQuery({
    queryKey: ["dashboard-patient-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("patients").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["dashboard-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, staff(first_name, last_name, role)")
        .eq("date", format(new Date(), "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
  });

  // Filter appointments
  const filtered = useMemo(() => {
    let list = appointments;
    if (selectedStaff !== "all") list = list.filter((a: any) => a.staff_id === selectedStaff);
    if (selectedService !== "all") list = list.filter((a: any) => a.service === selectedService);
    return list;
  }, [appointments, selectedStaff, selectedService]);

  // Filter invoices by staff (via appointment_id match)
  const filteredInvoices = useMemo(() => {
    if (selectedStaff === "all" && selectedService === "all") return invoices;
    const apptIds = new Set(filtered.map((a: any) => a.id));
    return invoices.filter((inv: any) => inv.appointment_id && apptIds.has(inv.appointment_id));
  }, [invoices, filtered, selectedStaff, selectedService]);

  // Chart data
  const chartData = useMemo(() => {
    // Status pie
    const statusMap: Record<string, number> = {};
    filtered.forEach((a: any) => { statusMap[a.status] = (statusMap[a.status] || 0) + 1; });
    const appointmentStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Appointments by Dr
    const drApptMap: Record<string, number> = {};
    const doctorLookup = new Map(staffList.map(d => [d.id, d.name]));
    filtered.forEach((a: any) => {
      const name = a.staff_id ? (doctorLookup.get(a.staff_id) || "Unassigned") : "Unassigned";
      drApptMap[name] = (drApptMap[name] || 0) + 1;
    });
    const appointmentsByDr = Object.entries(drApptMap).map(([name, value]) => ({ name, value }));

    // Billing by Dr - match invoices to appointments to get staff
    const drBillMap: Record<string, number> = {};
    const apptStaffMap: Record<string, string> = {};
    filtered.forEach((a: any) => {
      apptStaffMap[a.id] = a.staff_id ? (doctorLookup.get(a.staff_id) || "Unassigned") : "Unassigned";
    });
    filteredInvoices.forEach((inv: any) => {
      const drName = inv.appointment_id ? (apptStaffMap[inv.appointment_id] || "Unassigned") : "Unassigned";
      drBillMap[drName] = (drBillMap[drName] || 0) + Number(inv.paid_amount || 0);
    });
    const billingByDr = Object.entries(drBillMap).map(([name, value]) => ({ name, value }));

    // Revenue by date (current month)
    const monthStart = startOfMonth(new Date());
    const today = new Date();
    const days = eachDayOfInterval({ start: monthStart, end: today > end ? end : today });
    const revByDate: Record<string, number> = {};
    days.forEach((d) => { revByDate[format(d, "dd MMM")] = 0; });
    filteredInvoices.forEach((inv: any) => {
      const key = format(new Date(inv.created_at), "dd MMM");
      if (revByDate[key] !== undefined) revByDate[key] += Number(inv.paid_amount || 0);
    });
    const revenueByDate = Object.entries(revByDate).map(([date, revenue]) => ({ date, revenue }));

    return { appointmentStatus, appointmentsByDr, billingByDr, revenueByDate };
  }, [filtered, filteredInvoices, end]);

  // Stat card values
  const totalRevenue = filteredInvoices.reduce((s, inv: any) => s + Number(inv.paid_amount || 0), 0);
  const completedCount = filtered.filter((a: any) => a.status === "Completed").length;
  const checkedInStaff = todayAttendance.filter((a: any) => a.check_in_time).length;
  const pendingAmount = pendingInvoices.reduce((s, inv: any) => s + (Number(inv.total_amount) - Number(inv.paid_amount)), 0);
  const dateLabel = DATE_RANGE_OPTIONS.find((o) => o.key === selectedDateRange)?.label || "Today";

  // Drill-down
  const handleChartClick = (type: string) => {
    const titles: Record<string, string> = {
      appointment_status: "Appointments — Status Breakdown",
      appointments_by_dr: "Appointments — By Doctor",
      billing_by_dr: "Billing — By Doctor",
      revenue_by_date: "Revenue — Detail",
    };
    setDrillDown({ open: true, type, title: titles[type] || "Details" });
  };

  const drillDownRecords = useMemo(() => {
    if (drillDown.type === "revenue_by_date" || drillDown.type === "billing_by_dr") return filteredInvoices;
    return filtered;
  }, [drillDown.type, filtered, filteredInvoices]);

  // Today appointments for the list (always today, unfiltered by date range)
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();
  const todayAppts = useMemo(() => {
    return appointments.filter((a: any) => {
      const t = new Date(a.start_time);
      return t >= new Date(todayStart) && t <= new Date(todayEnd);
    });
  }, [appointments, todayStart, todayEnd]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle hidden sm:block">Clinic overview for {format(new Date(), "EEEE, MMMM d")}</p>
      </div>

      <DashboardFilters
        staffList={staffList}
        serviceList={serviceList}
        selectedStaff={selectedStaff}
        selectedDateRange={selectedDateRange}
        selectedService={selectedService}
        onStaffChange={setSelectedStaff}
        onDateRangeChange={setSelectedDateRange}
        onServiceChange={setSelectedService}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard title={`Appointments`} value={filtered.length} change={`${completedCount} completed • ${dateLabel}`} changeType="neutral" icon={Calendar} iconColor="bg-info/10 text-info" delay={0} />
        <StatCard title="Total Patients" value={totalPatients} change="All time" changeType="neutral" icon={Users} delay={0.05} />
        <StatCard title={`Revenue`} value={`₹${totalRevenue.toLocaleString()}`} change={dateLabel} changeType="positive" icon={IndianRupee} iconColor="bg-success/10 text-success" delay={0.1} />
        <StatCard title="Staff Present" value={`${checkedInStaff}`} change="Today" changeType="neutral" icon={UserCheck} iconColor="bg-warning/10 text-warning" delay={0.15} />
      </div>

      <DashboardCharts data={chartData} onChartClick={handleChartClick} />

      <DashboardDrillDown
        open={drillDown.open}
        onOpenChange={(open) => setDrillDown((p) => ({ ...p, open }))}
        title={drillDown.title}
        records={drillDownRecords}
        type={drillDown.type}
      />

      {/* Lists section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-2 data-table">
          <div className="p-4 md:p-5 border-b flex items-center justify-between">
            <h2 className="font-display font-semibold text-base md:text-lg">Today's Appointments</h2>
            <button onClick={() => navigate("/appointments")} className="text-xs text-primary hover:underline">View All</button>
          </div>
          <div className="divide-y max-h-[320px] overflow-y-auto">
            {todayAppts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No appointments for today</div>
            ) : (
              todayAppts.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between p-3 md:p-4 hover:bg-muted/50 transition-colors gap-2 cursor-pointer" onClick={() => navigate("/appointments")}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-semibold text-xs shrink-0">
                      {apt.patients ? `${apt.patients.first_name[0]}${apt.patients.last_name[0]}` : apt.patient_name?.[0] || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{apt.patients ? `${apt.patients.first_name} ${apt.patients.last_name}` : apt.patient_name || "Walk-in"}</p>
                      <p className="text-xs text-muted-foreground truncate">{apt.service}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-xs text-muted-foreground">{format(new Date(apt.start_time), "h:mm a")}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColors[apt.status] || "bg-muted"}`}>{apt.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="data-table">
          <div className="p-4 md:p-5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display font-semibold text-base md:text-lg">Pending Invoices</h2>
            </div>
            <button onClick={() => navigate("/billing")} className="text-xs text-primary hover:underline">View All</button>
          </div>
          <div className="divide-y max-h-[280px] overflow-y-auto">
            {pendingInvoices.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No pending invoices 🎉</div>
            ) : (
              pendingInvoices.map((inv: any) => (
                <div key={inv.id} className="p-3 md:p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/billing")}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-primary underline">{inv.invoice_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${invoiceStatusColors[inv.status]}`}>{inv.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate mr-2">{inv.patient_name || "Walk-in"}</span>
                    <span className="font-medium text-foreground whitespace-nowrap">₹{(Number(inv.total_amount) - Number(inv.paid_amount)).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          {pendingAmount > 0 && (
            <div className="p-3 md:p-4 border-t bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">₹{pendingAmount.toLocaleString()} total pending</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
