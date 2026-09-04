import { useState, useMemo } from "react";
import { Users, Calendar, IndianRupee, UserCheck, Clock, Receipt, ClipboardList, AlertCircle, Megaphone } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardFilters, DATE_RANGE_OPTIONS } from "@/components/dashboard/DashboardFilters";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardDrillDown } from "@/components/dashboard/DashboardDrillDown";
import { PinnedReports } from "@/components/dashboard/PinnedReports";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subMonths, startOfQuarter, eachDayOfInterval,
  eachHourOfInterval, eachWeekOfInterval, differenceInDays,
} from "date-fns";
import { useNavigate } from "react-router-dom";

// Data-heavy panels are capped so a large date range can never turn into a
// full-table scan that the database cancels (statement timeout).
const DASH_ROW_CAP = 5000;
const NEW_PATIENTS_CAP = 500;

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
  const [drillDown, setDrillDown] = useState<{ open: boolean; kind: "invoices" | "appointments" | "patients"; title: string; records: any[] }>({
    open: false, kind: "appointments", title: "", records: [],
  });

  const { start, end } = useMemo(() => getDateRange(selectedDateRange), [selectedDateRange]);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Queries
  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-active-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, first_name, last_name, role, specialization").eq("is_active", true).order("first_name");
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
        .select("*, patients(first_name, last_name)")
        .gte("start_time", startISO)
        .lte("start_time", endISO)
        .order("start_time")
        .limit(DASH_ROW_CAP);
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
        .order("created_at", { ascending: false })
        .limit(DASH_ROW_CAP);
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

  const { data: activeCampaigns = [] } = useQuery({
    queryKey: ["dashboard-active-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns" as any).select("id, amount_spent").eq("status", "Active");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: problemAreas = [] } = useQuery({
    queryKey: ["dashboard-problem-areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("problem_areas").select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: newPatients = { rows: [] as any[], count: 0 } } = useQuery({
    queryKey: ["dashboard-new-patients", startISO, endISO],
    queryFn: async () => {
      // Count comes from the database; only a capped slice of rows is pulled
      // down for the drill-down list.
      const { data, error, count } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone, email, gender, created_at", { count: "exact" })
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false })
        .limit(NEW_PATIENTS_CAP);
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
  });
  const newPatientsRaw = newPatients.rows;

  const doctorLookup = useMemo(
    () => new Map(staffList.map((d: any) => [d.id, `${d.first_name} ${d.last_name}`])),
    [staffList]
  );
  const areaLookup = useMemo(
    () => new Map((problemAreas as any[]).map((p) => [p.id, p.name])),
    [problemAreas]
  );
  const apptById = useMemo(() => new Map(appointments.map((a: any) => [a.id, a])), [appointments]);

  // Filter appointments
  const filtered = useMemo(() => {
    let list = appointments as any[];
    if (selectedStaff !== "all") list = list.filter((a: any) => a.staff_id === selectedStaff);
    if (selectedService !== "all") list = list.filter((a: any) => a.service === selectedService);
    return list.map((a: any) => ({
      ...a,
      _staffName: a.staff_id ? doctorLookup.get(a.staff_id) || "Unassigned" : "Unassigned",
    }));
  }, [appointments, selectedStaff, selectedService, doctorLookup]);

  // Filter invoices by staff/service (via doctor_id or linked appointment) and enrich
  const filteredInvoices = useMemo(() => {
    const apptIds = new Set(filtered.map((a: any) => a.id));
    let list = invoices as any[];
    if (selectedStaff !== "all" || selectedService !== "all") {
      list = list.filter(
        (inv: any) =>
          (inv.appointment_id && apptIds.has(inv.appointment_id)) ||
          (selectedService === "all" && selectedStaff !== "all" && inv.doctor_id === selectedStaff)
      );
    }
    return list.map((inv: any) => {
      const appt = inv.appointment_id ? apptById.get(inv.appointment_id) : null;
      const staffId = inv.doctor_id || appt?.staff_id;
      return {
        ...inv,
        _doctorName: staffId ? doctorLookup.get(staffId) || "Unassigned" : "Walk-in / Direct",
        _areas: ((appt?.problem_area_ids as string[]) || [])
          .map((id) => areaLookup.get(id))
          .filter(Boolean) as string[],
      };
    });
  }, [invoices, filtered, selectedStaff, selectedService, apptById, doctorLookup, areaLookup]);

  // Chart data
  const chartData = useMemo(() => {
    // Status pie
    const statusMap: Record<string, number> = {};
    filtered.forEach((a: any) => { statusMap[a.status] = (statusMap[a.status] || 0) + 1; });
    const appointmentStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Appointments by Staff
    const drApptMap: Record<string, number> = {};
    filtered.forEach((a: any) => {
      drApptMap[a._staffName] = (drApptMap[a._staffName] || 0) + 1;
    });
    let appointmentsByDr = Object.entries(drApptMap)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => !(d.name === "Unassigned" && d.value === 0))
      .sort((a, b) => b.value - a.value);
    if (appointmentsByDr.length > 8) {
      const top = appointmentsByDr.slice(0, 8);
      const other = appointmentsByDr.slice(8).reduce((s, x) => s + x.value, 0);
      appointmentsByDr = [...top, { name: "Other", value: other }];
    }

    // Revenue by Doctor
    const drBillPaid: Record<string, number> = {};
    const drBillInvoiced: Record<string, number> = {};
    const areaRevenue: Record<string, number> = {};
    const modeRevenue: Record<string, number> = {};
    filteredInvoices.forEach((inv: any) => {
      const drName = inv._doctorName || "Walk-in / Direct";
      const paid = Number(inv.paid_amount || 0);
      drBillPaid[drName] = (drBillPaid[drName] || 0) + paid;
      drBillInvoiced[drName] = (drBillInvoiced[drName] || 0) + Number(inv.total_amount || 0);

      const billed = Number(inv.total_amount || 0);
      const areas: string[] = inv._areas?.length ? inv._areas : ["Unspecified"];
      areas.forEach((a) => { areaRevenue[a] = (areaRevenue[a] || 0) + billed / areas.length; });

      const mode = inv.payment_mode || "Unspecified";
      modeRevenue[mode] = (modeRevenue[mode] || 0) + billed;
    });
    const revenueByDr = Object.keys({ ...drBillPaid, ...drBillInvoiced })
      .map((name) => ({ name, paid: drBillPaid[name] || 0, invoiced: drBillInvoiced[name] || 0 }))
      .sort((a, b) => b.invoiced - a.invoiced)
      .slice(0, 10);
    const revenueByProblemArea = Object.entries(areaRevenue)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    const revenueByPaymentMode = Object.entries(modeRevenue)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    // Revenue Trend — bucket by hour / day / week based on selected range length
    const rangeDays = Math.max(1, differenceInDays(end, start) + 1);
    let buckets: Date[];
    let bucketKey: (d: Date) => string;
    let bucketLabel: (d: Date) => string;
    if (rangeDays <= 1) {
      buckets = eachHourOfInterval({ start, end });
      bucketKey = (d) => format(d, "yyyy-MM-dd HH");
      bucketLabel = (d) => format(d, "h a");
    } else if (rangeDays <= 31) {
      buckets = eachDayOfInterval({ start, end });
      bucketKey = (d) => format(d, "yyyy-MM-dd");
      bucketLabel = (d) => format(d, "dd MMM");
    } else {
      buckets = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      bucketKey = (d) => format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      bucketLabel = (d) => `Wk ${format(startOfWeek(d, { weekStartsOn: 1 }), "dd MMM")}`;
    }
    const paidByBucket: Record<string, number> = {};
    const invByBucket: Record<string, number> = {};
    const labelByBucket: Record<string, string> = {};
    buckets.forEach((b) => {
      const k = bucketKey(b);
      paidByBucket[k] = 0;
      invByBucket[k] = 0;
      labelByBucket[k] = bucketLabel(b);
    });
    filteredInvoices.forEach((inv: any) => {
      const k = bucketKey(new Date(inv.created_at));
      if (paidByBucket[k] !== undefined) {
        paidByBucket[k] += Number(inv.paid_amount || 0);
        invByBucket[k] += Number(inv.total_amount || 0);
      }
    });
    const revenueByDate = Object.keys(paidByBucket).map((k) => ({
      date: labelByBucket[k],
      paid: paidByBucket[k],
      invoiced: invByBucket[k],
    }));

    return { appointmentStatus, appointmentsByDr, revenueByDr, revenueByProblemArea, revenueByPaymentMode, revenueByDate };
  }, [filtered, filteredInvoices, start, end]);

  // Stat card values
  const paidRevenue = filteredInvoices.reduce((s, inv: any) => s + Number(inv.paid_amount || 0), 0);
  const invoicedRevenue = filteredInvoices.reduce((s, inv: any) => s + Number(inv.total_amount || 0), 0);
  const completedCount = filtered.filter((a: any) => a.status === "Completed").length;
  const scheduledCount = filtered.filter((a: any) => a.status === "Scheduled").length;
  const confirmedAppts = filtered.filter((a: any) => a.status === "Confirmed");
  const completedAppts = filtered.filter((a: any) => a.status === "Completed");
  const checkedInStaff = todayAttendance.filter((a: any) => a.check_in_time).length;
  const pendingAmount = pendingInvoices.reduce((s, inv: any) => s + (Number(inv.total_amount) - Number(inv.paid_amount)), 0);
  const dateLabel = DATE_RANGE_OPTIONS.find((o) => o.key === selectedDateRange)?.label || "Today";

  // Drill-down
  const openDrill = (
    kind: "invoices" | "appointments" | "patients",
    title: string,
    records: any[]
  ) => setDrillDown({ open: true, kind, title, records });

  const handleChartClick = (type: string, key?: string) => {
    const suffix = key ? ` — ${key}` : "";
    switch (type) {
      case "appointment_status":
        return openDrill(
          "appointments",
          `Appointments — Status${suffix}`,
          key ? filtered.filter((a: any) => a.status === key) : filtered
        );
      case "appointments_by_dr":
        return openDrill(
          "appointments",
          `Appointments — By Staff${suffix}`,
          key ? filtered.filter((a: any) => a._staffName === key) : filtered
        );
      case "revenue_by_dr":
        return openDrill(
          "invoices",
          `Revenue by Doctor${suffix}`,
          key ? filteredInvoices.filter((i: any) => i._doctorName === key) : filteredInvoices
        );
      case "revenue_by_problem_area":
        return openDrill(
          "invoices",
          `Revenue by Primary Concern${suffix}`,
          key
            ? filteredInvoices.filter((i: any) =>
                key === "Unspecified" ? !i._areas?.length : i._areas?.includes(key)
              )
            : filteredInvoices
        );
      case "revenue_by_payment_mode":
        return openDrill(
          "invoices",
          `Revenue by Payment Mode${suffix}`,
          key
            ? filteredInvoices.filter((i: any) => (i.payment_mode || "Unspecified") === key)
            : filteredInvoices
        );
      default:
        return openDrill("invoices", "Revenue — Detail", filteredInvoices);
    }
  };

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <div className="cursor-pointer" onClick={() => openDrill("appointments", `Total Appointments — ${dateLabel}`, filtered)}>
          <StatCard title="Total Appointments" value={filtered.length} change={dateLabel} changeType="neutral" icon={Calendar} iconColor="bg-info/10 text-info" delay={0} />
        </div>
        <div className="cursor-pointer" onClick={() => openDrill("appointments", `Confirmed Appointments — ${dateLabel}`, confirmedAppts)}>
          <StatCard title="Confirmed Appointments" value={confirmedAppts.length} change={`${scheduledCount} scheduled • ${dateLabel}`} changeType="neutral" icon={ClipboardList} iconColor="bg-primary/10 text-primary" delay={0.05} />
        </div>
        <div className="cursor-pointer" onClick={() => openDrill("appointments", `Completed Appointments — ${dateLabel}`, completedAppts)}>
          <StatCard title="Completed Appointments" value={completedCount} change={dateLabel} changeType="positive" icon={UserCheck} iconColor="bg-success/10 text-success" delay={0.1} />
        </div>
        <div className="cursor-pointer" onClick={() => openDrill("patients", `New Patients — ${dateLabel}`, newPatientsRaw as any[])}>
          <StatCard title="New Patients Added" value={newPatients.count} change={dateLabel} changeType="neutral" icon={Users} delay={0.15} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="cursor-pointer" onClick={() => openDrill("invoices", `Revenue — ${dateLabel}`, filteredInvoices)}>
          <StatCard title="Revenue" value={`₹${paidRevenue.toLocaleString()}`} change={`of ₹${invoicedRevenue.toLocaleString()} invoiced • ${dateLabel}`} changeType="positive" icon={IndianRupee} iconColor="bg-success/10 text-success" delay={0.2} />
        </div>
        <StatCard title="Total Patients" value={totalPatients} change="All time" changeType="neutral" icon={Users} delay={0.22} />
        <StatCard title="Staff Present" value={`${checkedInStaff}`} change="Today" changeType="neutral" icon={UserCheck} iconColor="bg-warning/10 text-warning" delay={0.24} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div onClick={() => navigate("/campaigns")} className="cursor-pointer">
          <StatCard
            title="Active Campaigns"
            value={activeCampaigns.length}
            change={`₹${activeCampaigns.reduce((s, c: any) => s + Number(c.amount_spent || 0), 0).toLocaleString()} total spend`}
            changeType="neutral"
            icon={Megaphone}
            iconColor="bg-primary/10 text-primary"
            delay={0.2}
          />
        </div>
      </div>

      <PinnedReports start={start} end={end} staffId={selectedStaff} />

      <DashboardCharts data={chartData} onChartClick={handleChartClick} />

      <DashboardDrillDown
        open={drillDown.open}
        onOpenChange={(open) => setDrillDown((p) => ({ ...p, open }))}
        title={drillDown.title}
        records={drillDown.records}
        kind={drillDown.kind}
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
