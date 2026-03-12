import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Calendar, ClipboardList, Pill, Receipt, User, Loader2, Share2, Copy, Check, ScanEye, FileText, Users, Plus, Save, Edit2, Info } from "lucide-react";
import { EngagementScoreCard } from "@/components/patients/EngagementScoreCard";
import { Patient360 } from "@/components/patients/Patient360";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [detailsEditing, setDetailsEditing] = useState(false);
  const [detailsForm, setDetailsForm] = useState<any>(null);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [addRxOpen, setAddRxOpen] = useState(false);
  const [rxForm, setRxForm] = useState({ medicine_name: "", dosage: "", frequency: "", duration: "", quantity: 1, instructions: "", procedure_id: "" });
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

      <div className="space-y-4 mb-4">
        <EngagementScoreCard patientId={id!} />
        <FamilySummaryCard patientId={id!} />
      </div>

      <Tabs defaultValue="details" className="mt-2">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="details" className="gap-1 text-xs md:text-sm"><Info className="h-3.5 w-3.5" /> Details</TabsTrigger>
            <TabsTrigger value="procedures" className="gap-1 text-xs md:text-sm"><ClipboardList className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Procedures</span> ({procedures.length})</TabsTrigger>
            <TabsTrigger value="prescriptions" className="gap-1 text-xs md:text-sm"><Pill className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Rx</span> ({prescriptions.length})</TabsTrigger>
            <TabsTrigger value="appointments" className="gap-1 text-xs md:text-sm"><Calendar className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Appts</span> ({appointments.length})</TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1 text-xs md:text-sm"><Receipt className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Invoices</span> ({invoices.length})</TabsTrigger>
            <TabsTrigger value="photos" className="gap-1 text-xs md:text-sm"><Camera className="h-3.5 w-3.5" /> ({photos.length})</TabsTrigger>
            <TabsTrigger value="family" className="gap-1 text-xs md:text-sm"><Users className="h-3.5 w-3.5" /> Family</TabsTrigger>
          </TabsList>
        </div>

        {/* Details Tab */}
        <TabsContent value="details">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <div className="flex justify-end mb-3">
              {detailsEditing ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setDetailsEditing(false); setDetailsForm(null); }}>Cancel</Button>
                  <Button size="sm" className="gap-1.5 h-8 text-xs" disabled={detailsSaving} onClick={async () => {
                    if (!detailsForm) return;
                    setDetailsSaving(true);
                    try {
                      const { error } = await supabase.from("patients").update(detailsForm).eq("id", id!);
                      if (error) throw error;
                      toast.success("Patient details updated");
                      queryClient.invalidateQueries({ queryKey: ["patient", id] });
                      setDetailsEditing(false);
                      setDetailsForm(null);
                    } catch (err: any) {
                      toast.error(err.message);
                    } finally {
                      setDetailsSaving(false);
                    }
                  }}>
                    <Save className="h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => {
                  setDetailsEditing(true);
                  setDetailsForm({
                    first_name: patient.first_name, last_name: patient.last_name, date_of_birth: patient.date_of_birth,
                    gender: patient.gender, phone: patient.phone, email: patient.email, address: patient.address,
                    city: patient.city, state: patient.state, pincode: patient.pincode,
                    emergency_contact_name: patient.emergency_contact_name, emergency_contact_phone: patient.emergency_contact_phone,
                    blood_group: patient.blood_group, medical_history: patient.medical_history,
                    current_medications: patient.current_medications, allergies: patient.allergies,
                    skin_type: patient.skin_type, skin_concerns: patient.skin_concerns,
                    previous_treatments: patient.previous_treatments, notes: patient.notes, status: patient.status,
                    source: patient.source, source_ad_details: patient.source_ad_details,
                    source_referral_doctor: patient.source_referral_doctor,
                    facebook_url: patient.facebook_url, instagram_url: patient.instagram_url,
                    follows_facebook: patient.follows_facebook, follows_instagram: patient.follows_instagram,
                  });
                }}>
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
            {(() => {
              const d = detailsEditing ? detailsForm : patient;
              const upd = (field: string, value: any) => setDetailsForm((prev: any) => ({ ...prev, [field]: value || null }));
              const readOnly = !detailsEditing;

              const SectionTitle = ({ children }: { children: React.ReactNode }) => (
                <h3 className="text-sm font-semibold text-foreground border-b pb-1.5 mb-3">{children}</h3>
              );

              const Field = ({ label, value, field, type = "text" }: { label: string; value: any; field: string; type?: string }) => (
                <div>
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  {readOnly ? (
                    <p className="text-sm mt-1">{value || <span className="text-muted-foreground/50">—</span>}</p>
                  ) : (
                    <Input type={type} value={value || ""} onChange={(e) => upd(field, e.target.value)} className="mt-1 h-8 text-sm" />
                  )}
                </div>
              );

              const TextareaField = ({ label, value, field }: { label: string; value: any; field: string }) => (
                <div>
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  {readOnly ? (
                    <p className="text-sm mt-1 whitespace-pre-wrap">{value || <span className="text-muted-foreground/50">—</span>}</p>
                  ) : (
                    <Textarea value={value || ""} onChange={(e) => upd(field, e.target.value)} className="mt-1 text-sm" rows={3} />
                  )}
                </div>
              );

              return (
                <div className="space-y-6">
                  {/* Personal */}
                  <div className="stat-card p-4">
                    <SectionTitle>Personal Information</SectionTitle>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Field label="First Name" value={d.first_name} field="first_name" />
                      <Field label="Last Name" value={d.last_name} field="last_name" />
                      <Field label="Date of Birth" value={d.date_of_birth} field="date_of_birth" type="date" />
                      <div>
                        <Label className="text-xs text-muted-foreground">Gender</Label>
                        {readOnly ? (
                          <p className="text-sm mt-1">{d.gender || <span className="text-muted-foreground/50">—</span>}</p>
                        ) : (
                          <Select value={d.gender || ""} onValueChange={(v) => upd("gender", v)}>
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <Field label="Phone" value={d.phone} field="phone" />
                      <Field label="Email" value={d.email} field="email" type="email" />
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        {readOnly ? (
                          <p className="text-sm mt-1">{d.status}</p>
                        ) : (
                          <Select value={d.status || "Active"} onValueChange={(v) => upd("status", v)}>
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="stat-card p-4">
                    <SectionTitle>Address</SectionTitle>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3">
                        <TextareaField label="Address" value={d.address} field="address" />
                      </div>
                      <Field label="City" value={d.city} field="city" />
                      <Field label="State" value={d.state} field="state" />
                      <Field label="Pincode" value={d.pincode} field="pincode" />
                    </div>
                  </div>

                  {/* Emergency */}
                  <div className="stat-card p-4">
                    <SectionTitle>Emergency Contact</SectionTitle>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Contact Name" value={d.emergency_contact_name} field="emergency_contact_name" />
                      <Field label="Contact Phone" value={d.emergency_contact_phone} field="emergency_contact_phone" />
                    </div>
                  </div>

                  {/* Medical */}
                  <div className="stat-card p-4">
                    <SectionTitle>Medical Information</SectionTitle>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Blood Group</Label>
                        {readOnly ? (
                          <p className="text-sm mt-1">{d.blood_group || <span className="text-muted-foreground/50">—</span>}</p>
                        ) : (
                          <Select value={d.blood_group || ""} onValueChange={(v) => upd("blood_group", v)}>
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <TextareaField label="Medical History" value={d.medical_history} field="medical_history" />
                      <TextareaField label="Current Medications" value={d.current_medications} field="current_medications" />
                      <TextareaField label="Allergies" value={d.allergies} field="allergies" />
                    </div>
                  </div>

                  {/* Derma */}
                  <div className="stat-card p-4">
                    <SectionTitle>Dermatology</SectionTitle>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Skin Type</Label>
                        {readOnly ? (
                          <p className="text-sm mt-1">{d.skin_type || <span className="text-muted-foreground/50">—</span>}</p>
                        ) : (
                          <Select value={d.skin_type || ""} onValueChange={(v) => upd("skin_type", v)}>
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {["Normal", "Dry", "Oily", "Combination", "Sensitive"].map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <TextareaField label="Skin Concerns" value={d.skin_concerns} field="skin_concerns" />
                      <TextareaField label="Previous Treatments" value={d.previous_treatments} field="previous_treatments" />
                    </div>
                  </div>

                  {/* Source & Social */}
                  <div className="stat-card p-4">
                    <SectionTitle>Source & Social</SectionTitle>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Source</Label>
                        {readOnly ? (
                          <p className="text-sm mt-1">{d.source || <span className="text-muted-foreground/50">—</span>}</p>
                        ) : (
                          <Select value={d.source || "Walk-in"} onValueChange={(v) => upd("source", v)}>
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Walk-in">Walk-in</SelectItem>
                              <SelectItem value="Advertisement">Advertisement</SelectItem>
                              <SelectItem value="Other Dr. referral">Other Dr. referral</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {d.source === "Advertisement" && <Field label="Ad Details" value={d.source_ad_details} field="source_ad_details" />}
                      {d.source === "Other Dr. referral" && <Field label="Referring Doctor" value={d.source_referral_doctor} field="source_referral_doctor" />}
                      <Field label="Facebook URL" value={d.facebook_url} field="facebook_url" />
                      <Field label="Instagram URL" value={d.instagram_url} field="instagram_url" />
                      <div className="flex items-center gap-4 col-span-2">
                        <div className="flex items-center gap-2">
                          <Checkbox id="det-fb" checked={d.follows_facebook || false} disabled={readOnly} onCheckedChange={(c) => upd("follows_facebook", !!c)} />
                          <Label htmlFor="det-fb" className="text-xs">Follows Facebook</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id="det-ig" checked={d.follows_instagram || false} disabled={readOnly} onCheckedChange={(c) => upd("follows_instagram", !!c)} />
                          <Label htmlFor="det-ig" className="text-xs">Follows Instagram</Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="stat-card p-4">
                    <SectionTitle>Notes</SectionTitle>
                    <TextareaField label="Additional Notes" value={d.notes} field="notes" />
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </TabsContent>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-3 md:space-y-0">
            <div className="flex justify-end mb-3">
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setProcedureFormOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Procedure
              </Button>
            </div>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <div className="flex justify-end mb-3">
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddRxOpen(!addRxOpen)}>
                <Plus className="h-3.5 w-3.5" /> Add Medicine
              </Button>
            </div>
            {addRxOpen && (
              <div className="stat-card p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Procedure *</Label>
                    <Select value={rxForm.procedure_id} onValueChange={(v) => setRxForm(p => ({ ...p, procedure_id: v }))}>
                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select procedure" /></SelectTrigger>
                      <SelectContent>
                        {procedures.map((proc: any) => (
                          <SelectItem key={proc.id} value={proc.id}>{proc.service_name} — {new Date(proc.procedure_date).toLocaleDateString()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Medicine Name *</Label>
                    <Input value={rxForm.medicine_name} onChange={(e) => setRxForm(p => ({ ...p, medicine_name: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="Medicine name" />
                  </div>
                  <div>
                    <Label className="text-xs">Dosage</Label>
                    <Input value={rxForm.dosage} onChange={(e) => setRxForm(p => ({ ...p, dosage: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="e.g. 500mg" />
                  </div>
                  <div>
                    <Label className="text-xs">Frequency</Label>
                    <Input value={rxForm.frequency} onChange={(e) => setRxForm(p => ({ ...p, frequency: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="e.g. Twice daily" />
                  </div>
                  <div>
                    <Label className="text-xs">Duration</Label>
                    <Input value={rxForm.duration} onChange={(e) => setRxForm(p => ({ ...p, duration: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="e.g. 7 days" />
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input type="number" value={rxForm.quantity} onChange={(e) => setRxForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} className="mt-1 h-8 text-sm" />
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <Label className="text-xs">Instructions</Label>
                    <Input value={rxForm.instructions} onChange={(e) => setRxForm(p => ({ ...p, instructions: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="e.g. After meals" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddRxOpen(false)}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={async () => {
                    if (!rxForm.procedure_id || !rxForm.medicine_name.trim()) {
                      toast.error("Procedure and medicine name are required");
                      return;
                    }
                    const { error } = await supabase.from("prescriptions").insert({
                      procedure_id: rxForm.procedure_id,
                      medicine_name: rxForm.medicine_name,
                      dosage: rxForm.dosage || null,
                      frequency: rxForm.frequency || null,
                      duration: rxForm.duration || null,
                      quantity: rxForm.quantity,
                      instructions: rxForm.instructions || null,
                    });
                    if (error) { toast.error(error.message); return; }
                    toast.success("Medicine added");
                    setRxForm({ medicine_name: "", dosage: "", frequency: "", duration: "", quantity: 1, instructions: "", procedure_id: "" });
                    setAddRxOpen(false);
                    queryClient.invalidateQueries({ queryKey: ["patient-prescriptions", id] });
                  }}>Save</Button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {prescriptions.length === 0 && !addRxOpen ? (
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
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="appointments">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <div className="flex justify-end mb-3">
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => navigate("/appointments")}>
                <Plus className="h-3.5 w-3.5" /> Book Appointment
              </Button>
            </div>
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
            <div className="flex justify-end mb-3">
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => navigate("/billing")}>
                <Plus className="h-3.5 w-3.5" /> Create Invoice
              </Button>
            </div>
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
            <div className="flex justify-end mb-3">
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setCameraOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Take Photo
              </Button>
            </div>
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

      <ProcedureFormDialog
        open={procedureFormOpen}
        onOpenChange={setProcedureFormOpen}
        defaultPatientId={id}
      />
    </div>
  );
};

export default PatientDetail;
