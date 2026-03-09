import { useState } from "react";
import { Plus, Pill } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PrescriptionInput {
  product_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
}

interface ProcedureFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPatientId?: string;
  defaultAppointmentId?: string;
  defaultStaffId?: string | null;
  defaultServiceName?: string;
}

export function ProcedureFormDialog({
  open, onOpenChange,
  defaultPatientId, defaultAppointmentId, defaultStaffId, defaultServiceName,
}: ProcedureFormDialogProps) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState(defaultPatientId || "");
  const [staffId, setStaffId] = useState(defaultStaffId || "");
  const [appointmentId] = useState(defaultAppointmentId || "");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState(defaultServiceName || "");
  const [diagnosis, setDiagnosis] = useState("");
  const [procedureNotes, setProcedureNotes] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionInput[]>([]);

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

  const { data: services = [] } = useQuery({
    queryKey: ["services-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name, diagnosis, procedure_notes, recommendations").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pharma-products-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharma_products").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // When a service is selected, auto-fill diagnosis, notes, recommendations
  const handleServiceSelect = async (svcId: string) => {
    setServiceId(svcId);
    const svc = services.find((s: any) => s.id === svcId);
    if (svc) {
      setServiceName((svc as any).name);
      if ((svc as any).diagnosis) setDiagnosis((svc as any).diagnosis);
      if ((svc as any).procedure_notes) setProcedureNotes((svc as any).procedure_notes);
      if ((svc as any).recommendations) {
        setRecommendations(((svc as any).recommendations as string[]).join("\n"));
      }
      // Load service medicines as prescriptions
      const { data: meds } = await supabase
        .from("service_medicines")
        .select("*, pharma_products(name)")
        .eq("service_id", svcId);
      if (meds && meds.length > 0) {
        setPrescriptions(meds.map((m: any) => ({
          product_id: m.product_id,
          medicine_name: m.pharma_products?.name || "",
          dosage: "",
          frequency: m.frequency || "",
          duration: m.duration || "",
          instructions: m.instructions || "",
          quantity: 1,
        })));
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: proc, error } = await supabase
        .from("procedures")
        .insert({
          patient_id: patientId,
          staff_id: staffId || null,
          appointment_id: appointmentId || null,
          service_name: serviceName || "Consultation",
          diagnosis,
          procedure_notes: procedureNotes,
          recommendations: recommendations || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (prescriptions.length > 0) {
        const rxRows = prescriptions
          .filter((rx) => rx.medicine_name || rx.product_id)
          .map((rx) => ({
            procedure_id: proc.id,
            product_id: rx.product_id || null,
            medicine_name: rx.medicine_name,
            dosage: rx.dosage,
            frequency: rx.frequency,
            duration: rx.duration,
            instructions: rx.instructions,
            quantity: rx.quantity,
          }));
        if (rxRows.length > 0) {
          const { error: rxErr } = await supabase.from("prescriptions").insert(rxRows);
          if (rxErr) throw rxErr;
        }
      }
      return proc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-procedures"] });
      toast.success("Procedure created successfully");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addPrescription = () => {
    setPrescriptions([...prescriptions, { product_id: "", medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "", quantity: 1 }]);
  };

  const updatePrescription = (index: number, field: keyof PrescriptionInput, value: string | number) => {
    const updated = [...prescriptions];
    if (field === "product_id") {
      const prod = products.find((p) => p.id === value);
      updated[index].product_id = value as string;
      updated[index].medicine_name = prod?.name || "";
    } else {
      (updated[index] as any)[field] = value;
    }
    setPrescriptions(updated);
  };

  const removePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const isFromAppointment = !!defaultAppointmentId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">New Procedure / Consultation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Patient *</Label>
              <Select value={patientId} onValueChange={setPatientId} disabled={isFromAppointment}>
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

          <div>
            <Label>Service / Procedure Name</Label>
            <Select value={serviceId} onValueChange={handleServiceSelect}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select service (optional)" /></SelectTrigger>
              <SelectContent>
                {services.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label>Recommendations</Label>
            <Textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} placeholder="Post-procedure recommendations..." className="mt-1.5" rows={3} />
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
                  <Select value={rx.product_id} onValueChange={(v) => updatePrescription(i, "product_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select medicine *" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!patientId || createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Save Procedure"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
