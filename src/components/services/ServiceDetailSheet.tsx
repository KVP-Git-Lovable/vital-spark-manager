import { useState, useEffect } from "react";
import { Save, Trash2, Plus, Pill, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface MedicineInput {
  id?: string;
  product_id: string;
  product_name: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface ServiceDetailSheetProps {
  serviceId: string | null;
  onClose: () => void;
}

export function ServiceDetailSheet({ serviceId, onClose }: ServiceDetailSheetProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [procedureNotes, setProcedureNotes] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [medicines, setMedicines] = useState<MedicineInput[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [elaborating, setElaborating] = useState<string | null>(null);

  const { data: service } = useQuery({
    queryKey: ["service-detail", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("id", serviceId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!serviceId,
  });

  const { data: serviceMeds = [] } = useQuery({
    queryKey: ["service-medicines-detail", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_medicines")
        .select("*, pharma_products(name)")
        .eq("service_id", serviceId!);
      if (error) throw error;
      return data;
    },
    enabled: !!serviceId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pharma-products-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharma_products").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (service && !initialized) {
      setName(service.name);
      setCategory(service.category);
      setDuration(String(service.duration));
      setPrice(String(service.price));
      setDiagnosis(service.diagnosis || "");
      setProcedureNotes(service.procedure_notes || "");
      setRecommendations((service.recommendations || []).join("\n"));
      setInitialized(true);
    }
  }, [service, initialized]);

  useEffect(() => {
    if (serviceMeds.length > 0 && initialized) {
      setMedicines(serviceMeds.map((m: any) => ({
        id: m.id,
        product_id: m.product_id,
        product_name: m.pharma_products?.name || "",
        frequency: m.frequency || "",
        duration: m.duration || "",
        instructions: m.instructions || "",
      })));
    }
  }, [serviceMeds, initialized]);

  const handleClose = () => {
    setInitialized(false);
    setMedicines([]);
    onClose();
  };

  const elaborate = async (fieldType: "diagnosis" | "procedure_notes" | "recommendations") => {
    if (!name.trim()) { toast.error("Enter a service name first"); return; }
    const currentText = fieldType === "diagnosis" ? diagnosis : fieldType === "procedure_notes" ? procedureNotes : recommendations;
    setElaborating(fieldType);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elaborate-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ serviceName: name, fieldType, currentText }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: "AI request failed" })); throw new Error(err.error || "AI request failed"); }
      const { text } = await res.json();
      if (fieldType === "diagnosis") setDiagnosis(text);
      else if (fieldType === "procedure_notes") setProcedureNotes(text);
      else setRecommendations(text);
      toast.success("Text elaborated");
    } catch (e: any) { toast.error(e.message || "Failed to elaborate"); }
    finally { setElaborating(null); }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const recs = recommendations.split("\n").filter((r) => r.trim());
      const { error } = await supabase.from("services").update({
        name, category: category || "General", duration: parseInt(duration) || 30,
        price: parseFloat(price) || 0, diagnosis: diagnosis || null,
        procedure_notes: procedureNotes || null, recommendations: recs,
      }).eq("id", serviceId!);
      if (error) throw error;

      // Delete old medicines, re-insert
      await supabase.from("service_medicines").delete().eq("service_id", serviceId!);
      const rows = medicines.filter((m) => m.product_id).map((m) => ({
        service_id: serviceId!, product_id: m.product_id,
        frequency: m.frequency || null, duration: m.duration || null, instructions: m.instructions || null,
      }));
      if (rows.length > 0) {
        const { error: mErr } = await supabase.from("service_medicines").insert(rows);
        if (mErr) throw mErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["service-medicines"] });
      toast.success("Service updated");
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("service_medicines").delete().eq("service_id", serviceId!);
      const { error } = await supabase.from("services").delete().eq("id", serviceId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["service-medicines"] });
      toast.success("Service deleted");
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMedicine = () => setMedicines([...medicines, { product_id: "", product_name: "", frequency: "", duration: "", instructions: "" }]);
  const updateMedicine = (i: number, field: keyof MedicineInput, value: string) => {
    const updated = [...medicines];
    updated[i][field] = value;
    if (field === "product_id") { updated[i].product_name = products.find((p) => p.id === value)?.name || ""; }
    setMedicines(updated);
  };
  const removeMedicine = (i: number) => setMedicines(medicines.filter((_, idx) => idx !== i));

  return (
    <Sheet open={!!serviceId} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <Badge variant="outline" className="text-[10px] text-muted-foreground w-fit font-normal">Service</Badge>
          <SheetTitle className="font-display">Edit Service</SheetTitle>
        </SheetHeader>
        {!service ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4 pt-4">
            <div>
              <Label>Service Name *</Label>
              <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Input className="mt-1.5" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div>
                <Label>Duration (mins)</Label>
                <Input type="number" className="mt-1.5" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Price (₹)</Label>
              <Input type="number" className="mt-1.5" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>

            {/* Diagnosis */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Diagnosis</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("diagnosis")} disabled={elaborating !== null}>
                  {elaborating === "diagnosis" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Elaborate AI
                </Button>
              </div>
              <Textarea className="mt-1.5" rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </div>

            {/* Procedure Notes */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Procedure Notes</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("procedure_notes")} disabled={elaborating !== null}>
                  {elaborating === "procedure_notes" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Elaborate AI
                </Button>
              </div>
              <Textarea className="mt-1.5" rows={2} value={procedureNotes} onChange={(e) => setProcedureNotes(e.target.value)} />
            </div>

            {/* Recommendations */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Recommendations (one per line)</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("recommendations")} disabled={elaborating !== null}>
                  {elaborating === "recommendations" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Elaborate AI
                </Button>
              </div>
              <Textarea className="mt-1.5" rows={3} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
            </div>

            {/* Medicines */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-display font-semibold flex items-center gap-2">
                  <Pill className="h-4 w-4" /> Medicines
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addMedicine}>
                  <Plus className="h-3 w-3 mr-1" /> Add Medicine
                </Button>
              </div>
              {medicines.map((med, i) => (
                <div key={i} className="border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Medicine {i + 1}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => removeMedicine(i)}>Remove</Button>
                  </div>
                  <Select value={med.product_id} onValueChange={(v) => updateMedicine(i, "product_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Frequency" value={med.frequency} onChange={(e) => updateMedicine(i, "frequency", e.target.value)} />
                    <Input placeholder="Duration" value={med.duration} onChange={(e) => updateMedicine(i, "duration", e.target.value)} />
                    <Input placeholder="Instructions" value={med.instructions} onChange={(e) => updateMedicine(i, "instructions", e.target.value)} />
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button className="flex-1 gap-2" onClick={() => updateMutation.mutate()} disabled={!name || updateMutation.isPending}>
                <Save className="h-4 w-4" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this service?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove this service and its linked medicines.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
