import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, Repeat, CalendarIcon, List, Phone } from "lucide-react";
import { AppointmentDetailSheet } from "@/components/appointments/AppointmentDetailSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, addWeeks, addMonths } from "date-fns";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hours = Array.from({ length: 10 }, (_, i) => i + 9);

const appointmentColors = [
  "bg-primary/15 border-primary/30 text-primary",
  "bg-info/15 border-info/30 text-info",
  "bg-success/15 border-success/30 text-success",
  "bg-warning/15 border-warning/30 text-warning",
];

const statusOptions = ["Proposed", "Confirmed", "Completed", "No Show", "Cancelled"];

const Appointments = () => {
  const queryClient = useQueryClient();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [view, setView] = useState<"week" | "day" | "table">(isMobile ? "day" : "week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const today = new Date();

  // Form state
  const [patientId, setPatientId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("Proposed");
  const [startDate, setStartDate] = useState<Date>();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:15");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date>();

  // Inline editing state for table view
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  // Queries
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("id, first_name, last_name, phone").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, first_name, last_name, role").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*, patients(first_name, last_name, phone), staff(first_name, last_name)").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  // Generate recurring dates
  const generateRecurringDates = (start: Date, pattern: string, endDate: Date): Date[] => {
    const dates: Date[] = [start];
    let current = new Date(start);
    const maxOccurrences = 52;

    for (let i = 0; i < maxOccurrences; i++) {
      if (pattern === "weekly") current = addWeeks(current, 1);
      else if (pattern === "biweekly") current = addWeeks(current, 2);
      else if (pattern === "monthly") current = addMonths(current, 1);

      if (current > endDate) break;
      dates.push(new Date(current));
    }
    return dates;
  };

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!startDate) throw new Error("Please select a date");

      // Validate not past date/time
      const buildDateTime = (date: Date, time: string) => {
        const [h, m] = time.split(":").map(Number);
        const dt = new Date(date);
        dt.setHours(h, m, 0, 0);
        return dt;
      };

      const startDT = buildDateTime(startDate, startTime);
      if (startDT < new Date()) throw new Error("Cannot book appointments in the past");

      const patient = patients.find((p) => p.id === patientId);
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : null;
      const selectedService = services.find((s) => s.id === serviceId);
      const serviceName = selectedService?.name || "";

      if (isRecurring && recurrenceEndDate) {
        const dates = generateRecurringDates(startDate, recurrencePattern, recurrenceEndDate);
        const rows = dates.map((d) => ({
          patient_id: patientId || null,
          patient_name: patientName,
          staff_id: staffId || null,
          service: serviceName,
          status: appointmentStatus,
          start_time: buildDateTime(d, startTime).toISOString(),
          end_time: buildDateTime(d, endTime).toISOString(),
          is_recurring: true,
          recurrence_pattern: recurrencePattern,
          recurrence_end_date: format(recurrenceEndDate, "yyyy-MM-dd"),
        }));
        const { error } = await supabase.from("appointments").insert(rows);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert({
          patient_id: patientId || null,
          patient_name: patientName,
          staff_id: staffId || null,
          service: serviceName,
          status: appointmentStatus,
          start_time: startDT.toISOString(),
          end_time: buildDateTime(startDate, endTime).toISOString(),
          is_recurring: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment(s) created");
      // Show patient phone if available
      const patient = patients.find((p) => p.id === patientId);
      if (patient?.phone) {
        toast.info(`Patient phone: ${patient.phone}`, { duration: 6000 });
      }
      resetForm();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Inline update mutation for table view
  const inlineUpdateMutation = useMutation({
    mutationFn: async (data: { id: string; status?: string; service?: string }) => {
      const { id, ...updates } = data;
      const { error } = await supabase.from("appointments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setEditingId(null);
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setPatientId("");
    setStaffId("");
    setServiceId("");
    setAppointmentStatus("Proposed");
    setStartDate(undefined);
    setStartTime("09:00");
    setEndTime("09:15");
    setIsRecurring(false);
    setRecurrencePattern("weekly");
    setRecurrenceEndDate(undefined);
  };

  // Calendar navigation
  const getWeekDates = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const navigateWeek = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const navigateDay = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const weekDates = getWeekDates();
  const currentDay = currentDate.getDay();

  const getApptsForSlot = (date: Date, hour: number) => {
    return appointments.filter((a: any) => {
      const start = new Date(a.start_time);
      return start.toDateString() === date.toDateString() && start.getHours() === hour;
    });
  };

  const colorForIndex = (i: number) => appointmentColors[i % appointmentColors.length];

  const statusColor = (status: string) => {
    switch (status) {
      case "Confirmed": return "bg-success/10 text-success";
      case "Completed": return "bg-primary/10 text-primary";
      case "No Show": return "bg-destructive/10 text-destructive";
      case "Cancelled": return "bg-muted text-muted-foreground";
      default: return "bg-warning/10 text-warning";
    }
  };

  // Prevent past date selection in calendar
  const disablePastDates = (date: Date) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return date < todayStart;
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle hidden sm:block">Calendar view of all scheduled appointments</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <div className="flex bg-muted rounded-lg p-0.5 md:p-1">
            <Button variant={view === "day" ? "default" : "ghost"} size="sm" onClick={() => setView("day")} className="text-xs h-7 md:h-8 px-2 md:px-3">Day</Button>
            <Button variant={view === "week" ? "default" : "ghost"} size="sm" onClick={() => setView("week")} className="text-xs h-7 md:h-8 px-2 md:px-3 hidden sm:flex">Week</Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")} className="text-xs h-7 md:h-8 px-2 md:px-3 gap-1"><List className="h-3 w-3" />List</Button>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-8 md:h-9 text-xs md:text-sm"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">New</span> Appt</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-2 sm:mx-auto">
              <DialogHeader>
                <DialogTitle className="font-display">New Appointment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <Label>Patient</Label>
                    <Select value={patientId} onValueChange={setPatientId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select patient" /></SelectTrigger>
                      <SelectContent>
                        {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {patientId && (() => {
                      const p = patients.find(pt => pt.id === patientId);
                      return p?.phone ? (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {p.phone}
                        </p>
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <Label>Doctor / Staff</Label>
                    <Select value={staffId} onValueChange={setStaffId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {staffList.map((s) => <SelectItem key={s.id} value={s.id}>Dr. {s.first_name} {s.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Service</Label>
                    <Select value={serviceId} onValueChange={setServiceId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select service" /></SelectTrigger>
                      <SelectContent>
                        {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={appointmentStatus} onValueChange={setAppointmentStatus}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full mt-1.5 justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} disabled={disablePastDates} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Time *</Label>
                    <Input type="time" className="mt-1.5" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label>End Time *</Label>
                    <Input type="time" className="mt-1.5" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>

                {/* Recurring toggle */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-muted-foreground" />
                      <Label className="font-display font-semibold">Recurring Appointment</Label>
                    </div>
                    <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                  </div>

                  {isRecurring && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 space-y-4 overflow-hidden">
                      <div>
                        <Label>Repeat Pattern</Label>
                        <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Biweekly (Every 2 weeks)</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Repeat Until *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full mt-1.5 justify-start text-left font-normal", !recurrenceEndDate && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {recurrenceEndDate ? format(recurrenceEndDate, "PPP") : "Select end date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={recurrenceEndDate} onSelect={setRecurrenceEndDate} disabled={(date) => date < (startDate || new Date())} initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {startDate && recurrenceEndDate && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
                          <p className="text-sm">
                            {generateRecurringDates(startDate, recurrencePattern, recurrenceEndDate).length} appointments will be created
                            <span className="text-muted-foreground"> ({recurrencePattern}, from {format(startDate, "MMM d")} to {format(recurrenceEndDate, "MMM d, yyyy")})</span>
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                <Button className="w-full" onClick={() => createAppointment.mutate()} disabled={!startDate || (isRecurring && !recurrenceEndDate) || createAppointment.isPending}>
                  {createAppointment.isPending ? "Creating..." : isRecurring ? "Create Recurring Appointments" : "Create Appointment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="data-table">
        {view !== "table" && (
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => view === "week" ? navigateWeek(-1) : navigateDay(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-display font-semibold">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => view === "week" ? navigateWeek(1) : navigateDay(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          {view === "table" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Date & Time</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Patient</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Service</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Doctor</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Source</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt: any) => {
                  const isEditing = editingId === apt.id;
                  const patientPhone = apt.patients?.phone || "";
                  return (
                    <tr
                      key={apt.id}
                      className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => {
                        if (!isEditing) setSelectedAppointmentId(apt.id);
                      }}
                    >
                      <td className="p-3">
                        <p className="font-medium">{format(new Date(apt.start_time), "MMM d, yyyy")}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(apt.start_time), "h:mm a")} - {format(new Date(apt.end_time), "h:mm a")}</p>
                      </td>
                      <td className="p-3">
                        <span className="font-medium">{apt.patient_name || (apt.patients ? `${apt.patients.first_name} ${apt.patients.last_name}` : "—")}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {patientPhone ? (
                          <span className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{patientPhone}</span>
                        ) : "—"}
                      </td>
                      <td className="p-3">{apt.service || "—"}</td>
                      <td className="p-3 text-muted-foreground">
                        {apt.staff ? `Dr. ${apt.staff.first_name} ${apt.staff.last_name}` : "—"}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={apt.status}
                          onValueChange={(val) => inlineUpdateMutation.mutate({ id: apt.id, status: val })}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs border-0 bg-transparent p-0">
                            <Badge className={cn("text-xs", statusColor(apt.status))}>{apt.status}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        {apt.source && <Badge variant="outline" className="text-xs">{apt.source}</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {appointments.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No appointments found</td></tr>
                )}
              </tbody>
            </table>
          ) : view === "week" ? (
            <div className="min-w-[800px]">
              <div className="grid grid-cols-8 border-b">
                <div className="p-3 text-xs text-muted-foreground" />
                {weekDates.map((date, i) => {
                  const isToday = date.toDateString() === today.toDateString();
                  return (
                    <div key={i} className={`p-3 text-center border-l ${isToday ? "bg-primary/5" : ""}`}>
                      <p className="text-xs text-muted-foreground">{daysOfWeek[i]}</p>
                      <p className={`text-lg font-display font-semibold mt-0.5 ${isToday ? "text-primary" : ""}`}>{date.getDate()}</p>
                    </div>
                  );
                })}
              </div>

              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b last:border-0 min-h-[72px]">
                  <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">
                    {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`}
                  </div>
                  {weekDates.map((date, dayIndex) => {
                    const dayAppts = getApptsForSlot(date, hour);
                    const isToday = date.toDateString() === today.toDateString();
                    return (
                      <div key={dayIndex} className={`border-l p-1 min-h-[72px] cursor-pointer hover:bg-muted/30 transition-colors ${isToday ? "bg-primary/5" : ""}`} onClick={() => {
                        const d = new Date(date);
                        d.setHours(hour, 0, 0, 0);
                        if (d < new Date()) { toast.error("Cannot book in the past"); return; }
                        setStartDate(d);
                        setStartTime(`${String(hour).padStart(2, "0")}:00`);
                        setEndTime(`${String(hour).padStart(2, "0")}:15`);
                        setOpen(true);
                      }}>
                        {dayAppts.map((apt: any, ai: number) => (
                          <div key={apt.id} className={`rounded-md border p-2 text-xs cursor-pointer hover:opacity-80 transition-opacity mb-1 ${colorForIndex(ai)}`} onClick={(e) => { e.stopPropagation(); setSelectedAppointmentId(apt.id); }}>
                            <p className="font-medium truncate">{apt.patient_name || apt.patients?.first_name}</p>
                            <p className="opacity-70 truncate">{apt.service}</p>
                            <div className="flex items-center gap-1 mt-1 opacity-70">
                              {apt.is_recurring && <Repeat className="h-3 w-3" />}
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(apt.start_time), "h:mm a")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="min-w-[400px]">
              <div className="p-3 text-center border-b bg-primary/5">
                <p className="text-xs text-muted-foreground">{daysOfWeek[currentDay]}</p>
                <p className="text-2xl font-display font-bold text-primary">{currentDate.getDate()}</p>
              </div>
              {hours.map((hour) => {
                const dayAppts = getApptsForSlot(currentDate, hour);
                return (
                  <div key={hour} className="flex border-b last:border-0 min-h-[72px]">
                    <div className="w-24 p-3 text-sm text-muted-foreground text-right shrink-0">
                      {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`}
                    </div>
                    <div className="flex-1 border-l p-2 space-y-1 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => {
                        const d = new Date(currentDate);
                        d.setHours(hour, 0, 0, 0);
                        if (d < new Date()) { toast.error("Cannot book in the past"); return; }
                        setStartDate(d);
                        setStartTime(`${String(hour).padStart(2, "0")}:00`);
                        setEndTime(`${String(hour).padStart(2, "0")}:15`);
                        setOpen(true);
                      }}>
                        {dayAppts.map((apt: any, ai: number) => (
                          <div key={apt.id} className={`rounded-lg border p-3 cursor-pointer hover:opacity-80 transition-opacity ${colorForIndex(ai)}`} onClick={(e) => { e.stopPropagation(); setSelectedAppointmentId(apt.id); }}>
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{apt.patient_name || apt.patients?.first_name}</p>
                              <div className="flex items-center gap-1">
                                {apt.is_recurring && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Repeat className="h-2.5 w-2.5 mr-0.5" />Recurring</Badge>}
                                <span className="text-xs opacity-70">{format(new Date(apt.start_time), "h:mm a")}</span>
                              </div>
                            </div>
                            <p className="text-xs opacity-70 mt-0.5">{apt.service}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      <AppointmentDetailSheet
        appointmentId={selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
      />
    </div>
  );
};

export default Appointments;
