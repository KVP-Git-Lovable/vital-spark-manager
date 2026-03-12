import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Calendar, ClipboardList, Pill, Receipt, User, Loader2, Share2, Copy, Check, ScanEye, FileText, Users, Plus } from "lucide-react";
import { Patient360 } from "@/components/patients/Patient360";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CameraCapture } from "@/components/shared/CameraCapture";
import { SkinTracker } from "@/components/shared/SkinTracker";
import { CaseAnalysis } from "@/components/shared/CaseAnalysis";
import { FamilyMembers } from "@/components/patients/FamilyMembers";
import { FamilySummaryCard } from "@/components/patients/FamilySummaryCard";
import { ProcedureFormDialog } from "@/components/procedures/ProcedureFormDialog";
import { toast } from "sonner";

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [skinTrackerOpen, setSkinTrackerOpen] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpCopied, setOtpCopied] = useState(false);
  const [procedureFormOpen, setProcedureFormOpen] = useState(false);

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ["patient-procedures", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedures")
        .select("*, staff(first_name, last_name)")
        .eq("patient_id", id!)
        .order("procedure_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["patient-prescriptions", id],
    queryFn: async () => {
      const procIds = procedures.map((p) => p.id);
      if (procIds.length === 0) return [];
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*, procedures(service_name, procedure_date)")
        .in("procedure_id", procIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: procedures.length > 0,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["patient-appointments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, staff(first_name, last_name)")
        .eq("patient_id", id!)
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["patient-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("patient_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["patient-photos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_photos")
        .select("*, procedures(service_name)")
        .eq("patient_id", id!)
        .order("taken_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Patient not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/patients")}>Back to Patients</Button>
      </div>
    );
  }

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const statusStyles: Record<string, string> = {
    Paid: "bg-success/10 text-success",
    Partial: "bg-warning/10 text-warning",
    Pending: "bg-destructive/10 text-destructive",
  };

  return (
    <div>
      <div className="page-header">
        <Button variant="ghost" size="sm" className="gap-1 mb-3 md:mb-4" onClick={() => navigate("/patients")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Patient header - stack on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-lg md:text-xl shrink-0">
                {patient.first_name[0]}{patient.last_name[0]}
              </div>
              <div className="min-w-0">
                <h1 className="page-title text-xl md:text-2xl truncate">{patient.first_name} {patient.last_name}</h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 md:mt-1 text-xs md:text-sm text-muted-foreground">
                  {patient.gender && <span>{patient.gender}</span>}
                  {getAge(patient.date_of_birth) !== null && <span>• Age {getAge(patient.date_of_birth)}</span>}
                  {patient.blood_group && <span>• {patient.blood_group}</span>}
                  {patient.phone && <span className="hidden sm:inline">• {patient.phone}</span>}
                </div>
                {patient.phone && <p className="text-xs text-muted-foreground sm:hidden mt-0.5">{patient.phone}</p>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Patient360 patientId={id!} patientName={`${patient.first_name} ${patient.last_name}`} />
              <CaseAnalysis patientId={id!} patientName={`${patient.first_name} ${patient.last_name}`} />
              <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={() => setCameraOpen(true)}>
                <Camera className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Take</span> Photo
              </Button>
              <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={() => setSkinTrackerOpen(true)}>
                <ScanEye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Skin</span> Tracker
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-8 text-xs"
                onClick={async () => {
                  const code = Math.floor(100000 + Math.random() * 900000).toString();
                  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                  const { error } = await supabase.from("patient_portal_tokens").insert({
                    patient_id: id,
                    otp_code: code,
                    phone: patient.phone,
                    expires_at: expiresAt,
                  });
                  if (error) {
                    toast.error("Failed to generate OTP");
                    return;
                  }
                  setOtpCode(code);
                  toast.success("Portal access code generated!");
                }}
              >
                <Share2 className="h-3.5 w-3.5" /> Portal
              </Button>
              <Badge className={`h-8 ${patient.status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {patient.status}
              </Badge>
            </div>
          </div>
        </motion.div>
      </div>

      {/* OTP Code Display */}
      {otpCode && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/5 border border-primary/20 rounded-xl p-3 md:p-4 mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">Portal Access Code</p>
            <p className="text-xl md:text-2xl font-mono font-bold tracking-widest mt-1">{otpCode}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              Portal: <span className="font-medium">{window.location.origin}/portal</span>
            </p>
            <p className="text-xs text-muted-foreground">Expires in 24 hours</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(`Access your DermaCare portal: ${window.location.origin}/portal\nPhone: ${patient.phone}\nAccess Code: ${otpCode}`);
              setOtpCopied(true);
              toast.success("Copied to clipboard!");
              setTimeout(() => setOtpCopied(false), 2000);
            }}
          >
            {otpCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {otpCopied ? "Copied" : "Copy"}
          </Button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <Patient360 patientId={id!} patientName={`${patient.first_name} ${patient.last_name}`} />
        </div>
        <FamilySummaryCard patientId={id!} />
      </div>

      <div className="mb-4">
        <CaseAnalysis patientId={id!} patientName={`${patient.first_name} ${patient.last_name}`} />
      </div>

      <Tabs defaultValue="procedures" className="mt-2">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="procedures" className="gap-1 text-xs md:text-sm"><ClipboardList className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Procedures</span> ({procedures.length})</TabsTrigger>
            <TabsTrigger value="prescriptions" className="gap-1 text-xs md:text-sm"><Pill className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Rx</span> ({prescriptions.length})</TabsTrigger>
            <TabsTrigger value="appointments" className="gap-1 text-xs md:text-sm"><Calendar className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Appts</span> ({appointments.length})</TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1 text-xs md:text-sm"><Receipt className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Invoices</span> ({invoices.length})</TabsTrigger>
            <TabsTrigger value="photos" className="gap-1 text-xs md:text-sm"><Camera className="h-3.5 w-3.5" /> ({photos.length})</TabsTrigger>
            <TabsTrigger value="family" className="gap-1 text-xs md:text-sm"><Users className="h-3.5 w-3.5" /> Family</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="procedures">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-3 md:space-y-0">
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {procedures.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No procedures recorded</div>
              ) : procedures.map((proc: any) => (
                <div key={proc.id} className="stat-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{proc.service_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {proc.staff ? `Dr. ${proc.staff.first_name} ${proc.staff.last_name}` : "—"}
                      </p>
                      {proc.diagnosis && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{proc.diagnosis}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="text-xs">{proc.status}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(proc.procedure_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block data-table">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Service</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Doctor</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Diagnosis</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {procedures.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No procedures recorded</td></tr>
                  ) : procedures.map((proc: any) => (
                    <tr key={proc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm">{new Date(proc.procedure_date).toLocaleDateString()}</td>
                      <td className="p-4 font-medium text-sm">{proc.service_name}</td>
                      <td className="p-4 text-sm text-muted-foreground">{proc.staff ? `Dr. ${proc.staff.first_name} ${proc.staff.last_name}` : "—"}</td>
                      <td className="p-4 text-sm text-muted-foreground truncate max-w-[200px]">{proc.diagnosis || "—"}</td>
                      <td className="p-4"><Badge variant="secondary" className="text-xs">{proc.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="prescriptions">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 mt-4">
            {prescriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No prescriptions found</div>
            ) : prescriptions.map((rx: any) => (
              <div key={rx.id} className="stat-card p-3 md:p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                  <div className="min-w-0">
                    <p className="font-medium">{rx.medicine_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                      {rx.quantity > 1 && ` · Qty: ${rx.quantity}`}
                    </p>
                    {rx.instructions && <p className="text-xs text-muted-foreground italic mt-1">{rx.instructions}</p>}
                  </div>
                  {rx.procedures && (
                    <div className="text-left sm:text-right text-xs text-muted-foreground shrink-0">
                      <p>{rx.procedures.service_name}</p>
                      <p>{new Date(rx.procedures.procedure_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        </TabsContent>

        <TabsContent value="appointments">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <div className="md:hidden space-y-3">
              {appointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No appointments found</div>
              ) : appointments.map((apt: any) => (
                <div key={apt.id} className="stat-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{apt.service}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{apt.staff ? `Dr. ${apt.staff.first_name} ${apt.staff.last_name}` : "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="text-xs">{apt.status}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(apt.start_time).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">{new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block data-table">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Date & Time</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Service</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Doctor</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No appointments found</td></tr>
                  ) : appointments.map((apt: any) => (
                    <tr key={apt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm">
                        <p>{new Date(apt.start_time).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">{new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="p-4 font-medium text-sm">{apt.service}</td>
                      <td className="p-4 text-sm text-muted-foreground">{apt.staff ? `Dr. ${apt.staff.first_name} ${apt.staff.last_name}` : "—"}</td>
                      <td className="p-4"><Badge variant="secondary" className="text-xs">{apt.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="invoices">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <div className="md:hidden space-y-3">
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No invoices found</div>
              ) : invoices.map((inv: any) => (
                <div key={inv.id} className="stat-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(inv.created_at).toLocaleDateString()}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(inv.services || []).slice(0, 2).map((s: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                        {(inv.services || []).length > 2 && <Badge variant="secondary" className="text-[10px]">+{inv.services.length - 2}</Badge>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">₹{Number(inv.total_amount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Paid: ₹{Number(inv.paid_amount).toLocaleString()}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${statusStyles[inv.status] || ""}`}>{inv.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block data-table">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Invoice #</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Services</th>
                    <th className="text-right text-xs font-medium text-muted-foreground p-4">Amount</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No invoices found</td></tr>
                  ) : invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium text-sm">{inv.invoice_number}</td>
                      <td className="p-4 text-sm">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {(inv.services || []).map((s: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <p className="font-semibold text-sm">₹{Number(inv.total_amount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Paid: ₹{Number(inv.paid_amount).toLocaleString()}</p>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[inv.status] || ""}`}>{inv.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="photos">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            {photos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Camera className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No photos yet. Take a photo to start documenting.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {photos.map((photo: any) => (
                  <div key={photo.id} className="stat-card p-0 overflow-hidden">
                    <div className="relative">
                      <img src={photo.photo_url} alt="" className="w-full h-32 md:h-40 object-cover" loading="lazy" />
                      <Badge className={`absolute top-2 left-2 text-[10px] ${photo.photo_type === "before" ? "bg-warning/90 text-warning-foreground" : "bg-success/90 text-success-foreground"}`}>
                        {photo.photo_type.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="p-2 md:p-3">
                      {photo.procedures?.service_name && <p className="text-xs text-muted-foreground truncate">{photo.procedures.service_name}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(photo.taken_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="family">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <FamilyMembers patientId={id!} patientName={`${patient.first_name} ${patient.last_name}`} />
          </motion.div>
        </TabsContent>
      </Tabs>

      <CameraCapture
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        patientId={id!}
        patientName={`${patient.first_name} ${patient.last_name}`}
        context="patient"
      />

      <SkinTracker
        open={skinTrackerOpen}
        onOpenChange={setSkinTrackerOpen}
        photos={photos}
        patientName={`${patient.first_name} ${patient.last_name}`}
      />
    </div>
  );
};

export default PatientDetail;
