import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart, Home, Calendar, ClipboardList, Camera, Receipt, Pill,
  LogOut, Clock, User, ChevronRight, Plus, Send, Loader2, Stethoscope,
  MessageCircle, ShoppingBag,
} from "lucide-react";
import PortalShop from "@/components/portal/PortalShop";
import PortalBot from "@/components/portal/PortalBot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PortalSession {
  patientId: string;
  sessionToken: string;
  patientName: string;
  expiresAt: string;
}

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "appointments", label: "Appts", icon: Calendar },
  { id: "procedures", label: "History", icon: ClipboardList },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "billing", label: "Bills", icon: Receipt },
  { id: "pharmacy", label: "Shop", icon: ShoppingBag },
  { id: "bot", label: "AI Bot", icon: MessageCircle },
];

const Portal = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("home");
  const [session, setSession] = useState<PortalSession | null>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [pharmaOpen, setPharmaOpen] = useState(false);

  // Appointment request form
  const [apptService, setApptService] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [apptNotes, setApptNotes] = useState("");

  // Pharma request form
  const [pharmaProductId, setPharmaProductId] = useState("");
  const [pharmaQty, setPharmaQty] = useState(1);
  const [pharmaNotes, setPharmaNotes] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("portal_session");
    if (!stored) {
      navigate("/portal");
      return;
    }
    const parsed = JSON.parse(stored) as PortalSession;
    if (new Date(parsed.expiresAt) < new Date()) {
      localStorage.removeItem("portal_session");
      navigate("/portal");
      return;
    }
    setSession(parsed);
  }, [navigate]);

  const patientId = session?.patientId;

  const logout = () => {
    localStorage.removeItem("portal_session");
    navigate("/portal");
  };

  // ─── Queries ─────────────────────────────────────
  const { data: patient } = useQuery({
    queryKey: ["portal-patient", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("*").eq("id", patientId!).single();
      return data;
    },
    enabled: !!patientId,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["portal-appointments", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, staff(first_name, last_name)")
        .eq("patient_id", patientId!)
        .order("start_time", { ascending: false });
      return data || [];
    },
    enabled: !!patientId,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ["portal-procedures", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("procedures")
        .select("*, staff(first_name, last_name), prescriptions(*)")
        .eq("patient_id", patientId!)
        .order("procedure_date", { ascending: false });
      return data || [];
    },
    enabled: !!patientId,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["portal-photos", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patient_photos")
        .select("*, procedures(service_name)")
        .eq("patient_id", patientId!)
        .order("taken_at", { ascending: false });
      return data || [];
    },
    enabled: !!patientId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["portal-invoices", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("patient_id", patientId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!patientId,
  });

  const { data: pharmaProducts = [] } = useQuery({
    queryKey: ["portal-pharma-products"],
    queryFn: async () => {
      const { data } = await supabase.from("pharma_products").select("*").order("name");
      return data || [];
    },
  });

  const { data: pharmaRequests = [] } = useQuery({
    queryKey: ["portal-pharma-requests", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patient_pharma_requests")
        .select("*")
        .eq("patient_id", patientId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!patientId,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["portal-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("*").eq("role", "Doctor").order("first_name");
      return data || [];
    },
  });

  const { data: workingHours = [] } = useQuery({
    queryKey: ["portal-working-hours"],
    queryFn: async () => {
      const { data } = await supabase.from("working_hours").select("*").eq("is_open", true).order("day_of_week");
      return data || [];
    },
  });

  // ─── Mutations ──────────────────────────────────
  const requestAppointment = useMutation({
    mutationFn: async () => {
      const startTime = new Date(`${apptDate}T${apptTime}`);
      const endTime = new Date(startTime.getTime() + 30 * 60000);
      const { error } = await supabase.from("appointments").insert({
        patient_id: patientId,
        patient_name: session?.patientName,
        service: apptService,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: "Requested",
        source: "portal",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-appointments"] });
      toast.success("Appointment request submitted!");
      setApptOpen(false);
      setApptService("");
      setApptDate("");
      setApptTime("");
      setApptNotes("");
    },
    onError: () => toast.error("Failed to submit request"),
  });

  const requestPharma = useMutation({
    mutationFn: async () => {
      const product = pharmaProducts.find((p: any) => p.id === pharmaProductId);
      const { error } = await supabase.from("patient_pharma_requests").insert({
        patient_id: patientId,
        product_id: pharmaProductId,
        product_name: product?.name || "",
        quantity: pharmaQty,
        notes: pharmaNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-pharma-requests"] });
      toast.success("Product request submitted!");
      setPharmaOpen(false);
      setPharmaProductId("");
      setPharmaQty(1);
      setPharmaNotes("");
    },
    onError: () => toast.error("Failed to submit request"),
  });

  if (!session) return null;

  const upcomingAppts = appointments.filter((a: any) => new Date(a.start_time) >= new Date());
  const pastAppts = appointments.filter((a: any) => new Date(a.start_time) < new Date());
  const totalDue = invoices
    .filter((i: any) => i.status !== "Paid")
    .reduce((s: number, i: any) => s + (Number(i.total_amount) - Number(i.paid_amount)), 0);

  const statusColors: Record<string, string> = {
    Scheduled: "bg-primary/10 text-primary",
    Requested: "bg-warning/10 text-warning",
    Completed: "bg-success/10 text-success",
    Cancelled: "bg-destructive/10 text-destructive",
    Confirmed: "bg-primary/10 text-primary",
  };

  const invoiceStatusColors: Record<string, string> = {
    Paid: "bg-success/10 text-success",
    Partial: "bg-warning/10 text-warning",
    Pending: "bg-destructive/10 text-destructive",
  };

  const requestStatusColors: Record<string, string> = {
    Pending: "bg-warning/10 text-warning",
    Confirmed: "bg-success/10 text-success",
    Declined: "bg-destructive/10 text-destructive",
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-[hsl(174,62%,30%)] text-primary-foreground px-4 py-4 safe-area-top">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="h-6 w-6" />
            <div>
              <p className="font-bold text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>DermaCare</p>
              <p className="text-xs opacity-80">Patient Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs opacity-80">Welcome</p>
              <p className="text-sm font-semibold">{session.patientName}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-lg mx-auto px-4 py-5">
          <AnimatePresence mode="wait">
            {/* ─── HOME ─── */}
            {activeTab === "home" && (
              <motion.div key="home" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card rounded-xl p-4 border shadow-sm">
                    <Calendar className="h-5 w-5 text-primary mb-2" />
                    <p className="text-2xl font-bold">{upcomingAppts.length}</p>
                    <p className="text-xs text-muted-foreground">Upcoming Appointments</p>
                  </div>
                  <div className="bg-card rounded-xl p-4 border shadow-sm">
                    <Receipt className="h-5 w-5 text-warning mb-2" />
                    <p className="text-2xl font-bold">₹{totalDue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                  </div>
                  <div className="bg-card rounded-xl p-4 border shadow-sm">
                    <ClipboardList className="h-5 w-5 text-success mb-2" />
                    <p className="text-2xl font-bold">{procedures.length}</p>
                    <p className="text-xs text-muted-foreground">Total Procedures</p>
                  </div>
                  <div className="bg-card rounded-xl p-4 border shadow-sm">
                    <Camera className="h-5 w-5 text-accent-foreground mb-2" />
                    <p className="text-2xl font-bold">{photos.length}</p>
                    <p className="text-xs text-muted-foreground">Clinical Photos</p>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="bg-card rounded-xl border shadow-sm p-4">
                  <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => { setActiveTab("appointments"); setApptOpen(true); }}>
                      <Plus className="h-4 w-4 text-primary" />
                      <span className="text-xs">Request Appointment</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => { setActiveTab("pharmacy"); setPharmaOpen(true); }}>
                      <Pill className="h-4 w-4 text-primary" />
                      <span className="text-xs">Order Medicine</span>
                    </Button>
                  </div>
                </div>

                {/* Doctor availability */}
                <div className="bg-card rounded-xl border shadow-sm p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" /> Clinic Hours
                  </h3>
                  <div className="space-y-2">
                    {workingHours.map((wh: any) => (
                      <div key={wh.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{dayNames[wh.day_of_week]}</span>
                        <span className="font-medium">{wh.open_time?.slice(0, 5)} – {wh.close_time?.slice(0, 5)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Doctors */}
                {staff.length > 0 && (
                  <div className="bg-card rounded-xl border shadow-sm p-4">
                    <h3 className="font-semibold text-sm mb-3">Our Doctors</h3>
                    <div className="space-y-2">
                      {staff.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {s.first_name[0]}{s.last_name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium">Dr. {s.first_name} {s.last_name}</p>
                            {s.specialization && <p className="text-xs text-muted-foreground">{s.specialization}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next appointment */}
                {upcomingAppts.length > 0 && (
                  <div className="bg-primary/5 rounded-xl border border-primary/20 p-4">
                    <h3 className="font-semibold text-sm mb-2 text-primary">Next Appointment</h3>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{(upcomingAppts[0] as any).service}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date((upcomingAppts[0] as any).start_time).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
                          {" at "}
                          {new Date((upcomingAppts[0] as any).start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── APPOINTMENTS ─── */}
            {activeTab === "appointments" && (
              <motion.div key="appointments" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg">Appointments</h2>
                  <Button size="sm" className="gap-1" onClick={() => setApptOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Request
                  </Button>
                </div>

                {upcomingAppts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Upcoming</p>
                    <div className="space-y-2">
                      {upcomingAppts.map((a: any) => (
                        <div key={a.id} className="bg-card rounded-xl border p-4 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{a.service}</p>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(a.start_time).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
                                {" • "}
                                {new Date(a.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                              {a.staff && <p className="text-xs text-muted-foreground mt-0.5">Dr. {a.staff.first_name} {a.staff.last_name}</p>}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[a.status] || ""}`}>
                              {a.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pastAppts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Past</p>
                    <div className="space-y-2">
                      {pastAppts.slice(0, 10).map((a: any) => (
                        <div key={a.id} className="bg-card rounded-xl border p-3 shadow-sm opacity-70">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{a.service}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(a.start_time).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[a.status] || ""}`}>
                              {a.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {appointments.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No appointments yet</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setApptOpen(true)}>Request your first appointment</Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── PROCEDURES ─── */}
            {activeTab === "procedures" && (
              <motion.div key="procedures" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                <h2 className="font-bold text-lg">Procedure History</h2>
                {procedures.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No procedures recorded yet</p>
                  </div>
                ) : procedures.map((p: any) => (
                  <div key={p.id} className="bg-card rounded-xl border p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{p.service_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(p.procedure_date).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
                          {p.staff && ` • Dr. ${p.staff.first_name} ${p.staff.last_name}`}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{p.status}</Badge>
                    </div>
                    {p.diagnosis && (
                      <div className="bg-muted/50 rounded-lg p-2 mb-2">
                        <p className="text-xs text-muted-foreground">Diagnosis</p>
                        <p className="text-sm">{p.diagnosis}</p>
                      </div>
                    )}
                    {p.consultation_notes && (
                      <div className="bg-muted/50 rounded-lg p-2 mb-2">
                        <p className="text-xs text-muted-foreground">Consultation Notes</p>
                        <p className="text-sm">{p.consultation_notes}</p>
                      </div>
                    )}
                    {p.prescriptions && p.prescriptions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Prescriptions</p>
                        <div className="space-y-1">
                          {p.prescriptions.map((rx: any) => (
                            <div key={rx.id} className="flex items-center justify-between text-sm bg-primary/5 rounded-lg px-3 py-1.5">
                              <span className="font-medium">{rx.medicine_name}</span>
                              <span className="text-xs text-muted-foreground">{rx.dosage} • {rx.frequency} • {rx.duration}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            {/* ─── PHOTOS ─── */}
            {activeTab === "photos" && (
              <motion.div key="photos" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                <h2 className="font-bold text-lg">Clinical Photos</h2>
                {photos.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Camera className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No photos available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((photo: any) => (
                      <div key={photo.id} className="bg-card rounded-xl border overflow-hidden shadow-sm">
                        <img src={photo.photo_url} alt="Clinical" className="w-full aspect-square object-cover" />
                        <div className="p-2">
                          <p className="text-xs font-medium">{photo.photo_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(photo.taken_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                          </p>
                          {photo.procedures?.service_name && (
                            <p className="text-xs text-primary mt-0.5">{photo.procedures.service_name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── BILLING ─── */}
            {activeTab === "billing" && (
              <motion.div key="billing" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                <h2 className="font-bold text-lg">Billing</h2>

                {totalDue > 0 && (
                  <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
                    <p className="text-xs text-warning font-semibold mb-1">Outstanding Balance</p>
                    <p className="text-2xl font-bold">₹{totalDue.toLocaleString()}</p>
                  </div>
                )}

                {invoices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No invoices yet</p>
                  </div>
                ) : invoices.map((inv: any) => (
                  <div key={inv.id} className="bg-card rounded-xl border p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${invoiceStatusColors[inv.status] || ""}`}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(inv.services || []).map((s: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold">₹{Number(inv.total_amount).toLocaleString()}</span>
                    </div>
                    {inv.status !== "Pending" && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Paid</span>
                        <span className="text-success">₹{Number(inv.paid_amount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            {/* ─── PHARMACY ─── */}
            {activeTab === "pharmacy" && (
              <motion.div key="pharmacy" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg">Pharmacy</h2>
                  <Button size="sm" className="gap-1" onClick={() => setPharmaOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Request
                  </Button>
                </div>

                {/* Previous requests */}
                {pharmaRequests.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Your Requests</p>
                    <div className="space-y-2">
                      {pharmaRequests.map((r: any) => (
                        <div key={r.id} className="bg-card rounded-xl border p-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{r.product_name}</p>
                              <p className="text-xs text-muted-foreground">Qty: {r.quantity} • {new Date(r.created_at).toLocaleDateString("en-IN")}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${requestStatusColors[r.status] || ""}`}>
                              {r.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Browse products */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Available Products</p>
                  <div className="space-y-2">
                    {pharmaProducts.map((p: any) => (
                      <div key={p.id} className="bg-card rounded-xl border p-3 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category} {p.generic_name ? `• ${p.generic_name}` : ""}</p>
                          <p className="text-sm font-semibold text-primary mt-0.5">₹{p.selling_price}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            setPharmaProductId(p.id);
                            setPharmaQty(1);
                            setPharmaOpen(true);
                          }}
                        >
                          Request
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ─── Appointment Request Dialog ─── */}
      <Dialog open={apptOpen} onOpenChange={setApptOpen}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Request Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Service / Reason *</Label>
              <Input className="mt-1.5" placeholder="e.g. Skin consultation" value={apptService} onChange={(e) => setApptService(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preferred Date *</Label>
                <Input type="date" className="mt-1.5" value={apptDate} onChange={(e) => setApptDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <Label>Preferred Time *</Label>
                <Input type="time" className="mt-1.5" value={apptTime} onChange={(e) => setApptTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea className="mt-1.5" placeholder="Any additional details..." rows={2} value={apptNotes} onChange={(e) => setApptNotes(e.target.value)} />
            </div>
            <Button className="w-full gap-2" onClick={() => requestAppointment.mutate()} disabled={!apptService || !apptDate || !apptTime || requestAppointment.isPending}>
              {requestAppointment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Request
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              The clinic will confirm or suggest an alternative time.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Pharma Request Dialog ─── */}
      <Dialog open={pharmaOpen} onOpenChange={setPharmaOpen}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Request Medicine</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Product *</Label>
              <Select value={pharmaProductId} onValueChange={setPharmaProductId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {pharmaProducts.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — ₹{p.selling_price}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" className="mt-1.5" min={1} value={pharmaQty} onChange={(e) => setPharmaQty(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea className="mt-1.5" placeholder="Any special instructions..." rows={2} value={pharmaNotes} onChange={(e) => setPharmaNotes(e.target.value)} />
            </div>
            <Button className="w-full gap-2" onClick={() => requestPharma.mutate()} disabled={!pharmaProductId || requestPharma.isPending}>
              {requestPharma.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Request
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              The clinic will process your request and contact you.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t safe-area-bottom z-50">
        <div className="max-w-lg mx-auto flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center py-2 pt-2.5 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                <span className={`text-[10px] mt-0.5 ${isActive ? "font-semibold" : ""}`}>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="portal-tab-indicator"
                    className="h-0.5 w-5 bg-primary rounded-full mt-0.5"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Portal;
