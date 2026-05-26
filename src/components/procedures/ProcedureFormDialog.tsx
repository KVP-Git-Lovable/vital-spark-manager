import { useState, useEffect, useRef } from "react";
import { Plus, Pill, Wrench, Check, Sparkles, Loader2, Mic, MicOff } from "lucide-react";
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { StaffCombobox } from "@/components/shared/StaffCombobox";
import { PatientCombobox } from "@/components/patients/PatientCombobox";
import { fetchAll } from "@/lib/supabasePaginate";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { MicButton } from "@/components/shared/MicButton";

interface PrescriptionInput {
  product_id: string;
  medicine_name: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
}

interface StockInfo {
  available: number;
  loading: boolean;
}

interface AssetInput {
  asset_id: string;
  asset_name: string;
  usage_guideline: string;
  time_taken: string;
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
  const [assistedBy, setAssistedBy] = useState("");
  const [selectedProblemAreas, setSelectedProblemAreas] = useState<string[]>([]);
  const [appointmentId] = useState(defaultAppointmentId || "");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState(defaultServiceName || "");
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [procedureNotes, setProcedureNotes] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionInput[]>([]);
  const [stockMap, setStockMap] = useState<Record<number, StockInfo>>({});
  const [procedureAssets, setProcedureAssets] = useState<AssetInput[]>([]);
  const [autoFilled, setAutoFilled] = useState(false);
  const [elaborating, setElaborating] = useState<null | "symptoms" | "diagnosis" | "procedure_notes" | "recommendations">(null);

