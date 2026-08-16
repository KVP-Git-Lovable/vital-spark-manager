import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useModal } from "@/hooks/useModal";
import { ChevronLeft, ChevronRight, Plus, Clock, Repeat, CalendarIcon, List, Phone, Search, Filter, GripVertical, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check as CheckIcon, X, AlertCircle, ClipboardCheck } from "lucide-react";
import { AppointmentDetailSheet } from "@/components/appointments/AppointmentDetailSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, addWeeks, addMonths, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval } from "date-fns";
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
import { fetchAll } from "@/lib/supabasePaginate";
import { PatientCombobox } from "@/components/patients/PatientCombobox";
import { SurveyFill } from "@/components/surveys/SurveyFill";
import { MicButton } from "@/components/shared/MicButton";
import { ConsultationReasonPicker, buildConsultationReasonsForSave, ConsultationType } from "@/components/appointments/ConsultationReasonPicker";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// 15-min slots from 8:00 to 19:45
const slots: { hour: number; minute: number }[] = [];
for (let h = 8; h < 20; h++) {
  for (let m = 0; m < 60; m += 15) {
    slots.push({ hour: h, minute: m });
  }
}

const DOCTOR_PALETTE = [
  { bg: "bg-primary/15", border: "border-primary/30", text: "text-primary", dot: "bg-primary" },
  { bg: "bg-info/15", border: "border-info/30", text: "text-info", dot: "bg-info" },
  { bg: "bg-success/15", border: "border-success/30", text: "text-success", dot: "bg-success" },
  { bg: "bg-warning/15", border: "border-warning/30", text: "text-warning", dot: "bg-warning" },
  { bg: "bg-destructive/15", border: "border-destructive/30", text: "text-destructive", dot: "bg-destructive" },
  { bg: "bg-accent", border: "border-accent-foreground/30", text: "text-accent-foreground", dot: "bg-accent-foreground" },
];

const statusOptions = ["Reserved", "Confirmed", "Cancelled", "Follow Up", "Recurring appointment"];

// Status → tailwind classes for calendar cards (background + border + text)
const STATUS_CARD_CLASSES: Record<string, string> = {
  Reserved: "bg-info/15 border-info/30 text-info",
  Confirmed: "bg-success/15 border-success/30 text-success",
  Cancelled: "bg-destructive/15 border-destructive/30 text-destructive",
  "Follow Up": "bg-warning/15 border-warning/30 text-warning",
};

// Status → tailwind classes for badges (sidebar, legend, table)
const STATUS_BADGE_CLASSES: Record<string, string> = {
  Reserved: "bg-info/15 text-info border-info/30",
  Confirmed: "bg-success/15 text-success border-success/30",
  Cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  "Follow Up": "bg-warning/15 text-warning border-warning/30",
  "Recurring appointment": "bg-primary/15 text-primary border-primary/30",
  Proposed: "bg-muted text-muted-foreground border-border",
};

const badgeClasses = (status: string) =>
  STATUS_BADGE_CLASSES[status] || STATUS_BADGE_CLASSES.Proposed;

