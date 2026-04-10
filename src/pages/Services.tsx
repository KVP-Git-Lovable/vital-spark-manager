import { useState } from "react";
import { Plus, Search, Edit2, Trash2, Clock, IndianRupee, Pill, Sparkles, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ServiceDetailSheet } from "@/components/services/ServiceDetailSheet";

interface MedicineInput {
  product_id: string;
  product_name: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const categories = ["All", "Skin Treatment", "Injectable", "Laser Treatment", "Regenerative", "General"];

const Services = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [procedureNotes, setProcedureNotes] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [medicines, setMedicines] = useState<MedicineInput[]>([]);
  const [elaborating, setElaborating] = useState<string | null>(null);

  const elaborate = async (fieldType: "diagnosis" | "procedure_notes" | "recommendations") => {
    if (!name.trim()) {
      toast.error("Enter a service name first");
      return;
    }
    const currentText = fieldType === "diagnosis" ? diagnosis : fieldType === "procedure_notes" ? procedureNotes : recommendations;
    setElaborating(fieldType);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elaborate-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ serviceName: name, fieldType, currentText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "AI request failed" }));
        throw new Error(err.error || "AI request failed");
      }
      const { text } = await res.json();
      if (fieldType === "diagnosis") setDiagnosis(text);
      else if (fieldType === "procedure_notes") setProcedureNotes(text);
      else setRecommendations(text);
      toast.success("Text elaborated — review and edit as needed");
    } catch (e: any) {
      toast.error(e.message || "Failed to elaborate");
    } finally {
      setElaborating(null);
    }
  };

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: serviceMedicines = [] } = useQuery({
    queryKey: ["service-medicines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_medicines")
        .select("*, pharma_products(name)");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pharma-products-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharma_products")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const recs = recommendations.split("\n").filter((r) => r.trim());
      const { data: svc, error } = await supabase
        .from("services")
        .insert({
          name,
          category: category || "General",
          duration: parseInt(duration) || 30,
          price: parseFloat(price) || 0,
          diagnosis: diagnosis || null,
          procedure_notes: procedureNotes || null,
          recommendations: recs,
        })
        .select()
        .single();
      if (error) throw error;

      if (medicines.length > 0) {
        const rows = medicines
          .filter((m) => m.product_id)
          .map((m) => ({
            service_id: svc.id,
            product_id: m.product_id,
            frequency: m.frequency || null,
            duration: m.duration || null,
            instructions: m.instructions || null,
          }));
        if (rows.length > 0) {
          const { error: mErr } = await supabase.from("service_medicines").insert(rows);
          if (mErr) throw mErr;
        }
      }
      return svc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["service-medicines"] });
      toast.success("Service created successfully");
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["service-medicines"] });
      toast.success("Service deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setName("");
    setCategory("");
    setDuration("");
    setPrice("");
    setDiagnosis("");
    setProcedureNotes("");
    setRecommendations("");
    setMedicines([]);
  };

  const addMedicine = () => {
    setMedicines([...medicines, { product_id: "", product_name: "", frequency: "", duration: "", instructions: "" }]);
  };

  const updateMedicine = (index: number, field: keyof MedicineInput, value: string) => {
    const updated = [...medicines];
    updated[index][field] = value;
    if (field === "product_id") {
      const prod = products.find((p) => p.id === value);
      updated[index].product_name = prod?.name || "";
    }
    setMedicines(updated);
  };

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const filtered = services.filter((s: any) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getMedicinesForService = (serviceId: string) => {
    return serviceMedicines.filter((sm: any) => sm.service_id === serviceId);
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Service Master</h1>
          <p className="page-subtitle">Manage clinic services, medicines and recommendations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-fit">
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Add New Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Service Name *</Label>
                <Input placeholder="e.g. Chemical Peel" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Input placeholder="e.g. Skin Treatment" className="mt-1.5" value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
                <div>
                  <Label>Duration (mins)</Label>
                  <Input type="number" placeholder="45" className="mt-1.5" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input type="number" placeholder="3500" className="mt-1.5" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Diagnosis</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("diagnosis")} disabled={elaborating !== null}>
                    {elaborating === "diagnosis" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Elaborate AI
                  </Button>
                </div>
                <Textarea placeholder="Diagnosis template..." className="mt-1.5" rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Procedure Notes</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("procedure_notes")} disabled={elaborating !== null}>
                    {elaborating === "procedure_notes" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Elaborate AI
                  </Button>
                </div>
                <Textarea placeholder="Procedure notes template..." className="mt-1.5" rows={2} value={procedureNotes} onChange={(e) => setProcedureNotes(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Recommendations (one per line)</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => elaborate("recommendations")} disabled={elaborating !== null}>
                    {elaborating === "recommendations" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Elaborate AI
                  </Button>
                </div>
                <Textarea placeholder="Avoid sun exposure 48hrs&#10;Apply moisturizer daily" className="mt-1.5" rows={3} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
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
                    <div>
                      <Select value={med.product_id} onValueChange={(v) => updateMedicine(i, "product_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Frequency" value={med.frequency} onChange={(e) => updateMedicine(i, "frequency", e.target.value)} />
                      <Input placeholder="Duration" value={med.duration} onChange={(e) => updateMedicine(i, "duration", e.target.value)} />
                      <Input placeholder="Special instructions" value={med.instructions} onChange={(e) => updateMedicine(i, "instructions", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Create Service"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            className="pl-9 bg-card border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Loading services...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No services found. Add your first service above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((service: any, i: number) => {
            const meds = getMedicinesForService(service.id);
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="stat-card group cursor-pointer"
                onClick={() => setSelectedServiceId(service.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display font-semibold">{service.name}</h3>
                    <Badge variant="secondary" className="mt-1 text-xs">{service.category}</Badge>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedServiceId(service.id); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(service.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {service.diagnosis && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Diagnosis</p>
                    <p className="text-sm">{service.diagnosis}</p>
                  </div>
                )}
                {service.procedure_notes && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Procedure Notes</p>
                    <p className="text-sm">{service.procedure_notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">₹{Number(service.price).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{service.duration} mins</span>
                  </div>
                </div>

                {service.recommendations && service.recommendations.length > 0 && (
                  <div className="border-t pt-3 mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recommendations</p>
                    <div className="space-y-1">
                      {service.recommendations.map((rec: string, j: number) => (
                        <p key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">•</span>
                          {rec}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {meds.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Pill className="h-3 w-3" /> Medicines ({meds.length})
                    </p>
                    <div className="space-y-1">
                      {meds.map((m: any) => (
                        <p key={m.id} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{m.pharma_products?.name || "—"}</span>
                          {m.frequency && ` · ${m.frequency}`}
                          {m.duration && ` · ${m.duration}`}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
      <ServiceDetailSheet serviceId={selectedServiceId} onClose={() => setSelectedServiceId(null)} />
    </div>
  );
};

export default Services;