  const elaborate = async (fieldType: "symptoms" | "diagnosis" | "procedure_notes" | "recommendations") => {
    const svcName = serviceName.trim() || "Consultation";
    const currentText = fieldType === "symptoms" ? symptoms : fieldType === "diagnosis" ? diagnosis : fieldType === "procedure_notes" ? procedureNotes : recommendations;
    setElaborating(fieldType);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elaborate-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ serviceName: svcName, fieldType, currentText }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: "AI request failed" })); throw new Error(err.error || "AI request failed"); }
      const { text } = await res.json();
      if (fieldType === "symptoms") setSymptoms(text);
      else if (fieldType === "diagnosis") setDiagnosis(text);
      else if (fieldType === "procedure_notes") setProcedureNotes(text);
      else setRecommendations(text);
      toast.success("Text elaborated");
    } catch (e: any) { toast.error(e.message || "Failed to elaborate"); }
    finally { setElaborating(null); }
  };

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list"],
    queryFn: async () => {
      return await fetchAll<any>((from, to) =>
        supabase
          .from("patients")
          .select("id, first_name, last_name")
          .order("first_name")
          .range(from, to)
      );
    },
  });

  const { data: problemAreas = [] } = useQuery({
    queryKey: ["problem-areas-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("problem_areas").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });


  const { data: services = [] } = useQuery({
    queryKey: ["services-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name, symptoms, diagnosis, procedure_notes, recommendations").order("name");
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

  const { data: allAssets = [] } = useQuery({
    queryKey: ["assets-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("id, name").eq("status", "Active").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Auto-fill from service master
  const applyServiceData = async (svc: any, svcId: string) => {
    setServiceId(svcId);
    setServiceName(svc.name);
    if (svc.symptoms) setSymptoms(svc.symptoms);
    if (svc.diagnosis) setDiagnosis(svc.diagnosis);
    if (svc.procedure_notes) setProcedureNotes(svc.procedure_notes);
    if (svc.recommendations) {
      setRecommendations((svc.recommendations as string[]).join("\n"));
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
    // Load service assets
    const { data: assetLinksData } = await supabase
      .from("asset_service_links")
      .select("*, assets(name)")
      .eq("service_id", svcId);
    if (assetLinksData && assetLinksData.length > 0) {
      setProcedureAssets(assetLinksData.map((a: any) => ({
        asset_id: a.asset_id,
        asset_name: a.assets?.name || "",
        usage_guideline: a.usage_guideline || "",
        time_taken: a.time_taken ? String(a.time_taken) : "",
      })));
    } else {
      setProcedureAssets([]);
    }
    setAutoFilled(true);
    toast.info("Fields auto-filled from Service Master — you can edit them.");
  };

  // When a service is selected from dropdown
  const handleServiceSelect = async (svcId: string) => {
    const svc = services.find((s: any) => s.id === svcId);
    if (svc) await applyServiceData(svc, svcId);
  };

  // Auto-match defaultServiceName on first load
  if (defaultServiceName && services.length > 0 && !autoFilled && !serviceId) {
    const match = services.find((s: any) => s.name === defaultServiceName);
    if (match) {
      applyServiceData(match, match.id);
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      // Warn about zero stock for prescribed medicines (don't block)
      for (const rx of prescriptions) {
        if (!rx.product_id) continue;
        const { data: invData } = await supabase.from("pharma_inventory").select("quantity").eq("product_id", rx.product_id);
        const { data: rxData } = await supabase.from("prescriptions").select("quantity").eq("product_id", rx.product_id);
        const totalStock = (invData || []).reduce((s, i) => s + Number(i.quantity), 0);
        const consumed = (rxData || []).reduce((s, i) => s + Number(i.quantity), 0);
        if (Math.max(0, totalStock - consumed) === 0) {
          toast.warning(`Insufficient stock for ${rx.medicine_name}. Please add stock.`);
        }
      }

      const { data: proc, error } = await supabase
        .from("procedures")
        .insert({
          patient_id: patientId,
          staff_id: staffId || null,
          assisted_by: assistedBy || null,
          appointment_id: appointmentId || null,
          service_name: serviceName || "Consultation",
          symptoms: symptoms || null,
          diagnosis,
          procedure_notes: procedureNotes,
          recommendations: recommendations || null,
        } as any)
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
            dosage: "",
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
    setPrescriptions([...prescriptions, { product_id: "", medicine_name: "", frequency: "", duration: "", instructions: "", quantity: 1 }]);
  };

  const fetchStock = async (productId: string, index: number) => {
    setStockMap((prev) => ({ ...prev, [index]: { available: 0, loading: true } }));
    const [{ data: invData }, { data: billData }] = await Promise.all([
      supabase.from("pharma_inventory").select("quantity").eq("product_id", productId),
      supabase.from("pharma_bill_items").select("quantity").eq("product_id", productId),
    ]);
    const totalStock = (invData || []).reduce((s, i) => s + Number(i.quantity), 0);
    const consumed = (billData || []).reduce((s, i) => s + Number(i.quantity), 0);
    setStockMap((prev) => ({ ...prev, [index]: { available: Math.max(0, totalStock - consumed), loading: false } }));
  };

  const updatePrescription = (index: number, field: keyof PrescriptionInput, value: string | number) => {
    const updated = [...prescriptions];
    if (field === "product_id") {
      const prod = products.find((p) => p.id === value);
      updated[index].product_id = value as string;
      updated[index].medicine_name = prod?.name || "";
      fetchStock(value as string, index);
    } else {
      (updated[index] as any)[field] = value;
    }
    setPrescriptions(updated);
  };

  const removePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const addAsset = () => setProcedureAssets([...procedureAssets, { asset_id: "", asset_name: "", usage_guideline: "", time_taken: "" }]);
  const updateAsset = (index: number, field: keyof AssetInput, value: string) => {
    const updated = [...procedureAssets];
    (updated[index] as any)[field] = value;
    if (field === "asset_id") { updated[index].asset_name = allAssets.find((a) => a.id === value)?.name || ""; }
    setProcedureAssets(updated);
  };
  const removeAsset = (index: number) => setProcedureAssets(procedureAssets.filter((_, i) => i !== index));

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
              <PatientCombobox
                value={patientId}
                onValueChange={setPatientId}
                placeholder="Select patient"
                className="mt-1.5"
                disabled={isFromAppointment}
              />
            </div>
            <div>
              <Label>Doctor</Label>
              <StaffCombobox value={staffId} onValueChange={setStaffId} placeholder="Select doctor" className="mt-1.5" />
            </div>
            <div>
              <Label>Assisted By</Label>
              <StaffCombobox value={assistedBy} onValueChange={setAssistedBy} placeholder="Select assistant" allowNone noneLabel="No assistant" className="mt-1.5" />
            </div>
            <div>
              <Label>Problem Areas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1.5 justify-start font-normal h-10">
                    {selectedProblemAreas.length === 0
                      ? <span className="text-muted-foreground">Select problem areas</span>
                      : <span className="truncate">{selectedProblemAreas.map(id => problemAreas.find(pa => pa.id === id)?.name).filter(Boolean).join(", ")}</span>
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                      <CommandEmpty>No problem areas found</CommandEmpty>
                      <CommandGroup>
                        {problemAreas.map((pa) => (
                          <CommandItem
                            key={pa.id}
                            onSelect={() => {
                              setSelectedProblemAreas(prev =>
                                prev.includes(pa.id) ? prev.filter(id => id !== pa.id) : [...prev, pa.id]
                              );
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedProblemAreas.includes(pa.id) ? "opacity-100" : "opacity-0"}`} />
                            {pa.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
            <div className="flex items-center justify-between">
              <Label>Symptoms</Label>
              <div className="flex items-center gap-1">
                <MicButton value={symptoms} onChange={setSymptoms} />
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("symptoms")} disabled={elaborating !== null}>
                  {elaborating === "symptoms" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Elaborate AI
                </Button>
              </div>
            </div>
            <Textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g. Redness, itching, dry patches..." className="mt-1.5" rows={2} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Diagnosis</Label>
              <div className="flex items-center gap-1">
                <MicButton value={diagnosis} onChange={setDiagnosis} />
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("diagnosis")} disabled={elaborating !== null}>
                  {elaborating === "diagnosis" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Elaborate AI
                </Button>
              </div>
            </div>
            <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Patient diagnosis..." className="mt-1.5" rows={2} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Procedure Notes</Label>
              <div className="flex items-center gap-1">
                <MicButton value={procedureNotes} onChange={setProcedureNotes} />
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("procedure_notes")} disabled={elaborating !== null}>
                  {elaborating === "procedure_notes" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Elaborate AI
                </Button>
              </div>
            </div>
            <Textarea value={procedureNotes} onChange={(e) => setProcedureNotes(e.target.value)} placeholder="Details of the procedure performed..." className="mt-1.5" rows={3} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Recommendations</Label>
              <div className="flex items-center gap-1">
                <MicButton value={recommendations} onChange={setRecommendations} />
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("recommendations")} disabled={elaborating !== null}>
                  {elaborating === "recommendations" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Elaborate AI
                </Button>
              </div>
            </div>
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
                <div>
                  <Select value={rx.product_id} onValueChange={(v) => updatePrescription(i, "product_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select medicine *" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {rx.product_id && stockMap[i] && (
                    stockMap[i].loading ? (
                      <p className="text-xs text-muted-foreground mt-1">Checking stock...</p>
                    ) : stockMap[i].available <= 0 ? (
                      <p className="text-xs text-amber-600 mt-1">⚠️ This medicine is currently out of stock</p>
                    ) : (
                      <p className="text-xs text-green-600 mt-1">Available stock: {stockMap[i].available} units</p>
                    )
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <Input placeholder="Frequency" value={rx.frequency} onChange={(e) => updatePrescription(i, "frequency", e.target.value)} className="pr-9" />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <MicButton value={rx.frequency} onChange={(v) => updatePrescription(i, "frequency", v)} mode="replace" />
                    </div>
                  </div>
                  <div className="relative">
                    <Input placeholder="Duration" value={rx.duration} onChange={(e) => updatePrescription(i, "duration", e.target.value)} className="pr-9" />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <MicButton value={rx.duration} onChange={(v) => updatePrescription(i, "duration", v)} mode="replace" />
                    </div>
                  </div>
                  <Input type="number" placeholder="Qty" value={rx.quantity} onChange={(e) => updatePrescription(i, "quantity", parseInt(e.target.value) || 1)} />
                </div>
                <div className="relative">
                  <Input placeholder="Special instructions" value={rx.instructions} onChange={(e) => updatePrescription(i, "instructions", e.target.value)} className="pr-9" />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <MicButton value={rx.instructions} onChange={(v) => updatePrescription(i, "instructions", v)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Required Assets */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-display font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Required Assets
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addAsset}>
                <Plus className="h-3 w-3 mr-1" /> Add Asset
              </Button>
            </div>
            {procedureAssets.length === 0 && (
              <p className="text-xs text-muted-foreground mb-2">No assets linked. Select a service to auto-populate or add manually.</p>
            )}
            {procedureAssets.map((asset, i) => (
              <div key={i} className="border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Asset {i + 1}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => removeAsset(i)}>Remove</Button>
                </div>
                <Select value={asset.asset_id} onValueChange={(v) => updateAsset(i, "asset_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                  <SelectContent>
                    {allAssets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Usage guideline" value={asset.usage_guideline} onChange={(e) => updateAsset(i, "usage_guideline", e.target.value)} />
                  <Input type="number" placeholder="Time taken (mins)" value={asset.time_taken} onChange={(e) => updateAsset(i, "time_taken", e.target.value)} />
                </div>
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
