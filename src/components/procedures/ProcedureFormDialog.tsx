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

  // Unified AI bar state
  const [dictation, setDictation] = useState("");
  const [parsing, setParsing] = useState(false);
  const [elaboratingAll, setElaboratingAll] = useState(false);
  const [recentlyFilled, setRecentlyFilled] = useState<Record<string, boolean>>({});
  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastParsedRef = useRef<string>("");

  const speech = useSpeechRecognition({
    language: "en-IN",
    continuous: true,
    interimResults: true,
    onFinal: (chunk) => {
      setDictation((prev) => (prev ? prev + " " : "") + chunk);
    },
  });

  const flashFilled = (keys: string[]) => {
    setRecentlyFilled((prev) => {
      const next = { ...prev };
      keys.forEach((k) => { next[k] = true; });
      return next;
    });
    setTimeout(() => {
      setRecentlyFilled((prev) => {
        const next = { ...prev };
        keys.forEach((k) => { delete next[k]; });
        return next;
      });
    }, 1800);
  };

  const parseDictation = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed === lastParsedRef.current) return;
    lastParsedRef.current = trimmed;
    setParsing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/procedure-ai-parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          transcript: trimmed,
          currentFields: { service_name: serviceName, symptoms, diagnosis, procedure_notes: procedureNotes, recommendations },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Parse failed" }));
        throw new Error(err.error || "Parse failed");
      }
      const data = await res.json();
      const filled: string[] = [];
      if (data.service_name) { setServiceName(data.service_name); filled.push("service"); }
      if (data.symptoms) { setSymptoms(data.symptoms); filled.push("symptoms"); }
      if (data.diagnosis) { setDiagnosis(data.diagnosis); filled.push("diagnosis"); }
      if (data.procedure_notes) { setProcedureNotes(data.procedure_notes); filled.push("procedure_notes"); }
      if (data.recommendations) { setRecommendations(data.recommendations); filled.push("recommendations"); }
      if (Array.isArray(data.prescriptions) && data.prescriptions.length > 0) {
        const newRx = data.prescriptions.map((p: any) => ({
          product_id: "",
          medicine_name: p.medicine_name || "",
          frequency: p.frequency || "",
          duration: p.duration || "",
          instructions: p.instructions || "",
          quantity: 1,
        }));
        setPrescriptions((prev) => [...prev, ...newRx]);
        filled.push("prescriptions");
      }
      if (filled.length === 0) {
        toast.info("Nothing matched — try mentioning symptoms, diagnosis, notes, or medicines.");
      } else {
        flashFilled(filled);
        toast.success(`Filled ${filled.length} section${filled.length === 1 ? "" : "s"} from dictation`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to parse dictation");
    } finally {
      setParsing(false);
    }
  };

  // Auto-parse 1.2s after dictation stops growing (and mic is not actively listening)
  useEffect(() => {
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    if (!dictation.trim()) return;
    if (speech.listening) return;
    parseTimerRef.current = setTimeout(() => { parseDictation(dictation); }, 1200);
    return () => { if (parseTimerRef.current) clearTimeout(parseTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictation, speech.listening]);

  const elaborateAll = async () => {
    if (!symptoms && !diagnosis && !procedureNotes && !recommendations) {
      toast.info("Fill at least one section first, then Elaborate All.");
      return;
    }
    setElaboratingAll(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/procedure-ai-elaborate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          serviceName: serviceName || "Consultation",
          symptoms, diagnosis, procedure_notes: procedureNotes, recommendations,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Elaborate failed" }));
        throw new Error(err.error || "Elaborate failed");
      }
      const data = await res.json();
      const filled: string[] = [];
      if (data.symptoms) { setSymptoms(data.symptoms); filled.push("symptoms"); }
      if (data.diagnosis) { setDiagnosis(data.diagnosis); filled.push("diagnosis"); }
      if (data.procedure_notes) { setProcedureNotes(data.procedure_notes); filled.push("procedure_notes"); }
      if (data.recommendations) { setRecommendations(data.recommendations); filled.push("recommendations"); }
      flashFilled(filled);
      toast.success("Elaborated all sections");
    } catch (e: any) {
      toast.error(e.message || "Failed to elaborate");
    } finally {
      setElaboratingAll(false);
    }
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
          <DialogTitle className="font-display">New Procedure / Prescription</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Unified AI bar */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">AI Assist — dictate or elaborate</span>
                {parsing && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Filling fields…
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={speech.listening ? "destructive" : "outline"}
                  className="h-8 gap-1.5"
                  onClick={() => (speech.listening ? speech.stop() : speech.start())}
                  disabled={!speech.supported}
                  title={speech.supported ? "Voice dictation" : "Voice not supported in this browser"}
                >
                  {speech.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {speech.listening ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      Listening
                    </span>
                  ) : "Dictate"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={elaborateAll}
                  disabled={elaboratingAll}
                >
                  {elaboratingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  AI Elaborate All
                </Button>
              </div>
            </div>
            <Textarea
              value={dictation + (speech.interimTranscript ? (dictation ? " " : "") + speech.interimTranscript : "")}
              onChange={(e) => setDictation(e.target.value)}
              placeholder='Speak or type, e.g. "Patient has acne on forehead and cheeks, itching for 3 weeks. Diagnosis is mild rosacea. Prescribe Doxycycline 100mg twice daily for 14 days."'
              rows={2}
              className="bg-background"
            />
            {dictation && !speech.listening && (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setDictation(""); lastParsedRef.current = ""; }}>
                  Clear
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => parseDictation(dictation)} disabled={parsing}>
                  Parse & Fill Fields
                </Button>
              </div>
            )}
          </div>

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
              <StaffCombobox value={staffId} onValueChange={setStaffId} placeholder="Select doctor" className="mt-1.5" roleFilter={["Doctor"]} />
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
            <Label>Symptoms</Label>
            <Textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g. Redness, itching, dry patches..." className={`mt-1.5 transition-all ${recentlyFilled.symptoms ? "ring-2 ring-primary/40 animate-fade-in" : ""} ${elaboratingAll ? "opacity-60" : ""}`} rows={2} />
          </div>

          <div>
            <Label>Diagnosis</Label>
            <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Patient diagnosis..." className={`mt-1.5 transition-all ${recentlyFilled.diagnosis ? "ring-2 ring-primary/40 animate-fade-in" : ""} ${elaboratingAll ? "opacity-60" : ""}`} rows={2} />
          </div>

          <div>
            <Label>Procedure Notes</Label>
            <Textarea value={procedureNotes} onChange={(e) => setProcedureNotes(e.target.value)} placeholder="Details of the procedure performed..." className={`mt-1.5 transition-all ${recentlyFilled.procedure_notes ? "ring-2 ring-primary/40 animate-fade-in" : ""} ${elaboratingAll ? "opacity-60" : ""}`} rows={3} />
          </div>

          <div>
            <Label>Recommendations</Label>
            <Textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} placeholder="Post-procedure recommendations..." className={`mt-1.5 transition-all ${recentlyFilled.recommendations ? "ring-2 ring-primary/40 animate-fade-in" : ""} ${elaboratingAll ? "opacity-60" : ""}`} rows={3} />
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
