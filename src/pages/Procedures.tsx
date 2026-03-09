import { useState } from "react";
import { Plus, Search, FileText, Pill, Eye, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CameraCapture } from "@/components/shared/CameraCapture";
interface PrescriptionInput {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
}

const Procedures = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [cameraProc, setCameraProc] = useState<any>(null);

  // Form state
  const [patientId, setPatientId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [procedureNotes, setProcedureNotes] = useState("");
  const [consultationNotes, setConsultationNotes] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionInput[]>([]);

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ["procedures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedures")
        .select("*, patients(first_name, last_name), staff(first_name, last_name)")
        .order("procedure_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("id, first_name, last_name").order("first_name");
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

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("id, patient_name, service, start_time").order("start_time", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: pharmaProducts = [] } = useQuery({
    queryKey: ["pharma-products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharma_products").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // View procedure with prescriptions
  const { data: viewProcedure } = useQuery({
    queryKey: ["procedure-detail", viewId],
    queryFn: async () => {
      if (!viewId) return null;
      const { data, error } = await supabase
        .from("procedures")
        .select("*, patients(first_name, last_name), staff(first_name, last_name)")
        .eq("id", viewId)
        .single();
      if (error) throw error;
      const { data: rxData } = await supabase.from("prescriptions").select("*").eq("procedure_id", viewId);
      return { ...data, prescriptions: rxData || [] };
    },
    enabled: !!viewId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: proc, error } = await supabase
        .from("procedures")
        .insert({
          patient_id: patientId,
          staff_id: staffId || null,
          appointment_id: appointmentId || null,
          service_name: serviceName,
          diagnosis,
          procedure_notes: procedureNotes,
          consultation_notes: consultationNotes,
        })
        .select()
        .single();
      if (error) throw error;

      if (prescriptions.length > 0) {
        const rxRows = prescriptions.map((rx) => ({
          procedure_id: proc.id,
          medicine_name: rx.medicine_name,
          dosage: rx.dosage,
          frequency: rx.frequency,
          duration: rx.duration,
          instructions: rx.instructions,
          quantity: rx.quantity,
        }));
        const { error: rxErr } = await supabase.from("prescriptions").insert(rxRows);
        if (rxErr) throw rxErr;
      }
      return proc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      toast.success("Procedure created successfully");
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setPatientId("");
    setStaffId("");
    setAppointmentId("");
    setServiceName("");
    setDiagnosis("");
    setProcedureNotes("");
    setConsultationNotes("");
    setPrescriptions([]);
  };

  const addPrescription = () => {
    setPrescriptions([...prescriptions, { medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "", quantity: 1 }]);
  };

  const updatePrescription = (index: number, field: keyof PrescriptionInput, value: string | number) => {
    const updated = [...prescriptions];
    (updated[index] as any)[field] = value;
    setPrescriptions(updated);
  };

  const removePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const filtered = procedures.filter((p: any) => {
    const name = `${p.patients?.first_name || ""} ${p.patients?.last_name || ""}`.toLowerCase();
    return name.includes(search.toLowerCase()) || p.service_name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Procedures</h1>
          <p className="page-subtitle">Record consultations, procedures & prescriptions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-fit">
              <Plus className="h-4 w-4" />
              New Procedure
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">New Procedure / Consultation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Patient *</Label>
                  <Select value={patientId} onValueChange={setPatientId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Doctor / Staff</Label>
                  <Select value={staffId} onValueChange={setStaffId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                    <SelectContent>
                      {staffList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>Dr. {s.first_name} {s.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Linked Appointment</Label>
                  <Select value={appointmentId} onValueChange={setAppointmentId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      {appointments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.patient_name} - {a.service}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Service / Procedure Name *</Label>
                  <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="e.g. Chemical Peel" className="mt-1.5" />
                </div>
              </div>

              <div>
                <Label>Diagnosis</Label>
                <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Patient diagnosis..." className="mt-1.5" rows={2} />
              </div>

              <div>
                <Label>Procedure Notes</Label>
                <Textarea value={procedureNotes} onChange={(e) => setProcedureNotes(e.target.value)} placeholder="Details of the procedure performed..." className="mt-1.5" rows={3} />
              </div>

              <div>
                <Label>Consultation Notes</Label>
                <Textarea value={consultationNotes} onChange={(e) => setConsultationNotes(e.target.value)} placeholder="Consultation observations, advice..." className="mt-1.5" rows={3} />
              </div>

              {/* Prescriptions */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-display font-semibold flex items-center gap-2">
                    <Pill className="h-4 w-4" /> Prescriptions
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPrescription}>
                    <Plus className="h-3 w-3 mr-1" /> Add Medicine
                  </Button>
                </div>
                {prescriptions.map((rx, i) => (
                  <div key={i} className="border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Medicine {i + 1}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => removePrescription(i)}>Remove</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Medicine name *" value={rx.medicine_name} onChange={(e) => updatePrescription(i, "medicine_name", e.target.value)} />
                      <Input placeholder="Dosage (e.g. 500mg)" value={rx.dosage} onChange={(e) => updatePrescription(i, "dosage", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Frequency" value={rx.frequency} onChange={(e) => updatePrescription(i, "frequency", e.target.value)} />
                      <Input placeholder="Duration" value={rx.duration} onChange={(e) => updatePrescription(i, "duration", e.target.value)} />
                      <Input type="number" placeholder="Qty" value={rx.quantity} onChange={(e) => updatePrescription(i, "quantity", parseInt(e.target.value) || 1)} />
                    </div>
                    <Input placeholder="Special instructions" value={rx.instructions} onChange={(e) => updatePrescription(i, "instructions", e.target.value)} />
                  </div>
                ))}
              </div>

              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!patientId || !serviceName || createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save Procedure"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by patient or service..." className="pl-9 bg-card border" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="data-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No procedures found</TableCell></TableRow>
            ) : (
              filtered.map((proc: any) => (
                <TableRow key={proc.id}>
                  <TableCell className="text-sm">{new Date(proc.procedure_date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{proc.patients?.first_name} {proc.patients?.last_name}</TableCell>
                  <TableCell>{proc.service_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {proc.staff ? `Dr. ${proc.staff.first_name} ${proc.staff.last_name}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{proc.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Dialog open={viewId === proc.id} onOpenChange={(o) => setViewId(o ? proc.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="font-display">Procedure Details</DialogTitle>
                        </DialogHeader>
                        {viewProcedure && (
                          <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                              <div><span className="text-muted-foreground">Patient:</span> <span className="font-medium">{viewProcedure.patients?.first_name} {viewProcedure.patients?.last_name}</span></div>
                              <div><span className="text-muted-foreground">Doctor:</span> <span className="font-medium">{viewProcedure.staff ? `Dr. ${viewProcedure.staff.first_name}` : "—"}</span></div>
                              <div><span className="text-muted-foreground">Service:</span> <span className="font-medium">{viewProcedure.service_name}</span></div>
                              <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{new Date(viewProcedure.procedure_date).toLocaleDateString()}</span></div>
                            </div>
                            {viewProcedure.diagnosis && <div><p className="text-muted-foreground mb-1">Diagnosis</p><p className="bg-muted/50 rounded-md p-3">{viewProcedure.diagnosis}</p></div>}
                            {viewProcedure.procedure_notes && <div><p className="text-muted-foreground mb-1">Procedure Notes</p><p className="bg-muted/50 rounded-md p-3">{viewProcedure.procedure_notes}</p></div>}
                            {viewProcedure.consultation_notes && <div><p className="text-muted-foreground mb-1">Consultation Notes</p><p className="bg-muted/50 rounded-md p-3">{viewProcedure.consultation_notes}</p></div>}
                            {viewProcedure.prescriptions?.length > 0 && (
                              <div>
                                <p className="text-muted-foreground mb-2 flex items-center gap-1"><Pill className="h-3.5 w-3.5" /> Prescriptions</p>
                                <div className="space-y-2">
                                  {viewProcedure.prescriptions.map((rx: any) => (
                                    <div key={rx.id} className="bg-muted/50 rounded-md p-3">
                                      <p className="font-medium">{rx.medicine_name}</p>
                                      <p className="text-muted-foreground text-xs mt-0.5">
                                        {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                                        {rx.quantity > 1 && ` · Qty: ${rx.quantity}`}
                                      </p>
                                      {rx.instructions && <p className="text-xs mt-1 text-muted-foreground italic">{rx.instructions}</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
};

export default Procedures;