const Appointments = () => {
  const queryClient = useQueryClient();
  const routerNavigate = useNavigate();
  const { setOpenModal } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showBillingPrompt, setShowBillingPrompt] = useState(false);
  const [lastCreatedPatientId, setLastCreatedPatientId] = useState("");
  const [lastCreatedService, setLastCreatedService] = useState("");
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [view, setView] = useState<"week" | "day" | "month" | "table">("table");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const today = new Date();

  // Filter state
  const [filterDoctors, setFilterDoctors] = useState<Set<string>>(new Set());
  const [filterDate, setFilterDate] = useState<Date | undefined>();
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAppointmentType, setFilterAppointmentType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState<string>("");

  // Sort state for table view
  const [sortColumn, setSortColumn] = useState<string>("start_time");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Inline edit state
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  // Drag-reschedule state
  const dragRef = useRef<{ aptId: string; originalStart: string; originalEnd: string } | null>(null);

  // Drag-to-select state for creating multi-slot appointments
  const dragSelectRef = useRef<{ date: Date; startSlotIndex: number } | null>(null);
  const [dragSelectEnd, setDragSelectEnd] = useState<number | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);

  // Form state
  const [patientId, setPatientId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("Reserved");
  const [visitStatus, setVisitStatus] = useState("");
  const [consultationType, setConsultationType] = useState<ConsultationType | "">("");
  const [consultationReasons, setConsultationReasons] = useState<string[]>([]);
  const [othersAestheticText, setOthersAestheticText] = useState("");
  const [othersClinicalText, setOthersClinicalText] = useState("");
  const [additionalInfoOpen, setAdditionalInfoOpen] = useState(false);
  const [appointmentType, setAppointmentType] = useState<"Walk-in" | "Online">("Walk-in");
  const [startDate, setStartDate] = useState<Date>();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:15");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date>();
  const [selectedProblemAreas, setSelectedProblemAreas] = useState<string[]>([]);
  const [assignSurveyTemplateId, setAssignSurveyTemplateId] = useState<string>("");
  const [sendingSurveyLink, setSendingSurveyLink] = useState(false);
  const [fillNowSurveyTemplateId, setFillNowSurveyTemplateId] = useState<string>("");
  const [pendingFillNow, setPendingFillNow] = useState<{
    templateId: string;
    appointmentId: string;
    patientId: string;
  } | null>(null);

  const [lockPatient, setLockPatient] = useState(false);

  // Auto-open New Appointment dialog with preselected patient (from Patient profile)
  useEffect(() => {
    const shouldOpen = searchParams.get("new") === "1";
    const presetPatient = searchParams.get("patient_id");
    if (shouldOpen) {
      if (presetPatient) {
        setPatientId(presetPatient);
        setLockPatient(true);
      }
      setOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      next.delete("patient_id");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Queries
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list"],
    queryFn: async () => {
      return await fetchAll<any>((from, to) =>
        supabase
          .from("patients")
          .select("id, first_name, last_name, phone, source, source_ad_details, source_referral_doctor")
          .order("first_name")
          .range(from, to)
      );
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-active-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, first_name, last_name, role, specialization").eq("is_active", true).order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const doctorsList = useMemo(() => (staffList as any[]).filter((s: any) => s.role === "Doctor"), [staffList]);

  const { data: services = [] } = useQuery({
    queryKey: ["services-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: problemAreasList = [] } = useQuery({
    queryKey: ["problem-areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("problem_areas").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: activeSurveyTemplates = [] } = useQuery({
    queryKey: ["active-survey-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_templates")
        .select("id, name")
        .eq("is_active", true)
        .eq("approval_status", "approved")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      return await fetchAll<any>((from, to) =>
        supabase
          .from("appointments")
          .select("*, patients(first_name, last_name, phone, gender)")
          .order("start_time")
          .range(from, to)
      );
    },
  });

  // Build a staff lookup map
  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    staffList.forEach((d: any) => map.set(d.id, `${d.first_name} ${d.last_name}`));
    return map;
  }, [staffList]);

  // Fetch invoices for bill amount in table view
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices-for-appointments"],
    queryFn: async () => {
      return await fetchAll<any>((from, to) =>
        supabase
          .from("invoices")
          .select("id, appointment_id, total_amount, paid_amount, payment_mode, status")
          .range(from, to)
      );
    },
  });

  const invoiceByAppointmentId = useMemo(() => {
    const map = new Map<string, any>();
    invoices.forEach((inv: any) => {
      if (inv.appointment_id) map.set(inv.appointment_id, inv);
    });
    return map;
  }, [invoices]);

  // Quick filter logic
  const getQuickFilterRange = (filter: string) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    switch (filter) {
      case "today": return { start: todayStart, end: todayEnd };
      case "tomorrow": return { start: addDays(todayStart, 1), end: addDays(todayEnd, 1) };
      case "yesterday": return { start: addDays(todayStart, -1), end: addDays(todayEnd, -1) };
      case "this_week": return { start: startOfWeek(todayStart), end: endOfWeek(todayStart) };
      case "last_7": return { start: addDays(todayStart, -6), end: todayEnd };
      case "this_month": return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
      default: return null;
    }
  };

  // Filtered appointments
  const filteredAppointments = appointments.filter((apt: any) => {
    if (filterDoctors.size > 0 && apt.staff_id && !filterDoctors.has(apt.staff_id)) return false;
    if (filterDate && !isSameDay(new Date(apt.start_time), filterDate)) return false;
    if (filterSource !== "all") {
      const src = (apt.source || "").toString().toLowerCase();
      if (filterSource === "portal" && src !== "portal") return false;
      if (filterSource === "walkin" && src === "portal") return false;
    }
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;
    if (filterAppointmentType !== "all" && (apt.appointment_type || "Walk-in") !== filterAppointmentType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = apt.patient_name || (apt.patients ? `${apt.patients.first_name} ${apt.patients.last_name}` : "");
      const d = new Date(apt.start_time);
      const dateTokens = [
        format(d, "MMM d, yyyy"),
        format(d, "dd/MM/yyyy"),
        format(d, "yyyy-MM-dd"),
        format(d, "MMMM yyyy"),
        format(d, "h:mm a"),
      ].join(" ").toLowerCase();
      const haystack = `${name} ${apt.patients?.phone || ""} ${apt.service || ""} ${dateTokens}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (quickFilter) {
      const range = getQuickFilterRange(quickFilter);
      if (range && !isWithinInterval(new Date(apt.start_time), range)) return false;
    }
    return true;
  });

  // Sorted appointments for table view
  const sortedAppointments = useMemo(() => {
    const sorted = [...filteredAppointments];
    sorted.sort((a: any, b: any) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "start_time":
          valA = new Date(a.start_time).getTime();
          valB = new Date(b.start_time).getTime();
          break;
        case "patient":
          valA = (a.patient_name || a.patients?.first_name || "").toLowerCase();
          valB = (b.patient_name || b.patients?.first_name || "").toLowerCase();
          break;
        case "service":
          valA = (a.service || "").toLowerCase();
          valB = (b.service || "").toLowerCase();
          break;
        case "doctor":
          valA = (staffMap.get(a.staff_id) || "").toLowerCase();
          valB = (staffMap.get(b.staff_id) || "").toLowerCase();
          break;
        case "status":
          valA = (a.status || "").toLowerCase();
          valB = (b.status || "").toLowerCase();
          break;
        case "bill":
          valA = invoiceByAppointmentId.get(a.id)?.total_amount || 0;
          valB = invoiceByAppointmentId.get(b.id)?.total_amount || 0;
          break;
        default:
          valA = 0; valB = 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredAppointments, sortColumn, sortDirection, invoiceByAppointmentId]);

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const startInlineEdit = (apt: any) => {
    setEditingRow(apt.id);
    setEditValues({
      service: apt.service || "",
      staff_id: apt.staff_id || "",
      status: apt.status,
      start_time: format(new Date(apt.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(new Date(apt.end_time), "yyyy-MM-dd'T'HH:mm"),
    });
  };

  const saveInlineEdit = async () => {
    if (!editingRow) return;
    const updates: any = {};
    if (editValues.service) updates.service = editValues.service;
    if (editValues.staff_id) updates.staff_id = editValues.staff_id;
    if (editValues.status) updates.status = editValues.status;
    if (editValues.start_time) updates.start_time = new Date(editValues.start_time).toISOString();
    if (editValues.end_time) updates.end_time = new Date(editValues.end_time).toISOString();
    inlineUpdateMutation.mutate({ id: editingRow, ...updates });
    setEditingRow(null);
    setEditValues({});
  };

  const cancelInlineEdit = () => {
    setEditingRow(null);
    setEditValues({});
  };

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
      // Appointments created from the clinic app are always tagged "Walk-in".
      // Portal-originated bookings tag themselves as "portal" at creation time.
      const patientSource = "Walk-in";
      const selectedService = services.find((s) => s.id === serviceId);
      const serviceName = selectedService?.name || "";
      const wasRecurring = isRecurring && !!recurrenceEndDate;
      let newAppointmentId: string | null = null;

      // Build the list of (start, end) windows we need to validate
      const windows: { start: Date; end: Date }[] = wasRecurring
        ? generateRecurringDates(startDate, recurrencePattern, recurrenceEndDate!).map((d) => ({
            start: buildDateTime(d, startTime),
            end: buildDateTime(d, endTime),
          }))
        : [{ start: startDT, end: buildDateTime(startDate, endTime) }];

      // Client-side overlap pre-check (the DB trigger is the authoritative guard)
      if (staffId) {
        const minStart = new Date(Math.min(...windows.map((w) => w.start.getTime())));
        const maxEnd = new Date(Math.max(...windows.map((w) => w.end.getTime())));
        const { data: existing, error: existingErr } = await supabase
          .from("appointments")
          .select("start_time, end_time, patient_name, status")
          .eq("staff_id", staffId)
          .lt("start_time", maxEnd.toISOString())
          .gt("end_time", minStart.toISOString());
        if (existingErr) throw existingErr;
        const blockers = (existing || []).filter(
          (a: any) => !["Cancelled"].includes(a.status),
        );
        const conflicts = windows
          .map((w) => {
            const hit = blockers.find(
              (a: any) => new Date(a.start_time) < w.end && new Date(a.end_time) > w.start,
            );
            return hit ? { w, hit } : null;
          })
          .filter(Boolean) as { w: { start: Date; end: Date }; hit: any }[];
        if (conflicts.length > 0) {
          const first = conflicts[0];
          const when = format(new Date(first.hit.start_time), "dd MMM yyyy hh:mm a");
          const extra = conflicts.length > 1 ? ` (+${conflicts.length - 1} more conflict${conflicts.length - 1 === 1 ? "" : "s"})` : "";
          throw new Error(
            `This doctor already has an appointment on ${when}${first.hit.patient_name ? ` with ${first.hit.patient_name}` : ""}. Please pick a different slot.${extra}`,
          );
        }
      }

      if (wasRecurring) {
        const dates = generateRecurringDates(startDate, recurrencePattern, recurrenceEndDate!);
        const savedReasons = buildConsultationReasonsForSave(consultationReasons, othersAestheticText, othersClinicalText);
        const rows = dates.map((d) => ({
          patient_id: patientId || null,
          patient_name: patientName,
          staff_id: staffId || null,
          service: serviceName,
          status: appointmentStatus,
          visit_status: visitStatus || null,
          start_time: buildDateTime(d, startTime).toISOString(),
          end_time: buildDateTime(d, endTime).toISOString(),
          is_recurring: true,
          recurrence_pattern: recurrencePattern,
          recurrence_end_date: format(recurrenceEndDate!, "yyyy-MM-dd"),
          source: patientSource,
          problem_area_ids: selectedProblemAreas,
          appointment_type: appointmentType,
          consultation_type: consultationType || null,
          consultation_reasons: savedReasons,
        }));
        const { error } = await supabase.from("appointments").insert(rows as any);
        if (error) throw error;
      } else {
        const savedReasons = buildConsultationReasonsForSave(consultationReasons, othersAestheticText, othersClinicalText);
        const { data: inserted, error } = await supabase.from("appointments").insert({
          patient_id: patientId || null,
          patient_name: patientName,
          staff_id: staffId || null,
          service: serviceName,
          status: appointmentStatus,
          visit_status: visitStatus || null,
          start_time: startDT.toISOString(),
          end_time: buildDateTime(startDate, endTime).toISOString(),
          is_recurring: false,
          source: patientSource,
          problem_area_ids: selectedProblemAreas,
          appointment_type: appointmentType,
          consultation_type: consultationType || null,
          consultation_reasons: savedReasons,
        } as any).select("id").single();
        if (error) throw error;
        newAppointmentId = (inserted as any)?.id || null;
      }
      return {
        wasRecurring,
        capturedPatientId: patientId,
        capturedServiceName: serviceName,
        phone: patient?.phone,
        patientName,
        patientGender: (patient as any)?.gender || null,
        firstStartDT: startDT,
        recurrencePattern,
        recurrenceEndDate: wasRecurring ? recurrenceEndDate : null,
        totalSessions: wasRecurring
          ? generateRecurringDates(startDate, recurrencePattern, recurrenceEndDate!).length
          : 1,
        newAppointmentId,
        assignSurveyTemplateId,
        fillNowSurveyTemplateId,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment(s) created");
      if (data.phone) toast.info(`Patient phone: ${data.phone}`, { duration: 6000 });
      // Send WhatsApp confirmation only for Confirmed or Cancelled appointments
      const notifyStatuses = ["Confirmed", "Cancelled"];
      if (data.phone && data.patientName && data.firstStartDT && notifyStatuses.includes(appointmentStatus)) {
        if (data.wasRecurring && data.recurrenceEndDate) {
          supabase.functions
            .invoke("send-recurring-appointment-whatsapp", {
              body: {
                phone: data.phone,
                patientName: data.patientName,
                firstAppointmentDate: format(data.firstStartDT, "dd MMM yyyy"),
                startTime: format(data.firstStartDT, "hh:mm a"),
                totalSessions: data.totalSessions,
                repeatPattern: data.recurrencePattern,
                endDate: format(data.recurrenceEndDate, "dd MMM yyyy"),
              },
            })
            .then(({ error }) => {
              if (error) {
                console.error("Recurring WhatsApp send failed:", error);
              } else {
                toast.success("WhatsApp confirmation sent");
              }
            });
        } else {
          supabase.functions
            .invoke("send-appointment-whatsapp", {
              body: {
                phone: data.phone,
                patientName: data.patientName,
                appointmentDate: format(data.firstStartDT, "dd MMM yyyy"),
                appointmentTime: format(data.firstStartDT, "hh:mm a"),
                serviceName: data.capturedServiceName,
                patientGender: data.patientGender,
              },
            })
            .then(({ error }) => {
              if (error) {
                console.error("WhatsApp send failed:", error);
              } else {
                toast.success("WhatsApp confirmation sent");
              }
            });
        }
      }
      // Survey: assign-to-patient (WhatsApp invite)
      if (data.assignSurveyTemplateId && data.capturedPatientId) {
        const tpl = activeSurveyTemplates.find((t: any) => t.id === data.assignSurveyTemplateId);
        // Create a pending survey assignment so it shows in the patient portal
        (async () => {
          const { data: existing } = await supabase
            .from("survey_assignments")
            .select("id")
            .eq("patient_id", data.capturedPatientId)
            .eq("template_id", data.assignSurveyTemplateId)
            .eq("status", "pending")
            .maybeSingle();
          if (!existing) {
            await supabase.from("survey_assignments").insert({
              patient_id: data.capturedPatientId,
              template_id: data.assignSurveyTemplateId,
              status: "pending",
            });
          }
        })().catch((e) => console.error("Survey assignment insert failed:", e));
        supabase.functions
          .invoke("send-survey-whatsapp", {
            body: {
              patient_id: data.capturedPatientId,
              template_name: tpl?.name || "Survey",
            },
          })
          .then(({ error }) => {
            if (error) console.error("Survey WhatsApp send failed:", error);
            else toast.success("Survey link sent on WhatsApp");
          });
      }
      // Survey: fill now (only for non-recurring single appointment)
      if (
        data.fillNowSurveyTemplateId &&
        data.capturedPatientId &&
        data.newAppointmentId &&
        !data.wasRecurring
      ) {
        setPendingFillNow({
          templateId: data.fillNowSurveyTemplateId,
          appointmentId: data.newAppointmentId,
          patientId: data.capturedPatientId,
        });
      }
      resetForm();
      setOpen(false);
      if (data.wasRecurring) {
        setLastCreatedPatientId(data.capturedPatientId);
        setLastCreatedService(data.capturedServiceName);
        setShowBillingPrompt(true);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inlineUpdateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { id, __notify, ...updates } = data;
      const { error } = await supabase.from("appointments").update(updates as any).eq("id", id);
      if (error) throw error;
      // WhatsApp notification on inline status change
      try {
        if (__notify) {
          const { phone, patientName, prevStatus, newStatus, startTime, doctorName, serviceName } = __notify;
          const notifyStatuses = ["Confirmed", "Cancelled"];
          const changed = newStatus !== prevStatus && notifyStatuses.includes(newStatus);
          console.log("[appt-notify-inline] check", { phone, prevStatus, newStatus });
          if (phone && changed) {
            const startDate = new Date(startTime);
            const apptDate = format(startDate, "dd MMM yyyy");
            const apptTime = format(startDate, "hh:mm a");
            if (newStatus === "Cancelled") {
              await supabase.functions.invoke("send-appointment-update-whatsapp", {
                body: { kind: "cancelled", phone, patientName, appointmentDate: apptDate, appointmentTime: apptTime },
              });
              toast.success("WhatsApp cancellation sent");
            } else if (newStatus === "Confirmed") {
              await supabase.functions.invoke("send-appointment-update-whatsapp", {
                body: { kind: "update", phone, patientName, status: newStatus, appointmentDate: apptDate, appointmentTime: apptTime, doctorName: doctorName || "To be assigned", serviceName: serviceName || "-", patientGender: __notify.patientGender || null },
              });
              toast.success("WhatsApp notification sent");
            }
          }
        }
      } catch (e) {
        console.error("[appt-notify-inline] error", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleAppointment = useMutation({
    mutationFn: async ({ id, newStart, newEnd }: { id: string; newStart: string; newEnd: string }) => {
      const { error } = await supabase.from("appointments").update({ start_time: newStart, end_time: newEnd }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment rescheduled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setPatientId("");
    setStaffId("");
    setServiceId("");
    setAppointmentStatus("Reserved");
    setVisitStatus("");
    setConsultationType("");
    setConsultationReasons([]);
    setOthersAestheticText("");
    setOthersClinicalText("");
    setAdditionalInfoOpen(false);
    setAppointmentType("Walk-in");
    setStartDate(undefined);
    setStartTime("09:00");
    setEndTime("09:15");
    setIsRecurring(false);
    setRecurrencePattern("weekly");
    setRecurrenceEndDate(undefined);
    setSelectedProblemAreas([]);
    setAssignSurveyTemplateId("");
    setFillNowSurveyTemplateId("");
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

  const navigateMonth = (dir: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const weekDates = getWeekDates();
  const currentDay = currentDate.getDay();

  // Month view helpers
  const getMonthDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  };

  const getApptsForDate = (date: Date) => {
    return filteredAppointments.filter((a: any) => isSameDay(new Date(a.start_time), date));
  };

  const getApptsForSlot = (date: Date, hour: number, minute: number) => {
    return filteredAppointments.filter((a: any) => {
      const start = new Date(a.start_time);
      return start.toDateString() === date.toDateString() && start.getHours() === hour && start.getMinutes() >= minute && start.getMinutes() < minute + 15;
    });
  };

  // Doctor color map
  const doctorColorMap = useMemo(() => {
    const map = new Map<string, typeof DOCTOR_PALETTE[0]>();
    const uniqueStaffIds = [...new Set(appointments.map((a: any) => a.staff_id).filter(Boolean))];
    uniqueStaffIds.forEach((id, i) => {
      map.set(id as string, DOCTOR_PALETTE[i % DOCTOR_PALETTE.length]);
    });
    return map;
  }, [appointments]);

  const colorForApt = (apt: any) => {
    return STATUS_CARD_CLASSES[apt.status] || STATUS_CARD_CLASSES.Proposed;
  };

  const getDoctorName = (apt: any) => {
    return apt.staff_id ? (staffMap.get(apt.staff_id) || "") : "";
  };

  const statusColor = (status: string) => {
    return STATUS_BADGE_CLASSES[status] || STATUS_BADGE_CLASSES.Proposed;
  };

  const disablePastDates = (date: Date) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return date < todayStart;
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, apt: any) => {
    e.stopPropagation();
    dragRef.current = { aptId: apt.id, originalStart: apt.start_time, originalEnd: apt.end_time };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", apt.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnSlot = (e: React.DragEvent, targetDate: Date, targetHour: number, targetMinute: number = 0) => {
    e.preventDefault();
    if (!dragRef.current) return;
    const { aptId, originalStart, originalEnd } = dragRef.current;
    const origStart = new Date(originalStart);
    const origEnd = new Date(originalEnd);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const newStart = new Date(targetDate);
    newStart.setHours(targetHour, targetMinute, 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);
    if (newStart < new Date()) {
      toast.error("Cannot move to past");
      dragRef.current = null;
      return;
    }
    rescheduleAppointment.mutate({ id: aptId, newStart: newStart.toISOString(), newEnd: newEnd.toISOString() });
    dragRef.current = null;
  };

  const handleDropOnDate = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    if (!dragRef.current) return;
    const { aptId, originalStart, originalEnd } = dragRef.current;
    const origStart = new Date(originalStart);
    const origEnd = new Date(originalEnd);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const newStart = new Date(targetDate);
    newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);
    if (newStart < new Date()) {
      toast.error("Cannot move to past");
      dragRef.current = null;
      return;
    }
    rescheduleAppointment.mutate({ id: aptId, newStart: newStart.toISOString(), newEnd: newEnd.toISOString() });
    dragRef.current = null;
  };

  // Drag-to-select handlers for multi-slot appointment creation
  const handleSlotMouseDown = (date: Date, slotIndex: number) => {
    dragSelectRef.current = { date, startSlotIndex: slotIndex };
    setDragSelectEnd(slotIndex);
    setIsDragSelecting(true);
  };

  const handleSlotMouseEnter = (date: Date, slotIndex: number) => {
    if (!isDragSelecting || !dragSelectRef.current) return;
    if (date.toDateString() === dragSelectRef.current.date.toDateString()) {
      setDragSelectEnd(slotIndex);
    }
  };

  const handleSlotMouseUp = () => {
    if (!isDragSelecting || !dragSelectRef.current || dragSelectEnd === null) {
      setIsDragSelecting(false);
      dragSelectRef.current = null;
      setDragSelectEnd(null);
      return;
    }
    const { date, startSlotIndex } = dragSelectRef.current;
    const minSlot = Math.min(startSlotIndex, dragSelectEnd);
    const maxSlot = Math.max(startSlotIndex, dragSelectEnd);
    const startSlot = slots[minSlot];
    const endSlot = slots[Math.min(maxSlot + 1, slots.length - 1)];
    const d = new Date(date);
    d.setHours(startSlot.hour, startSlot.minute, 0, 0);
    if (d < new Date()) { toast.error("Cannot book in the past"); } else {
      setStartDate(d);
      setStartTime(`${String(startSlot.hour).padStart(2, "0")}:${String(startSlot.minute).padStart(2, "0")}`);
      const endH = maxSlot + 1 < slots.length ? slots[maxSlot + 1].hour : 20;
      const endM = maxSlot + 1 < slots.length ? slots[maxSlot + 1].minute : 0;
      setEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
      if (filterDoctors.size === 1) setStaffId(Array.from(filterDoctors)[0]);
      setOpen(true);
    }
    setIsDragSelecting(false);
    dragSelectRef.current = null;
    setDragSelectEnd(null);
  };

  const isSlotInDragRange = (date: Date, slotIndex: number) => {
    if (!isDragSelecting || !dragSelectRef.current || dragSelectEnd === null) return false;
    if (date.toDateString() !== dragSelectRef.current.date.toDateString()) return false;
    const min = Math.min(dragSelectRef.current.startSlotIndex, dragSelectEnd);
    const max = Math.max(dragSelectRef.current.startSlotIndex, dragSelectEnd);
    return slotIndex >= min && slotIndex <= max;
  };

  const navigate = (dir: number) => {
    if (view === "week") navigateWeek(dir);
    else if (view === "day") navigateDay(dir);
    else if (view === "month") navigateMonth(dir);
  };

  const monthDays = getMonthDays();

  // Dates that have appointments for mini calendar highlighting
  const appointmentDates = useMemo(() => {
    const dates: Date[] = [];
    filteredAppointments.forEach((a: any) => {
      dates.push(new Date(a.start_time));
    });
    return dates;
  }, [filteredAppointments]);

  const formatSlotTime = (hour: number, minute: number) => {
    const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${h}:${String(minute).padStart(2, "0")} ${ampm}`;
  };

  // Appointment card for calendar views — shows patient name + doctor name, no time
  const AptCard = ({ apt, compact = false }: { apt: any; compact?: boolean }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, apt)}
      className={cn(
        "rounded-md border cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity",
        colorForApt(apt),
        compact ? "px-1.5 py-0.5 text-[10px]" : "p-2 text-xs mb-1"
      )}
      onMouseDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); setOpenModal("appointmentDetail", apt.id); }}
    >
      <p className="font-medium truncate">{apt.patient_name || apt.patients?.first_name || "—"}</p>
      {!compact && <p className="opacity-70 truncate">{apt.service}</p>}
      {getDoctorName(apt) && (
        <p className={cn("truncate", compact ? "opacity-70" : "opacity-70 mt-0.5")}>
          {getDoctorName(apt)}
        </p>
      )}
      {!compact && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 mt-1 mr-1",
            (apt.appointment_type || "Walk-in") === "Online"
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-muted text-muted-foreground"
          )}
        >
          {apt.appointment_type || "Walk-in"}
        </Badge>
      )}
      {!compact && apt.is_recurring && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1"><Repeat className="h-2.5 w-2.5 mr-0.5" />Recurring</Badge>
      )}
    </div>
  );

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
            <Button variant={view === "week" ? "default" : "ghost"} size="sm" onClick={() => setView("week")} className="text-xs h-7 md:h-8 px-2 md:px-3">Week</Button>
            <Button variant={view === "month" ? "default" : "ghost"} size="sm" onClick={() => setView("month")} className="text-xs h-7 md:h-8 px-2 md:px-3">Month</Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")} className="text-xs h-7 md:h-8 px-2 md:px-3 gap-1"><List className="h-3 w-3" />List</Button>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9 relative"
            title="Filters & Search"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            {(searchQuery || filterDoctors.size > 0 || filterDate || filterSource !== "all" || filterStatus !== "all" || filterAppointmentType !== "all") && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary" />
            )}
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setLockPatient(false); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-8 md:h-9 text-xs md:text-sm"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">New</span> Appt</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-2 sm:mx-auto">
              <DialogHeader>
                <DialogTitle className="font-display flex items-center justify-between gap-2">
                  <span>New Appointment</span>
                  <span className="flex items-center gap-2">
                    <MicButton
                      mode="replace"
                      onChange={() => { /* handled via onTranscript */ }}
                      onTranscript={async (transcript) => {
                        try {
                          toast.loading("Understanding voice…", { id: "voice-fill" });
                          const { data, error } = await supabase.functions.invoke("voice-parse-appointment", {
                            body: {
                              transcript,
                              patients: patients.map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`.trim(), phone: p.phone })),
                              services: services.map((s: any) => ({ id: s.id, name: s.name })),
                              today: format(new Date(), "yyyy-MM-dd"),
                            },
                          });
                          if (error) throw error;
                          const filled: string[] = [];
                          const missed: string[] = [];
                          if (data?.patient_id) { setPatientId(data.patient_id); filled.push("patient"); }
                          else if (data?.patient_query) missed.push(`patient "${data.patient_query}"`);
                          if (data?.service_id) { setServiceId(data.service_id); filled.push("service"); }
                          else if (data?.service_query) missed.push(`service "${data.service_query}"`);
                          if (data?.date) {
                            const d = new Date(data.date + "T00:00:00");
                            if (!isNaN(d.getTime())) { setStartDate(d); filled.push("date"); }
                          }
                          if (data?.time && /^\d{2}:\d{2}$/.test(data.time)) {
                            setStartTime(data.time);
                            const [h, m] = data.time.split(":").map(Number);
                            const end = new Date(); end.setHours(h, m + 15);
                            setEndTime(`${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`);
                            filled.push("time");
                          }
                          toast.dismiss("voice-fill");
                          if (filled.length) toast.success(`Filled: ${filled.join(", ")}`);
                          if (missed.length) toast.warning(`Could not match: ${missed.join(", ")}`);
                          if (!filled.length && !missed.length) toast.error("Could not understand the transcript");
                        } catch (e: any) {
                          toast.dismiss("voice-fill");
                          toast.error(e?.message || "Voice fill failed");
                        }
                      }}
                      title="Voice fill — speak patient, date, time, service"
                    />
                    <span className="text-xs text-muted-foreground font-normal">Voice fill</span>
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <Label>Patient</Label>
                    <PatientCombobox
                      value={patientId}
                      onValueChange={setPatientId}
                      placeholder="Select patient"
                      className="mt-1.5"
                      withSource
                      disabled={lockPatient}
                    />
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
                    <Label>Appointment Type</Label>
                    <div className="mt-1.5 inline-flex rounded-md border bg-background p-0.5 w-full">
                      {(["Walk-in", "Online"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setAppointmentType(t)}
                          className={cn(
                            "flex-1 text-xs h-8 rounded-sm font-medium transition-colors",
                            appointmentType === t
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Doctor</Label>
                    <Select value={staffId} onValueChange={setStaffId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {doctorsList.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>)}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <Label>Service</Label>
                      <Select value={serviceId} onValueChange={setServiceId}>
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select service" /></SelectTrigger>
                        <SelectContent>
                          {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Primary Concern */}
                    <div>
                  <Label className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> Primary Concern
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full mt-1.5 justify-start text-left font-normal", selectedProblemAreas.length === 0 && "text-muted-foreground")}>
                        {selectedProblemAreas.length === 0
                          ? "Select primary concerns"
                          : `${selectedProblemAreas.length} selected`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2 max-h-60 overflow-y-auto" align="start">
                      <div className="space-y-1">
                        {problemAreasList.map((pa: any) => (
                          <label key={pa.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                            <Checkbox
                              checked={selectedProblemAreas.includes(pa.id)}
                              onCheckedChange={(checked) => {
                                setSelectedProblemAreas(prev =>
                                  checked ? [...prev, pa.id] : prev.filter(id => id !== pa.id)
                                );
                              }}
                            />
                            {pa.name}
                          </label>
                        ))}
                        {problemAreasList.length === 0 && (
                          <p className="text-xs text-muted-foreground p-2">No primary concerns defined</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {selectedProblemAreas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selectedProblemAreas.map(id => {
                        const pa = problemAreasList.find((p: any) => p.id === id);
                        return pa ? (
                          <Badge key={id} variant="secondary" className="text-xs gap-1">
                            {pa.name}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedProblemAreas(prev => prev.filter(i => i !== id))} />
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                    </div>
                </div>

                {/* Survey (optional) */}
                <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                  <Label className="flex items-center gap-1.5">
                    <ClipboardCheck className="h-3.5 w-3.5" /> Survey <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  {(() => {
                    const selectedTemplateId = assignSurveyTemplateId || fillNowSurveyTemplateId || "";
                    const setSelectedTemplate = (id: string) => {
                      // Keep both state slots in sync with the picker; the actual
                      // action (send link vs fill now) is decided by the buttons below.
                      if (assignSurveyTemplateId) setAssignSurveyTemplateId(id);
                      if (fillNowSurveyTemplateId) setFillNowSurveyTemplateId(id);
                      if (!assignSurveyTemplateId && !fillNowSurveyTemplateId) {
                        // Default to "Send Link" mode when nothing is armed yet
                        setAssignSurveyTemplateId(id);
                      }
                    };
                    const sendArmed = !!assignSurveyTemplateId;
                    const fillArmed = !!fillNowSurveyTemplateId;
                    return (
                      <>
                        <Select
                          value={selectedTemplateId || "__none__"}
                          onValueChange={(v) => {
                            if (v === "__none__") {
                              setAssignSurveyTemplateId("");
                              setFillNowSurveyTemplateId("");
                            } else {
                              setSelectedTemplate(v);
                            }
                          }}
                          disabled={!patientId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select survey template" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            <SelectItem value="__none__">None</SelectItem>
                            {activeSurveyTemplates.map((t: any) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={sendArmed ? "default" : "outline"}
                            className="flex-1"
                            disabled={!patientId || !selectedTemplateId || sendingSurveyLink}
                            onClick={async () => {
                              const tpl = activeSurveyTemplates.find((t: any) => t.id === selectedTemplateId);
                              if (!tpl) return;
                              setSendingSurveyLink(true);
                              const loadingId = toast.loading("Sending survey link on WhatsApp...");
                              try {
                                // Ensure a pending assignment exists so the portal shows this survey
                                const { data: existing } = await supabase
                                  .from("survey_assignments")
                                  .select("id")
                                  .eq("patient_id", patientId)
                                  .eq("template_id", selectedTemplateId)
                                  .eq("status", "pending")
                                  .maybeSingle();
                                if (!existing) {
                                  await supabase.from("survey_assignments").insert({
                                    patient_id: patientId,
                                    template_id: selectedTemplateId,
                                    status: "pending",
                                  });
                                }
                                const { data: res, error } = await supabase.functions.invoke("send-survey-whatsapp", {
                                  body: { patient_id: patientId, template_name: tpl.name },
                                });
                                if (error) throw error;
                                if (res?.success === false && res?.reason === "no_phone") {
                                  toast.error("Patient has no phone number on file", { id: loadingId });
                                } else if (res?.error) {
                                  toast.error(`Failed to send: ${res.error}`, { id: loadingId });
                                } else {
                                  toast.success("Survey link sent on WhatsApp", { id: loadingId });
                                  // Clear arming so we don't re-send on appointment create
                                  setAssignSurveyTemplateId("");
                                  setFillNowSurveyTemplateId("");
                                }
                              } catch (e: any) {
                                toast.error(`Failed to send: ${e?.message || "Unknown error"}`, { id: loadingId });
                              } finally {
                                setSendingSurveyLink(false);
                              }
                            }}
                          >
                            {sendingSurveyLink ? "Sending..." : "Send Survey Link"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={fillArmed ? "default" : "outline"}
                            className="flex-1"
                            disabled={!patientId || !selectedTemplateId || isRecurring}
                            onClick={() => {
                              setFillNowSurveyTemplateId(selectedTemplateId);
                              setAssignSurveyTemplateId("");
                            }}
                          >
                            Fill Now
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {!patientId
                            ? "Select a patient to enable surveys"
                            : !selectedTemplateId
                            ? "Pick a template, then choose an action"
                            : sendArmed
                            ? "WhatsApp link queued — will be sent on create"
                            : fillArmed
                            ? "Survey form will open after appointment is created"
                            : isRecurring
                            ? "Fill Now is not available for recurring appointments"
                            : ""}
                        </p>
                      </>
                    );
                  })()}
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
                            <SelectItem value="biweekly">Biweekly</SelectItem>
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
                            {generateRecurringDates(startDate, recurrencePattern, recurrenceEndDate).length} appointments
                            <span className="text-muted-foreground"> ({recurrencePattern}, {format(startDate, "MMM d")} to {format(recurrenceEndDate, "MMM d, yyyy")})</span>
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

      {/* Collapsible Filters Bar */}
      <div className={showFilters ? "mb-4" : ""}>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border overflow-hidden">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search patient name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            <Select value={filterDoctors.size === 0 ? "all" : filterDoctors.size === 1 ? [...filterDoctors][0] : "multi"} onValueChange={(v) => {
              if (v === "all") setFilterDoctors(new Set());
              else setFilterDoctors(new Set([v]));
            }}>
              <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder="All Doctors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctorsList.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="All Sources" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="portal">Portal</SelectItem>
                <SelectItem value="walkin">Walk-in</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAppointmentType} onValueChange={setFilterAppointmentType}>
              <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Walk-in">Walk-in</SelectItem>
                <SelectItem value="Online">Online</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-2", filterDate && "border-primary text-primary")}>
                  <CalendarIcon className="h-4 w-4" />
                  {filterDate ? format(filterDate, "MMM d, yyyy") : "Filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterDate} onSelect={setFilterDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {(searchQuery || filterDoctors.size > 0 || filterDate || filterSource !== "all" || filterStatus !== "all" || filterAppointmentType !== "all") && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setSearchQuery(""); setFilterDoctors(new Set()); setFilterDate(undefined); setFilterSource("all"); setFilterStatus("all"); setFilterAppointmentType("all"); }}>Clear filters</Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? "s" : ""}</span>
          </motion.div>
        )}
        {/* Status color legend (click to filter by status) */}
        {view !== "table" && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground font-medium">Status:</span>
            {statusOptions.map((s) => {
              const isSelected = filterStatus === s;
              const isFiltering = filterStatus !== "all";
              return (
                <button
                  key={s}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all cursor-pointer",
                    isSelected
                      ? `${STATUS_BADGE_CLASSES[s]} font-medium`
                      : isFiltering
                        ? "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setFilterStatus(prev => prev === s ? "all" : s)}
                >
                  <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_BADGE_CLASSES[s].split(" ")[0].replace("/15", ""))} />
                  {s}
                </button>
              );
            })}
            {filterStatus !== "all" && (
              <button className="text-[10px] text-muted-foreground hover:text-foreground ml-1" onClick={() => setFilterStatus("all")}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Calendar / Table area */}
      <div className="flex gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="data-table flex-1 min-w-0">
          {view !== "table" && (
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="font-display font-semibold text-base hover:bg-muted/50 gap-1.5 px-2">
                      {view === "month"
                        ? format(currentDate, "MMMM yyyy")
                        : currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentDate}
                      onSelect={(date) => { if (date) setCurrentDate(date); }}
                      modifiers={{ hasAppointment: appointmentDates }}
                      modifiersClassNames={{ hasAppointment: "bg-primary/20 font-bold" }}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
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
              /* TABLE VIEW */
              <div>
                {/* Quick date filters */}
                <div className="p-3 border-b flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium mr-1">Quick:</span>
                  {[
                    { key: "yesterday", label: "Yesterday" },
                    { key: "today", label: "Today" },
                    { key: "tomorrow", label: "Tomorrow" },
                    { key: "this_week", label: "This Week" },
                    { key: "last_7", label: "Last 7 Days" },
                    { key: "this_month", label: "This Month" },
                  ].map((f) => (
                    <Button
                      key={f.key}
                      variant={quickFilter === f.key ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={() => setQuickFilter(quickFilter === f.key ? "" : f.key)}
                    >
                      {f.label}
                    </Button>
                  ))}
                  {quickFilter && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setQuickFilter("")}>
                      Clear
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">{sortedAppointments.length} result{sortedAppointments.length !== 1 ? "s" : ""}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("start_time")}>
                        <span className="flex items-center">Date<SortIcon column="start_time" /></span>
                      </th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
                      <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("patient")}>
                        <span className="flex items-center">Patient<SortIcon column="patient" /></span>
                      </th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                      <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("service")}>
                        <span className="flex items-center">Service<SortIcon column="service" /></span>
                      </th>
                      <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("doctor")}>
                        <span className="flex items-center">Doctor<SortIcon column="doctor" /></span>
                      </th>
                      <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("status")}>
                        <span className="flex items-center">Status<SortIcon column="status" /></span>
                      </th>
                      <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("bill")}>
                        <span className="flex items-center">Bill Amount<SortIcon column="bill" /></span>
                      </th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Visit Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Payment Mode</th>
                      <th className="text-left p-3 font-medium text-muted-foreground w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAppointments.map((apt: any) => {
                      const patientPhone = apt.patients?.phone || "";
                      const invoice = invoiceByAppointmentId.get(apt.id);
                      const isEditing = editingRow === apt.id;

                      if (isEditing) {
                        return (
                          <tr key={apt.id} className="border-b bg-primary/5">
                            <td className="p-2">
                              <Input
                                type="datetime-local"
                                className="h-8 text-xs w-40"
                                value={editValues.start_time}
                                onChange={(e) => setEditValues({ ...editValues, start_time: e.target.value })}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="datetime-local"
                                className="h-8 text-xs w-40"
                                value={editValues.end_time}
                                onChange={(e) => setEditValues({ ...editValues, end_time: e.target.value })}
                              />
                            </td>
                            <td className="p-2 font-medium">{apt.patient_name || (apt.patients ? `${apt.patients.first_name} ${apt.patients.last_name}` : "—")}</td>
                            <td className="p-2 text-muted-foreground text-xs">{patientPhone || "—"}</td>
                            <td className="p-2">
                              <Select value={editValues.service} onValueChange={(val) => setEditValues({ ...editValues, service: val })}>
                                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {services.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Select value={editValues.staff_id} onValueChange={(val) => setEditValues({ ...editValues, staff_id: val })}>
                                <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                  {doctorsList.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Select value={editValues.status} onValueChange={(val) => setEditValues({ ...editValues, status: val })}>
                                <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2 text-muted-foreground text-xs">{invoice ? `₹${invoice.total_amount?.toLocaleString()}` : "—"}</td>
                            <td className="p-2 text-muted-foreground text-xs">{apt.visit_status || "—"}</td>
                            <td className="p-2 text-muted-foreground text-xs">{invoice?.payment_mode || "—"}</td>
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={saveInlineEdit}><CheckIcon className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={cancelInlineEdit}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={apt.id} className="border-b hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setOpenModal("appointmentDetail", apt.id)}>
                          <td className="p-3">
                            <p className="font-medium">{format(new Date(apt.start_time), "MMM d, yyyy")}</p>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(apt.start_time), "h:mm a")} - {format(new Date(apt.end_time), "h:mm a")}
                          </td>
                          <td className="p-3 font-medium">{apt.patient_name || (apt.patients ? `${apt.patients.first_name} ${apt.patients.last_name}` : "—")}</td>
                          <td className="p-3 text-muted-foreground">
                            {patientPhone ? <span className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{patientPhone}</span> : "—"}
                          </td>
                          <td className="p-3">{apt.service || "—"}</td>
                          <td className="p-3 text-muted-foreground">{apt.staff_id ? (staffMap.get(apt.staff_id) || "—") : "—"}</td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <Select value={apt.status} onValueChange={(val) => inlineUpdateMutation.mutate({
                              id: apt.id,
                              status: val,
                              __notify: {
                                phone: apt.patients?.phone || "",
                                patientName: `${apt.patients?.first_name || ""} ${apt.patients?.last_name || ""}`.trim() || "Patient",
                                prevStatus: apt.status,
                                newStatus: val,
                                startTime: apt.start_time,
                                doctorName: apt.staff_id ? (staffMap.get(apt.staff_id) || "") : "",
                                serviceName: apt.service || "",
                                patientGender: apt.patients?.gender || null,
                              },
                            })}>
                              <SelectTrigger className="h-7 w-28 text-xs border-0 bg-transparent p-0">
                                <Badge className={cn("text-xs", statusColor(apt.status))}>{apt.status}</Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3 text-xs">{invoice ? <span className="font-medium">₹{invoice.total_amount?.toLocaleString()}</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="p-3 text-xs">{apt.visit_status ? <Badge variant="outline" className="text-xs">{apt.visit_status}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="p-3 text-xs">{invoice?.payment_mode ? <Badge variant="outline" className="text-xs">{invoice.payment_mode}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startInlineEdit(apt)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {sortedAppointments.length === 0 && (
                      <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No appointments found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : view === "month" ? (
              /* MONTH VIEW */
              <div>
                <div className="grid grid-cols-7 border-b">
                  {daysOfWeek.map((d) => (
                    <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-l first:border-l-0">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map((date, i) => {
                    const dayAppts = getApptsForDate(date);
                    const isCurrentMonth = isSameMonth(date, currentDate);
                    const isToday = isSameDay(date, today);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "border-b border-l first:border-l-0 min-h-[100px] p-1 transition-colors cursor-pointer hover:bg-muted/20",
                          !isCurrentMonth && "bg-muted/20",
                          isToday && "bg-primary/5",
                        )}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnDate(e, date)}
                        onClick={() => {
                          const d = new Date(date);
                          d.setHours(9, 0, 0, 0);
                          if (d < new Date()) { toast.error("Cannot book in the past"); return; }
                          setStartDate(d);
                          setStartTime("09:00");
                          setEndTime("09:15");
                          if (filterDoctors.size === 1) setStaffId(Array.from(filterDoctors)[0]);
                          setOpen(true);
                        }}
                      >
                        <div className="flex items-center justify-between px-1">
                          <span
                            className={cn("text-xs font-medium cursor-pointer hover:underline", isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : !isCurrentMonth ? "text-muted-foreground/50" : "text-foreground")}
                            onClick={() => { setCurrentDate(date); setView("day"); }}
                          >
                            {date.getDate()}
                          </span>
                          {dayAppts.length > 0 && <span className="text-[10px] text-muted-foreground">{dayAppts.length}</span>}
                        </div>
                        <div className="mt-1 space-y-0.5 max-h-[80px] overflow-y-auto">
                          {dayAppts.slice(0, 3).map((apt: any) => (
                            <AptCard key={apt.id} apt={apt} compact />
                          ))}
                          {dayAppts.length > 3 && (
                            <p className="text-[10px] text-muted-foreground px-1">+{dayAppts.length - 3} more</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : view === "week" ? (
              /* WEEK VIEW — 15 min slots */
              <div className="min-w-[800px]" onMouseUp={handleSlotMouseUp} onMouseLeave={() => { if (isDragSelecting) { setIsDragSelecting(false); dragSelectRef.current = null; setDragSelectEnd(null); } }}>
                <div className="grid grid-cols-8 border-b">
                  <div className="p-3 text-xs text-muted-foreground" />
                  {weekDates.map((date, i) => {
                    const isToday = date.toDateString() === today.toDateString();
                    return (
                      <div key={i} className={cn("p-3 text-center border-l", isToday && "bg-primary/5")}>
                        <p className="text-xs text-muted-foreground">{daysOfWeek[i]}</p>
                        <p className={cn("text-lg font-display font-semibold mt-0.5", isToday && "text-primary")}>{date.getDate()}</p>
                      </div>
                    );
                  })}
                </div>
                {slots.map((slot, si) => {
                  const showLabel = slot.minute === 0;
                  return (
                    <div key={si} className={cn("grid grid-cols-8 border-b last:border-0", slot.minute === 0 ? "min-h-[18px]" : "min-h-[18px]")}>
                      <div className="p-0.5 text-[10px] text-muted-foreground text-right pr-2 pt-0.5">
                        {showLabel && formatSlotTime(slot.hour, slot.minute)}
                      </div>
                      {weekDates.map((date, dayIndex) => {
                        const dayAppts = getApptsForSlot(date, slot.hour, slot.minute);
                        const isToday = date.toDateString() === today.toDateString();
                        return (
                          <div
                            key={dayIndex}
                            className={cn(
                              "border-l p-0.5 min-h-[18px] cursor-crosshair transition-colors select-none",
                              isToday && "bg-primary/5",
                              slot.minute === 0 && "border-t",
                              isSlotInDragRange(date, si) ? "bg-primary/20" : "hover:bg-muted/30"
                            )}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDropOnSlot(e, date, slot.hour, slot.minute)}
                            onMouseDown={(e) => { e.preventDefault(); handleSlotMouseDown(date, si); }}
                            onMouseEnter={() => handleSlotMouseEnter(date, si)}
                            onClick={() => {
                              if (isDragSelecting) return;
                              const d = new Date(date);
                              d.setHours(slot.hour, slot.minute, 0, 0);
                              if (d < new Date()) { toast.error("Cannot book in the past"); return; }
                              setStartDate(d);
                              setStartTime(`${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`);
                              const endMin = slot.minute + 15;
                              const endH = endMin >= 60 ? slot.hour + 1 : slot.hour;
                              const endM = endMin >= 60 ? 0 : endMin;
                              setEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
                              if (filterDoctors.size === 1) setStaffId(Array.from(filterDoctors)[0]);
                              setOpen(true);
                            }}
                          >
                            {dayAppts.map((apt: any) => (
                              <AptCard key={apt.id} apt={apt} compact />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* DAY VIEW — 15 min slots */
              <div className="min-w-[400px]" onMouseUp={handleSlotMouseUp} onMouseLeave={() => { if (isDragSelecting) { setIsDragSelecting(false); dragSelectRef.current = null; setDragSelectEnd(null); } }}>
                <div className="p-3 text-center border-b bg-primary/5">
                  <p className="text-xs text-muted-foreground">{daysOfWeek[currentDay]}</p>
                  <p className="text-2xl font-display font-bold text-primary">{currentDate.getDate()}</p>
                </div>
                {slots.map((slot, si) => {
                  const dayAppts = getApptsForSlot(currentDate, slot.hour, slot.minute);
                  const showLabel = slot.minute === 0;
                  return (
                    <div key={si} className={cn("flex", slot.minute === 0 ? "border-t" : "border-t border-dashed border-border/40", "last:border-b min-h-[36px]")}>
                      <div className="w-24 p-1 text-xs text-muted-foreground text-right shrink-0 pr-3">
                        {showLabel && formatSlotTime(slot.hour, slot.minute)}
                      </div>
                      <div
                        className={cn(
                          "flex-1 border-l p-1 space-y-0.5 cursor-crosshair transition-colors select-none",
                          isSlotInDragRange(currentDate, si) ? "bg-primary/20" : "hover:bg-muted/30"
                        )}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnSlot(e, currentDate, slot.hour, slot.minute)}
                        onMouseDown={(e) => { e.preventDefault(); handleSlotMouseDown(currentDate, si); }}
                        onMouseEnter={() => handleSlotMouseEnter(currentDate, si)}
                        onClick={() => {
                          if (isDragSelecting) return;
                          const d = new Date(currentDate);
                          d.setHours(slot.hour, slot.minute, 0, 0);
                          if (d < new Date()) { toast.error("Cannot book in the past"); return; }
                          setStartDate(d);
                          setStartTime(`${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`);
                          const endMin = slot.minute + 15;
                          const endH = endMin >= 60 ? slot.hour + 1 : slot.hour;
                          const endM = endMin >= 60 ? 0 : endMin;
                          setEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
                          if (filterDoctors.size === 1) setStaffId(Array.from(filterDoctors)[0]);
                          setOpen(true);
                        }}
                      >
                        {dayAppts.map((apt: any) => (
                          <AptCard key={apt.id} apt={apt} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <AppointmentDetailSheet
        appointmentId={selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
      />

      <Dialog open={showBillingPrompt} onOpenChange={setShowBillingPrompt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Billing Plan?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Would you like to create a billing plan for these recurring appointments?</p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowBillingPrompt(false)}>Skip</Button>
            <Button onClick={() => {
              setShowBillingPrompt(false);
              routerNavigate(`/billing?prefillPatient=${encodeURIComponent(lastCreatedPatientId)}&prefillService=${encodeURIComponent(lastCreatedService)}`);
            }}>Yes, Create Invoice</Button>
          </div>
        </DialogContent>
      </Dialog>

      {pendingFillNow && (
        <SurveyFill
          open={!!pendingFillNow}
          onOpenChange={(o) => { if (!o) setPendingFillNow(null); }}
          templateId={pendingFillNow.templateId}
          appointmentId={pendingFillNow.appointmentId}
          patientId={pendingFillNow.patientId}
          onComplete={() => setPendingFillNow(null)}
        />
      )}
    </div>
  );
};

export default Appointments;
