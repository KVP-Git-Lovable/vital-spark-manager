import { Users, Calendar, IndianRupee, Clock, UserCheck, ClipboardList, Receipt, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";

const statusColors: Record<string, string> = {
  Scheduled: "bg-info/10 text-info",
  Completed: "bg-success/10 text-success",
  Cancelled: "bg-destructive/10 text-destructive",
  "In Progress": "bg-warning/10 text-warning",
};

const invoiceStatusColors: Record<string, string> = {
  Paid: "bg-success/10 text-success",
  Partial: "bg-warning/10 text-warning",
  Pending: "bg-destructive/10 text-destructive",
};

const Index = () => {
  const navigate = useNavigate();
  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();

  const { data: todayAppointments = [] } = useQuery({
    queryKey: ["dashboard-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(first_name, last_name), staff(first_name, last_name)")
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ["dashboard-pending-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .in("status", ["Pending", "Partial"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: recentProcedures = [] } = useQuery({
    queryKey: ["dashboard-procedures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedures")
        .select("*, patients(first_name, last_name), staff(first_name, last_name)")
        .order("procedure_date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["dashboard-attendance"],
    queryFn: async () => {
      const todayDate = format(today, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, staff(first_name, last_name, role)")
        .eq("date", todayDate);
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

  const { data: todayRevenue = 0 } = useQuery({
    queryKey: ["dashboard-today-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("paid_amount")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);
      if (error) throw error;
      return data.reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["dashboard-staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, first_name, last_name, role");
      if (error) throw error;
      return data;
    },
  });

  const pendingAmount = pendingInvoices.reduce((s, inv: any) => s + (Number(inv.total_amount) - Number(inv.paid_amount)), 0);
  const checkedInStaff = todayAttendance.filter((a: any) => a.check_in_time).length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle hidden sm:block">Welcome back! Here's your clinic overview for {format(today, "EEEE, MMMM d")}.</p>
        <p className="page-subtitle sm:hidden">Overview for {format(today, "MMM d")}.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard title="Today's Appts" value={todayAppointments.length} change={`${todayAppointments.filter((a: any) => a.status === "Completed").length} done`} changeType="neutral" icon={Calendar} iconColor="bg-info/10 text-info" delay={0} />
        <StatCard title="Total Patients" value={totalPatients} change="All time" changeType="neutral" icon={Users} delay={0.05} />
        <StatCard title="Today's Revenue" value={`₹${todayRevenue.toLocaleString()}`} change="Collected" changeType="positive" icon={IndianRupee} iconColor="bg-success/10 text-success" delay={0.1} />
        <StatCard title="Staff Present" value={`${checkedInStaff}/${staffList.length}`} change="Checked in" changeType="neutral" icon={UserCheck} iconColor="bg-warning/10 text-warning" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }} className="lg:col-span-2 data-table">
          <div className="p-4 md:p-5 border-b flex items-center justify-between">
            <h2 className="font-display font-semibold text-base md:text-lg">Today's Appointments</h2>
            <button onClick={() => navigate("/appointments")} className="text-xs text-primary hover:underline">View All</button>
          </div>
          <div className="divide-y max-h-[320px] overflow-y-auto">
            {todayAppointments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No appointments scheduled for today</div>
            ) : (
              todayAppointments.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between p-3 md:p-4 hover:bg-muted/50 transition-colors gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-semibold text-xs md:text-sm shrink-0">
                      {apt.patients ? `${apt.patients.first_name[0]}${apt.patients.last_name[0]}` : apt.patient_name?.[0] || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{apt.patients ? `${apt.patients.first_name} ${apt.patients.last_name}` : apt.patient_name || "Walk-in"}</p>
                      <p className="text-xs text-muted-foreground truncate">{apt.service}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-sm">{format(new Date(apt.start_time), "h:mm a")}</span>
                    </div>
                    <span className={`text-[10px] md:text-xs px-2 py-0.5 md:px-2.5 md:py-1 rounded-full font-medium whitespace-nowrap ${statusColors[apt.status] || "bg-muted"}`}>
                      {apt.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }} className="data-table">
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
                <div key={inv.id} className="p-3 md:p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{inv.invoice_number}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }} className="data-table">
          <div className="p-4 md:p-5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display font-semibold text-base md:text-lg">Recent Procedures</h2>
            </div>
            <button onClick={() => navigate("/procedures")} className="text-xs text-primary hover:underline">View All</button>
          </div>
          <div className="divide-y">
            {recentProcedures.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No procedures recorded yet</div>
            ) : (
              recentProcedures.map((proc: any) => (
                <div key={proc.id} className="p-3 md:p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{proc.service_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {proc.patients?.first_name} {proc.patients?.last_name}
                        {proc.staff && ` • Dr. ${proc.staff.first_name}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="text-xs">{proc.status}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(proc.procedure_date), "MMM d")}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.35 }} className="data-table">
          <div className="p-4 md:p-5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display font-semibold text-base md:text-lg">Staff Attendance</h2>
            </div>
          </div>
          <div className="divide-y max-h-[300px] overflow-y-auto">
            {staffList.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No staff members configured</div>
            ) : (
              staffList.map((staff: any) => {
                const attendance = todayAttendance.find((a: any) => a.staff_id === staff.id);
                const isCheckedIn = attendance?.check_in_time;
                const isCheckedOut = attendance?.check_out_time;
                return (
                  <div key={staff.id} className="p-3 md:p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isCheckedIn ? (isCheckedOut ? "bg-muted-foreground" : "bg-success") : "bg-destructive/50"}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{staff.first_name} {staff.last_name}</p>
                        <p className="text-xs text-muted-foreground">{staff.role}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      {isCheckedIn ? (
                        <>
                          <p className="text-success">In: {format(new Date(attendance.check_in_time), "h:mm a")}</p>
                          {isCheckedOut && <p className="text-muted-foreground">Out: {format(new Date(attendance.check_out_time), "h:mm a")}</p>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not checked in</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
