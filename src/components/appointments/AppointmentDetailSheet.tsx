import { useState } from "react";
import { format, isWithinInterval, parseISO, addMonths, addWeeks, addDays } from "date-fns";
import { X, Save, Trash2, Plus, Camera, Eye, FileText, Pill, IndianRupee, Image as ImageIcon, ScanEye, Phone, ExternalLink, AlertTriangle, CalendarClock, Check, Star, MessageSquare, CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CameraCapture } from "@/components/shared/CameraCapture";
import { SkinTracker } from "@/components/shared/SkinTracker";
import { ProcedureFormDialog } from "@/components/procedures/ProcedureFormDialog";
import { ProcedureDetailSheet } from "@/components/procedures/ProcedureDetailSheet";
import { CaseAnalysis } from "@/components/shared/CaseAnalysis";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const statusOptions = ["Proposed", "Confirmed", "Completed", "No Show", "Cancelled"];

const NPS_LABELS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

function FeedbackTabContent({
  appointmentId, patientId, patientName,
  npsScore, setNpsScore, serviceRating, setServiceRating,
  feedbackSubmitting, setFeedbackSubmitting, queryClient,
}: {
  appointmentId: string;
  patientId: string | null;
  patientName: string;
  npsScore: number | null;
  setNpsScore: (v: number | null) => void;
  serviceRating: number | null;
  setServiceRating: (v: number | null) => void;
  feedbackSubmitting: boolean;
  setFeedbackSubmitting: (v: boolean) => void;
  queryClient: any;
}) {
  const { data: existingFeedback, isLoading } = useQuery({
    queryKey: ["patient-feedback", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_feedback")
        .select("*")
        .eq("appointment_id", appointmentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  const handleSubmitFeedback = async () => {
    if (npsScore === null || serviceRating === null) {
      toast.error("Please answer both questions");
      return;
    }
    setFeedbackSubmitting(true);
    try {
      const { error } = await supabase.from("patient_feedback").insert({
        appointment_id: appointmentId,
        patient_id: patientId || "00000000-0000-0000-0000-000000000000",
        patient_name: patientName,
        nps_score: npsScore,
        service_rating: serviceRating,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["patient-feedback", appointmentId] });
      toast.success("Feedback recorded!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const getNpsColor = (score: number) => {
    if (score <= 6) return "bg-destructive text-destructive-foreground";
    if (score <= 8) return "bg-yellow-500 text-white";
    return "bg-green-600 text-white";
  };

  const getNpsLabel = (score: number) => {
    if (score <= 6) return "Detractor";
    if (score <= 8) return "Passive";
    return "Promoter";
  };

  if (isLoading) return <TabsContent value="feedback" className="p-6 mt-0"><p className="text-sm text-muted-foreground text-center py-8">Loading...</p></TabsContent>;

  if (existingFeedback) {
    return (
      <TabsContent value="feedback" className="p-6 space-y-5 mt-0">
        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Feedback Received
        </h3>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">How likely are you to recommend us? (NPS)</p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold ${getNpsColor(existingFeedback.nps_score)}`}>
                {existingFeedback.nps_score}
              </span>
              <Badge variant="outline" className="text-xs">{getNpsLabel(existingFeedback.nps_score)}</Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Overall Service Quality</p>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`h-5 w-5 ${s <= existingFeedback.service_rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Submitted {format(new Date(existingFeedback.created_at), "MMM d, yyyy · h:mm a")}</p>
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="feedback" className="p-6 space-y-5 mt-0">
      <h3 className="text-sm font-semibold font-display flex items-center gap-2">
        <MessageSquare className="h-4 w-4" /> Patient Feedback
      </h3>

      {/* NPS Question */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">How likely are you to recommend us to a friend or colleague?</Label>
        <div className="flex gap-1 flex-wrap">
          {NPS_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setNpsScore(i)}
              className={`h-8 w-8 rounded-md text-xs font-semibold border transition-all ${
                npsScore === i
                  ? getNpsColor(i)
                  : "bg-background hover:bg-accent text-foreground border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
          <span>Not at all likely</span>
          <span>Extremely likely</span>
        </div>
        {npsScore !== null && (
          <Badge variant="outline" className="text-xs">{getNpsLabel(npsScore)}</Badge>
        )}
      </div>

      {/* Service Quality */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">How would you rate the overall quality of service?</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setServiceRating(s)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star className={`h-7 w-7 ${serviceRating !== null && s <= serviceRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30 hover:text-yellow-300"}`} />
            </button>
          ))}
        </div>
        {serviceRating !== null && (
          <p className="text-xs text-muted-foreground">
            {serviceRating <= 2 ? "Poor" : serviceRating === 3 ? "Average" : serviceRating === 4 ? "Good" : "Excellent"}
          </p>
        )}
      </div>

      <Button
        onClick={handleSubmitFeedback}
        disabled={feedbackSubmitting || npsScore === null || serviceRating === null}
        className="w-full gap-2"
      >
        <Check className="h-4 w-4" /> Submit Feedback
      </Button>
    </TabsContent>
  );
}

interface AppointmentDetailSheetProps {
  appointmentId: string | null;
  onClose: () => void;
}

export function AppointmentDetailSheet({ appointmentId, onClose }: AppointmentDetailSheetProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [skinTrackerOpen, setSkinTrackerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [procFormOpen, setProcFormOpen] = useState(false);
  const [selectedProcId, setSelectedProcId] = useState<string | null>(null);
  // Billing plan state
  const [billingTotal, setBillingTotal] = useState(0);
  const [billingType, setBillingType] = useState<"one-time" | "recurring">("one-time");
  const [billingFrequency, setBillingFrequency] = useState<"weekly" | "monthly">("monthly");
  const [billingInstallments, setBillingInstallments] = useState(2);
  const [billingMode, setBillingMode] = useState("Cash");
  const [billingConfirmed, setBillingConfirmed] = useState(false);
  const [billingCreating, setBillingCreating] = useState(false);
  const [customSchedule, setCustomSchedule] = useState<{ date: Date; amount: number }[]>([]);
  // Feedback state
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [serviceRating, setServiceRating] = useState<number | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Fetch appointment
  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointment-detail", appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null;
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(id, first_name, last_name, phone), staff(first_name, last_name)")
        .eq("id", appointmentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  // Editable fields
  const [editService, setEditService] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editStaffId, setEditStaffId] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialize form when appointment loads
  // Fetch staff list for doctor dropdown
  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, first_name, last_name, role").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch approved leaves to show on-leave indicator
  const { data: approvedLeaves = [] } = useQuery({
    queryKey: ["approved-leaves-today"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("leave_applications")
        .select("staff_id, start_date, end_date")
        .eq("status", "Approved")
        .lte("start_date", today)
        .gte("end_date", today);
      if (error) throw error;
      return data;
    },
  });

  const staffOnLeaveIds = new Set(approvedLeaves.map((l: any) => l.staff_id));

  if (appointment && !initialized) {
    setEditService(appointment.service || "");
    setEditStatus(appointment.status || "Proposed");
    setEditStartTime(appointment.start_time ? format(new Date(appointment.start_time), "yyyy-MM-dd'T'HH:mm") : "");
    setEditEndTime(appointment.end_time ? format(new Date(appointment.end_time), "yyyy-MM-dd'T'HH:mm") : "");
    setEditStaffId(appointment.staff_id || "");
    setInitialized(true);
  }

  const handleClose = () => {
    setInitialized(false);
    setActiveTab("details");
    onClose();
  };

  // Fetch procedures for this appointment
  const { data: procedures = [] } = useQuery({
    queryKey: ["appointment-procedures", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedures")
        .select("*, staff(first_name, last_name)")
        .eq("appointment_id", appointmentId!)
        .order("procedure_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  // Auto-set status to Completed if procedures exist
  const hasCompletedProcedure = procedures.some((p: any) => p.status === "Completed");

  const { data: invoices = [] } = useQuery({
    queryKey: ["appointment-invoices", appointment?.patient_id],
    queryFn: async () => {
      if (!appointment?.patient_id) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("patient_id", appointment.patient_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!appointment?.patient_id,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["appointment-photos", appointmentId, appointment?.patient_id],
    queryFn: async () => {
      if (!appointment?.patient_id) return [];
      const { data, error } = await supabase
        .from("patient_photos")
        .select("*, procedures(service_name)")
        .eq("patient_id", appointment.patient_id)
        .order("taken_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!appointment?.patient_id,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("appointments")
        .update({
          service: editService,
          status: hasCompletedProcedure ? "Completed" : editStatus,
          start_time: new Date(editStartTime).toISOString(),
          end_time: new Date(editEndTime).toISOString(),
          staff_id: editStaffId || null,
        })
        .eq("id", appointmentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-detail", appointmentId] });
      toast.success("Appointment updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("appointments").delete().eq("id", appointmentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment deleted");
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Generate installment schedule (used to seed customSchedule)
  const generateDefaultSchedule = () => {
    if (billingTotal <= 0) return [];
    const baseDate = appointment?.start_time ? new Date(appointment.start_time) : new Date();
    if (billingType === "one-time") {
      return [{ date: baseDate, amount: billingTotal }];
    }
    const count = Math.max(2, billingInstallments);
    const perInstallment = Math.floor(billingTotal / count);
    const remainder = billingTotal - perInstallment * count;
    return Array.from({ length: count }, (_, i) => {
      const date = billingFrequency === "monthly" ? addMonths(baseDate, i) : addWeeks(baseDate, i);
      return { date, amount: i === 0 ? perInstallment + remainder : perInstallment };
    });
  };

  // Recalculate schedule when inputs change
  const regenerateSchedule = () => {
    const schedule = generateDefaultSchedule();
    setCustomSchedule(schedule);
    setBillingConfirmed(false);
  };

  const scheduleTotal = customSchedule.reduce((s, i) => s + i.amount, 0);
  const scheduleMismatch = customSchedule.length > 0 && scheduleTotal !== billingTotal;

  const updateScheduleDate = (idx: number, date: Date) => {
    const updated = [...customSchedule];
    updated[idx] = { ...updated[idx], date };
    setCustomSchedule(updated);
    setBillingConfirmed(false);
  };

  const updateScheduleAmount = (idx: number, amount: number) => {
    const updated = [...customSchedule];
    updated[idx] = { ...updated[idx], amount };
    setCustomSchedule(updated);
    setBillingConfirmed(false);
  };

  const handleCreateBillingInvoices = async () => {
    if (billingTotal <= 0) { toast.error("Enter a valid amount"); return; }
    if (scheduleMismatch) { toast.error("Schedule amounts don't match the total bill amount"); return; }
    setBillingCreating(true);
    try {
      const schedule = customSchedule;
      const services = [appointment?.service || ""].filter(Boolean);
      const inserts = schedule.map((inst, i) => {
        const baseNum = (Date.now() + i + 1).toString().slice(-6);
        return {
          invoice_number: `INV-${baseNum}`,
          patient_id: appointment?.patient_id || null,
          patient_name: patientName,
          services,
          total_amount: inst.amount,
          paid_amount: 0,
          status: "Pending" as const,
          payment_type: billingType === "one-time" ? "One-time" : "Staged",
          payment_mode: billingMode,
          notes: billingType === "recurring" ? `Installment ${i + 1} of ${schedule.length}` : null,
          appointment_id: appointmentId,
        };
      });
      const { error } = await supabase.from("invoices").insert(inserts);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["appointment-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`${inserts.length} invoice(s) created`);
      setBillingConfirmed(false);
      setBillingTotal(0);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBillingCreating(false);
    }
  };

  const patientName = appointment?.patients
    ? `${appointment.patients.first_name} ${appointment.patients.last_name}`
    : appointment?.patient_name || "Unknown";

  const patientPhone = appointment?.patients?.phone || "";
  const patientId = appointment?.patients?.id || appointment?.patient_id;

  const appointmentPhotos = photos.filter((p: any) => p.appointment_id === appointmentId);
  const otherPhotos = photos.filter((p: any) => p.appointment_id !== appointmentId);

  return (
    <>
      <Sheet open={!!appointmentId} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto p-0">
          {isLoading || !appointment ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : (
            <>
              <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground mb-1.5 font-normal">Appointment</Badge>
                    <SheetTitle className="font-display text-lg flex items-center gap-2">
                      <button
                        className="hover:text-primary underline-offset-2 hover:underline transition-colors text-left"
                        onClick={() => {
                          if (patientId) {
                            handleClose();
                            navigate(`/patients/${patientId}`);
                          }
                        }}
                      >
                        {patientName}
                      </button>
                      {patientId && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(appointment.start_time), "EEE, MMM d, yyyy · h:mm a")}
                    </p>
                    {patientPhone && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {patientPhone}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">{hasCompletedProcedure ? "Completed" : appointment.status}</Badge>
                </div>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b px-6 bg-transparent h-auto p-0">
                  <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3">Details</TabsTrigger>
                  <TabsTrigger value="procedures" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3">Procedures</TabsTrigger>
                  <TabsTrigger value="billing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3">Billing</TabsTrigger>
                  <TabsTrigger value="photos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3">Photos</TabsTrigger>
                  <TabsTrigger value="feedback" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3">Feedback</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="p-6 space-y-4 mt-0">
                  <div>
                    <Label>Patient</Label>
                    <div className="mt-1.5">
                      <Button
                        variant="outline"
                        className="w-full justify-start font-normal text-left"
                        onClick={() => {
                          if (patientId) {
                            handleClose();
                            navigate(`/patients/${patientId}`);
                          }
                        }}
                      >
                        {patientName}
                        {patientId && <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />}
                      </Button>
                    </div>
                    {patientPhone && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {patientPhone}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Service</Label>
                    <Input value={editService} onChange={(e) => setEditService(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={hasCompletedProcedure ? "Completed" : editStatus} onValueChange={setEditStatus} disabled={hasCompletedProcedure}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {hasCompletedProcedure && (
                      <p className="text-xs text-muted-foreground mt-1">Auto-set to Completed (has completed procedure)</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start</Label>
                      <Input type="datetime-local" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input type="datetime-local" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="mt-1.5" />
                    </div>
                  </div>
                  <div>
                    <Label>Doctor</Label>
                    <Select value={editStaffId || "none"} onValueChange={(v) => setEditStaffId(v === "none" ? "" : v)}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No doctor assigned</SelectItem>
                        {staffList.map((s) => {
                          const onLeave = staffOnLeaveIds.has(s.id);
                          return (
                            <SelectItem key={s.id} value={s.id}>
                              <span className="flex items-center gap-2">
                                Dr. {s.first_name} {s.last_name}
                                {onLeave && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">
                                    <AlertTriangle className="h-3 w-3" /> On Leave
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {appointment.source && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Source: {appointment.source}</Badge>
                      {appointment.is_recurring && <Badge variant="outline" className="text-xs">Recurring</Badge>}
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t">
                    <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="flex-1 gap-2">
                      <Save className="h-4 w-4" />
                      {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete appointment?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove this appointment.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TabsContent>

                <TabsContent value="procedures" className="p-6 space-y-4 mt-0">
                  {appointment.patient_id ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                          <Pill className="h-4 w-4" /> Linked Procedures
                        </h3>
                        <div className="flex gap-2">
                          <CaseAnalysis patientId={appointment.patient_id} patientName={patientName} />
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setProcFormOpen(true)}>
                            <Plus className="h-3 w-3" /> Add Procedure
                          </Button>
                        </div>
                      </div>
                      {procedures.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No procedures linked. Click "Add Procedure" to create one.</p>
                      ) : (
                        <div className="space-y-2">
                          {procedures.map((proc: any) => (
                            <div key={proc.id} className="border rounded-lg p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedProcId(proc.id)}>
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{proc.service_name}</p>
                                <Badge variant="secondary" className="text-xs">{proc.status}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(proc.procedure_date), "MMM d, yyyy")}
                                {proc.staff && ` · Dr. ${proc.staff.first_name}`}
                              </p>
                              {proc.diagnosis && <p className="text-xs mt-2 text-muted-foreground">{proc.diagnosis}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No patient linked to this appointment.</p>
                  )}
                </TabsContent>

                <TabsContent value="billing" className="p-6 space-y-4 mt-0">
                  <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" /> Billing Plan
                  </h3>

                  {appointment.patient_id ? (
                    <div className="space-y-4">
                      {/* Total Amount */}
                      <div>
                        <Label>Total Bill Amount (₹)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 100000"
                          value={billingTotal || ""}
                          onChange={(e) => { setBillingTotal(Number(e.target.value)); setBillingConfirmed(false); }}
                          className="mt-1.5"
                        />
                      </div>

                      {/* Billing Type */}
                      <div>
                        <Label>Billing Type</Label>
                        <RadioGroup
                          value={billingType}
                          onValueChange={(v) => { setBillingType(v as any); setBillingConfirmed(false); }}
                          className="flex gap-4 mt-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="one-time" id="bt-one" />
                            <Label htmlFor="bt-one" className="font-normal cursor-pointer">One-time</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="recurring" id="bt-rec" />
                            <Label htmlFor="bt-rec" className="font-normal cursor-pointer">Installments</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Recurring options */}
                      {billingType === "recurring" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Frequency</Label>
                            <Select value={billingFrequency} onValueChange={(v) => { setBillingFrequency(v as any); setBillingConfirmed(false); }}>
                              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>No. of Installments</Label>
                            <Input
                              type="number"
                              min={2}
                              max={24}
                              value={billingInstallments}
                              onChange={(e) => { setBillingInstallments(Math.max(2, Number(e.target.value))); setBillingConfirmed(false); }}
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                      )}

                      {/* Payment Mode */}
                      <div>
                        <Label>Payment Mode</Label>
                        <Select value={billingMode} onValueChange={setBillingMode}>
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Cash", "Card", "UPI", "Bank Transfer", "Cheque"].map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Schedule Preview */}
                      {billingTotal > 0 && (
                        <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                          <p className="text-xs font-semibold flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" /> Invoice Schedule
                          </p>
                          <div className="space-y-1.5">
                            {getInstallmentSchedule().map((inst) => (
                              <div key={inst.index} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5 last:border-0">
                                <span className="text-muted-foreground">
                                  #{inst.index} · {format(inst.date, "MMM d, yyyy")}
                                </span>
                                <span className="font-medium">₹{inst.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between text-xs font-semibold pt-1 border-t">
                            <span>Total</span>
                            <span>₹{billingTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      )}

                      {/* Confirm & Create */}
                      {billingTotal > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-start gap-2">
                            <Checkbox
                              id="billing-confirm"
                              checked={billingConfirmed}
                              onCheckedChange={(c) => setBillingConfirmed(!!c)}
                            />
                            <Label htmlFor="billing-confirm" className="font-normal text-xs leading-relaxed cursor-pointer">
                              I confirm the schedule above. Create {getInstallmentSchedule().length} invoice(s) for {patientName} with service "{appointment.service}" linked to this appointment.
                            </Label>
                          </div>
                          <Button
                            onClick={handleCreateBillingInvoices}
                            disabled={!billingConfirmed || billingCreating}
                            className="w-full gap-2"
                          >
                            <Check className="h-4 w-4" />
                            {billingCreating ? "Creating Invoices..." : `Create ${getInstallmentSchedule().length} Invoice(s)`}
                          </Button>
                        </div>
                      )}

                      {/* Existing invoices */}
                      {invoices.length > 0 && (
                        <div className="pt-4 border-t space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Existing Invoices</p>
                          {invoices.map((inv: any) => (
                            <div
                              key={inv.id}
                              className="border rounded-lg p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => { handleClose(); navigate("/billing"); }}
                              title="Open in Billing"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-sm">{inv.invoice_number}</p>
                                  <ExternalLink className="h-3 w-3 text-primary" />
                                </div>
                                <Badge variant="secondary" className={`text-xs ${inv.status === "Paid" ? "bg-success/10 text-success" : inv.status === "Partial" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                                  {inv.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {inv.services?.join(", ")} · ₹{Number(inv.total_amount).toLocaleString()}
                                {inv.notes && ` · ${inv.notes}`}
                              </p>
                              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                <span>Paid: ₹{Number(inv.paid_amount).toLocaleString()}</span>
                                <span>Balance: ₹{(Number(inv.total_amount) - Number(inv.paid_amount)).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No patient linked to this appointment.</p>
                  )}
                </TabsContent>

                <TabsContent value="photos" className="p-6 space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                      <Camera className="h-4 w-4" /> Photos
                    </h3>
                    {appointment.patient_id && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setSkinTrackerOpen(true)}>
                          <ScanEye className="h-3 w-3" /> Skin Tracker
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setCameraOpen(true)}>
                          <Plus className="h-3 w-3" /> Take Photo
                        </Button>
                      </div>
                    )}
                  </div>

                  {appointmentPhotos.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">This Appointment</p>
                      <div className="grid grid-cols-3 gap-2">
                        {appointmentPhotos.map((photo: any) => (
                          <div key={photo.id} className="relative group">
                            <img src={photo.photo_url} alt="" className="w-full h-24 object-cover rounded-lg border" />
                            <Badge variant="secondary" className="absolute top-1 left-1 text-[10px]">{photo.photo_type}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {otherPhotos.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">All Patient Photos</p>
                      <div className="grid grid-cols-3 gap-2">
                        {otherPhotos.map((photo: any) => (
                          <div key={photo.id} className="relative group">
                            <img src={photo.photo_url} alt="" className="w-full h-24 object-cover rounded-lg border" />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 rounded-b-lg">
                              {photo.photo_type} · {format(new Date(photo.taken_at), "MMM d")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {photos.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No photos yet. Click "Take Photo" to add one.</p>
                  )}
                </TabsContent>

                <FeedbackTabContent
                  appointmentId={appointmentId!}
                  patientId={appointment.patient_id}
                  patientName={patientName}
                  npsScore={npsScore}
                  setNpsScore={setNpsScore}
                  serviceRating={serviceRating}
                  setServiceRating={setServiceRating}
                  feedbackSubmitting={feedbackSubmitting}
                  setFeedbackSubmitting={setFeedbackSubmitting}
                  queryClient={queryClient}
                />
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {cameraOpen && appointment?.patient_id && (
        <CameraCapture
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          patientId={appointment.patient_id}
          patientName={patientName}
          context="appointment"
          contextId={appointmentId!}
        />
      )}

      {skinTrackerOpen && appointment?.patient_id && (
        <SkinTracker
          open={skinTrackerOpen}
          onOpenChange={setSkinTrackerOpen}
          photos={photos}
          patientName={patientName}
        />
      )}

      {procFormOpen && appointment?.patient_id && (
        <ProcedureFormDialog
          open={procFormOpen}
          onOpenChange={setProcFormOpen}
          defaultPatientId={appointment.patient_id}
          defaultAppointmentId={appointmentId!}
          defaultStaffId={appointment.staff_id}
          defaultServiceName={appointment.service}
        />
      )}

      <ProcedureDetailSheet procedureId={selectedProcId} onClose={() => setSelectedProcId(null)} />
    </>
  );
}
