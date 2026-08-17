import { useState, useEffect, useRef } from "react";
import { Plus, Pill, Wrench, Check, Sparkles, Loader2, Mic, MicOff, ChevronsUpDown, HeartPulse, ClipboardCheck, CalendarClock, Repeat } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { PatientToolsBar } from "@/components/shared/PatientToolsBar";
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
  defaultProblemAreaIds?: string[];
  /** Render inline (full page) instead of inside a modal dialog */
  asPage?: boolean;
  onSaved?: (procedureId: string) => void;
}

export function ProcedureFormDialog({
  open, onOpenChange,
  defaultPatientId, defaultAppointmentId, defaultStaffId, defaultServiceName, defaultProblemAreaIds,
  asPage = false, onSaved,
}: ProcedureFormDialogProps) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState(defaultPatientId || "");
  const [staffId, setStaffId] = useState(defaultStaffId || "");
  const [assistedBy, setAssistedBy] = useState("");
  const [selectedProblemAreas, setSelectedProblemAreas] = useState<string[]>(defaultProblemAreaIds || []);
  const [medical, setMedical] = useState<Record<string, string>>({});
  const [medicalDirty, setMedicalDirty] = useState(false);
  const [appointmentId] = useState(defaultAppointmentId || "");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState(defaultServiceName || "");
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [procedureNotes, setProcedureNotes] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [nextAppointmentAt, setNextAppointmentAt] = useState("");
  const [visitType, setVisitType] = useState<"Single" | "Recurring">("Single");
  const [recurringCount, setRecurringCount] = useState(2);
  const [recurringDates, setRecurringDates] = useState<string[]>(["", ""]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionInput[]>([]);
  const [stockMap, setStockMap] = useState<Record<number, StockInfo>>({});
  const [procedureAssets, setProcedureAssets] = useState<AssetInput[]>([]);
  const [autoFilled, setAutoFilled] = useState(false);

  // Unified AI bar state
  const [dictation, setDictation] = useState("");
  const [parsing, setParsing] = useState(false);
  const [elaboratingAll, setElaboratingAll] = useState(false);
  const [recentlyFilled, setRecentlyFilled] = useState<Record<string, boolean>>({});
  const [unmatchedHints, setUnmatchedHints] = useState<{
    patient?: string;
    doctor?: string;
    assistant?: string;
    problemAreas?: string[];
  }>({});
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
      const patientList = (patients || []).map((p: any) => ({
        id: p.id,
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      }));
      const doctorList = (allStaff || [])
        .filter((s: any) => (s.role || "").toLowerCase() === "doctor")
        .map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`.trim() }));
      const assistantList = (allStaff || [])
        .filter((s: any) => {
          const r = (s.role || "").toLowerCase();
          return r === "nurse" || r === "therapist" || r === "staff" || r === "assistant";
        })
        .map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`.trim() }));
      const problemAreaList = (problemAreas || []).map((p: any) => ({ id: p.id, name: p.name }));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/procedure-ai-parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          transcript: trimmed,
          currentFields: { service_name: serviceName, symptoms, diagnosis, procedure_notes: procedureNotes, recommendations },
          problemAreas: problemAreaList,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Parse failed" }));
        throw new Error(err.error || "Parse failed");
      }
      const data = await res.json();
      console.log("[procedure-ai-parse] response", data);
      const filled: string[] = [];
      const nextHints: typeof unmatchedHints = {};

      // Local fuzzy matching against full lists (DB has 17k+ patients — cannot send all to AI)
      const norm = (s: string) =>
        s.toLowerCase().replace(/\b(dr|doctor|mr|mrs|ms|nurse)\b\.?/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      const fuzzyMatch = (query: string, list: { id: string; name: string }[]) => {
        const q = norm(query);
        if (!q) return null;
        const qTokens = q.split(" ").filter(Boolean);
        let best: { id: string; score: number } | null = null;
        for (const item of list) {
          const n = norm(item.name);
          if (!n) continue;
          let score = 0;
          if (n === q) score = 1000;
          else if (n.includes(q) || q.includes(n)) score = 500;
          else {
            const nTokens = new Set(n.split(" "));
            const hits = qTokens.filter((t) => nTokens.has(t)).length;
            if (hits === 0) continue;
            score = hits * 100 - Math.abs(n.length - q.length);
          }
          if (!best || score > best.score) best = { id: item.id, score };
        }
        return best && best.score >= 100 ? best.id : null;
      };

      // Patient
      if (data.patient_name) {
        const id = fuzzyMatch(data.patient_name, patientList);
        if (id) { setPatientId(id); filled.push("patient"); }
        else nextHints.patient = data.patient_name;
      }
      // Doctor
      if (data.doctor_name) {
        const id = fuzzyMatch(data.doctor_name, doctorList);
        if (id) { setStaffId(id); filled.push("doctor"); }
        else nextHints.doctor = data.doctor_name;
      }
      // Assistant
      if (data.assistant_name) {
        const id = fuzzyMatch(data.assistant_name, assistantList);
        if (id) { setAssistedBy(id); filled.push("assistant"); }
        else nextHints.assistant = data.assistant_name;
      }
      // Primary concerns
      if (Array.isArray(data.problem_areas) && data.problem_areas.length) {
        const matchedIds: string[] = [];
        const unmatched: string[] = [];
        for (const phrase of data.problem_areas) {
          const id = fuzzyMatch(phrase, problemAreaList);
          if (id) matchedIds.push(id);
          else unmatched.push(phrase);
        }
        if (matchedIds.length) {
          setSelectedProblemAreas((prev) => Array.from(new Set([...prev, ...matchedIds])));
          filled.push("problem_areas");
        }
        if (unmatched.length) nextHints.problemAreas = unmatched;
      }
      setUnmatchedHints(nextHints);

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

  // Patient medical snapshot — editable here and synced back to the patient record
  const { data: patientRecord } = useQuery({
    queryKey: ["procedure-form-patient", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, medical_history, current_medications, allergies, skin_type, skin_concerns, previous_treatments")
        .eq("id", patientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!patientRecord) return;
    setMedical({
      medical_history: patientRecord.medical_history || "",
      current_medications: patientRecord.current_medications || "",
      allergies: patientRecord.allergies || "",
      skin_type: patientRecord.skin_type || "",
      skin_concerns: patientRecord.skin_concerns || "",
      previous_treatments: patientRecord.previous_treatments || "",
    });
    setMedicalDirty(false);
  }, [patientRecord]);

  // Surveys already filled for this patient (most recent first)
  const { data: patientSurveys = [] } = useQuery({
    queryKey: ["procedure-form-surveys", patientId, defaultAppointmentId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("id, created_at, dr_status, answers, ai_summary, appointment_id, survey_templates(name)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allStaff = [] } = useQuery({
    queryKey: ["staff-active-all-for-ai"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")

        .select("id, first_name, last_name, role")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
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
      const { data, error } = await supabase
        .from("pharma_products")
        .select("id, name, default_frequency, default_duration, default_instructions")
        .order("name");
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
          review_notes: reviewNotes || null,
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

      // Sync any edits to the patient's medical information back to the patient record
      if (medicalDirty && patientId) {
        const { error: medErr } = await supabase
          .from("patients")
          .update({
            medical_history: medical.medical_history || null,
            current_medications: medical.current_medications || null,
            allergies: medical.allergies || null,
            skin_type: medical.skin_type || null,
            skin_concerns: medical.skin_concerns || null,
            previous_treatments: medical.previous_treatments || null,
          })
          .eq("id", patientId);
        if (medErr) throw medErr;
      }

      // Optional follow-up appointment picked by the doctor
      if (nextAppointmentAt && patientId) {
        const start = new Date(nextAppointmentAt);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        const p = (patients as any[]).find((x) => x.id === patientId);
        const { error: aptErr } = await supabase.from("appointments").insert({
          patient_id: patientId,
          patient_name: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : null,
          staff_id: staffId || null,
          service: serviceName || "Follow Up",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "Reserved",
          problem_area_ids: selectedProblemAreas.length ? selectedProblemAreas : null,
          source: "Procedure",
        } as any);
        if (aptErr) throw aptErr;
      }
      return proc;
    },
    onSuccess: (proc: any) => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-procedures"] });
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      if (nextAppointmentAt) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        toast.success("Procedure saved · Next appointment reserved");
      } else {
        toast.success("Procedure created successfully");
      }
      onSaved?.(proc?.id);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addPrescription = () => {
    setPrescriptions([...prescriptions, { product_id: "", medicine_name: "", frequency: "", duration: "", instructions: "", quantity: 1 }]);
  };

  const fetchStock = async (productId: string, index: number) => {
    setStockMap((prev) => ({ ...prev, [index]: { available: 0, loading: true } }));
    // Inventory rows are decremented at the point of sale, so they already reflect live stock.
    const { data: invData } = await supabase
      .from("pharma_inventory")
      .select("quantity")
      .eq("product_id", productId);
    const totalStock = (invData || []).reduce((s, i) => s + Number(i.quantity), 0);
    setStockMap((prev) => ({ ...prev, [index]: { available: Math.max(0, totalStock), loading: false } }));
  };

  const updatePrescription = (index: number, field: keyof PrescriptionInput, value: string | number) => {
    const updated = [...prescriptions];
    if (field === "product_id") {
      const prod = products.find((p) => p.id === value) as any;
      updated[index].product_id = value as string;
      updated[index].medicine_name = prod?.name || "";
      // Prescription defaults from the product master (only fill blanks).
      if (!updated[index].frequency) updated[index].frequency = prod?.default_frequency || "";
      if (!updated[index].duration) updated[index].duration = prod?.default_duration || "";
      if (!updated[index].instructions) updated[index].instructions = prod?.default_instructions || "";
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

  const body = (
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
                onValueChange={(v) => { setPatientId(v); setUnmatchedHints((h) => ({ ...h, patient: undefined })); }}
                placeholder="Select patient"
                className="mt-1.5"
                disabled={isFromAppointment}
              />
              {unmatchedHints.patient && (
                <p className="text-xs text-amber-600 mt-1">Couldn't match "{unmatchedHints.patient}" — please select manually.</p>
              )}
            </div>
            <div>
              <Label>Doctor</Label>
              <StaffCombobox value={staffId} onValueChange={(v) => { setStaffId(v); setUnmatchedHints((h) => ({ ...h, doctor: undefined })); }} placeholder="Select doctor" className="mt-1.5" roleFilter={["Doctor"]} />
              {unmatchedHints.doctor && (
                <p className="text-xs text-amber-600 mt-1">Couldn't match "{unmatchedHints.doctor}" — please select manually.</p>
              )}
            </div>
            <div>
              <Label>Assisted By</Label>
              <StaffCombobox value={assistedBy} onValueChange={(v) => { setAssistedBy(v); setUnmatchedHints((h) => ({ ...h, assistant: undefined })); }} placeholder="Select assistant" allowNone noneLabel="No assistant" className="mt-1.5" />
              {unmatchedHints.assistant && (
                <p className="text-xs text-amber-600 mt-1">Couldn't match "{unmatchedHints.assistant}" — please select manually.</p>
              )}
            </div>
            <div>
              <Label>Primary Concern</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1.5 justify-start font-normal h-10">
                    {selectedProblemAreas.length === 0
                      ? <span className="text-muted-foreground">Select primary concerns</span>
                      : <span className="truncate">{selectedProblemAreas.map(id => problemAreas.find(pa => pa.id === id)?.name).filter(Boolean).join(", ")}</span>
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                      <CommandEmpty>No primary concerns found</CommandEmpty>
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
              {unmatchedHints.problemAreas && unmatchedHints.problemAreas.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">Couldn't match: {unmatchedHints.problemAreas.map((q) => `"${q}"`).join(", ")} — please select manually.</p>
              )}
            </div>
          </div>

          <div>
            <Label>Service / Procedure Name</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="mt-1.5 w-full justify-between font-normal">
                  {serviceId ? (services.find((s: any) => s.id === serviceId)?.name || "Select service") : "Select service (optional)"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search service..." />
                  <CommandList>
                    <CommandEmpty>No service found.</CommandEmpty>
                    <CommandGroup>
                      {services.map((s: any) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => handleServiceSelect(s.id)}
                        >
                          <Check className={`mr-2 h-4 w-4 ${serviceId === s.id ? "opacity-100" : "opacity-0"}`} />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Symptoms</Label>
            <Textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g. Redness, itching, dry patches..." className={`mt-1.5 transition-all ${recentlyFilled.symptoms ? "ring-2 ring-primary/40 animate-fade-in" : ""} ${elaboratingAll ? "opacity-60" : ""}`} rows={2} />
          </div>

          {/* Surveys filled before this procedure */}
          {patientSurveys.length > 0 && (
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Surveys filled by this patient</span>
              </div>
              {patientSurveys.map((s: any) => {
                const answers = Array.isArray(s.answers) ? s.answers : [];
                return (
                  <div key={s.id} className="rounded-md border bg-background p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">
                        {s.survey_templates?.name || "Survey"}
                        {s.appointment_id && defaultAppointmentId && s.appointment_id === defaultAppointmentId && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">this visit</span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()} · {s.dr_status || "pending"}
                      </span>
                    </div>
                    {s.ai_summary && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{s.ai_summary}</p>}
                    {answers.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {answers.slice(0, 6).map((a: any, idx: number) => (
                          <li key={idx} className="text-xs">
                            <span className="text-muted-foreground">{a.question || a.question_text || `Q${idx + 1}`}: </span>
                            <span className="font-medium">{Array.isArray(a.answer) ? a.answer.join(", ") : String(a.answer ?? "—")}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Patient medical information */}
          {patientId && (
            <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Medical Information</span>
                <span className="text-[11px] text-muted-foreground">(saved back to the patient record)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ["medical_history", "Medical History"],
                  ["current_medications", "Current Medications"],
                  ["allergies", "Allergies"],
                  ["previous_treatments", "Previous Treatments"],
                  ["skin_type", "Skin Type"],
                  ["skin_concerns", "Skin Concerns"],
                ] as [string, string][]).map(([field, label]) => (
                  <div key={field}>
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Textarea
                      rows={2}
                      className="mt-1 text-sm"
                      value={medical[field] || ""}
                      onChange={(e) => { setMedical((m) => ({ ...m, [field]: e.target.value })); setMedicalDirty(true); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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
          <div className="rounded-lg border-2 border-primary/25 bg-primary/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-display font-semibold flex items-center gap-2 text-primary">
                <Pill className="h-4 w-4" /> Pharmacy — Prescriptions
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addPrescription}>
                <Plus className="h-3 w-3 mr-1" /> Add Medicine
              </Button>
            </div>
            {prescriptions.map((rx, i) => (
              <div key={i} className="border rounded-lg p-3 mb-3 space-y-2 bg-background">
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
          <div className="rounded-lg border-2 border-accent/50 bg-accent/10 p-4">
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
              <div key={i} className="border rounded-lg p-3 mb-3 space-y-2 bg-background">
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

          <div>
            <Label>Review</Label>
            <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="e.g. Follow up in 3 months" className="mt-1.5" rows={2} />
          </div>

          {/* Next appointment */}
          <div className="rounded-lg border-2 border-primary/25 bg-primary/5 p-4">
            <Label className="text-base font-display font-semibold flex items-center gap-2 text-primary">
              <CalendarClock className="h-4 w-4" /> Next Appointment Date
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Pick a date &amp; time — an appointment will be created with status <span className="font-medium">Reserved</span>.
            </p>
            <Input
              type="datetime-local"
              value={nextAppointmentAt}
              onChange={(e) => setNextAppointmentAt(e.target.value)}
              className="mt-2 bg-background"
            />
            {nextAppointmentAt && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs mt-1" onClick={() => setNextAppointmentAt("")}>
                Clear
              </Button>
            )}
          </div>

          <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!patientId || createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Save Procedure"}
          </Button>
        </div>
  );

  if (asPage) {
    return <div className="max-w-4xl">{body}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">New Procedure / Prescription</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
