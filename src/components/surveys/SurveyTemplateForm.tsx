import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Search, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Question {
  id?: string;
  question_text: string;
  question_type: string;
  options: string[];
  ideal_answer: any;
  sort_order: number;
}

interface TemplateProduct {
  id?: string;
  product_id: string;
  product_name?: string;
  advice_text: string;
}

interface TemplateService {
  id?: string;
  service_id: string;
  service_name?: string;
  advice_text: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
}

export function SurveyTemplateForm({ open, onOpenChange, templateId }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("basic");

  // Basic fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ageMin, setAgeMin] = useState(0);
  const [ageMax, setAgeMax] = useState(120);
  const [problemAreaId, setProblemAreaId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Questions
  const [questions, setQuestions] = useState<Question[]>([]);

  // Products & Services
  const [templateProducts, setTemplateProducts] = useState<TemplateProduct[]>([]);
  const [templateServices, setTemplateServices] = useState<TemplateService[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");

  // Lookups
  const { data: problemAreas = [] } = useQuery({
    queryKey: ["problem-areas"],
    queryFn: async () => {
      const { data } = await supabase.from("problem_areas").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-list"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pharma-products"],
    queryFn: async () => {
      const { data } = await supabase.from("pharma_products").select("id, name").order("name");
      return data || [];
    },
  });

  // Load template data
  useEffect(() => {
    if (!open) return;
    if (!templateId) {
      resetForm();
      return;
    }
    loadTemplate();
  }, [open, templateId]);

  const resetForm = () => {
    setName(""); setDescription(""); setAgeMin(0); setAgeMax(120);
    setProblemAreaId(""); setServiceId(""); setIsActive(true);
    setQuestions([]); setTemplateProducts([]); setTemplateServices([]);
    setTab("basic");
  };

  const loadTemplate = async () => {
    const { data: t } = await supabase.from("survey_templates").select("*").eq("id", templateId!).single();
    if (!t) return;
    setName(t.name); setDescription(t.description || ""); setAgeMin(t.age_range_min || 0);
    setAgeMax(t.age_range_max || 120); setProblemAreaId(t.problem_area_id || "");
    setServiceId(t.service_id || ""); setIsActive(t.is_active ?? true);

    const { data: qs } = await supabase.from("survey_questions").select("*").eq("template_id", templateId!).order("sort_order");
    setQuestions((qs || []).map((q: any) => ({
      id: q.id, question_text: q.question_text, question_type: q.question_type,
      options: Array.isArray(q.options) ? q.options : [], ideal_answer: q.ideal_answer || {},
      sort_order: q.sort_order,
    })));

    const { data: prods } = await supabase.from("survey_template_products").select("*, pharma_products(name)").eq("template_id", templateId!);
    setTemplateProducts((prods || []).map((p: any) => ({
      id: p.id, product_id: p.product_id, product_name: p.pharma_products?.name, advice_text: p.advice_text || "",
    })));

    const { data: svcs } = await supabase.from("survey_template_services").select("*, services(name)").eq("template_id", templateId!);
    setTemplateServices((svcs || []).map((s: any) => ({
      id: s.id, service_id: s.service_id, service_name: s.services?.name, advice_text: s.advice_text || "",
    })));
  };

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: "", question_type: "text", options: [], ideal_answer: {}, sort_order: questions.length,
    }]);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    (updated[index] as any)[field] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const addProduct = (productId: string) => {
    if (templateProducts.some(p => p.product_id === productId)) return;
    const prod = products.find((p: any) => p.id === productId);
    setTemplateProducts([...templateProducts, { product_id: productId, product_name: prod?.name, advice_text: "" }]);
  };

  const addService = (svcId: string) => {
    if (templateServices.some(s => s.service_id === svcId)) return;
    const svc = services.find((s: any) => s.id === svcId);
    setTemplateServices([...templateServices, { service_id: svcId, service_name: svc?.name, advice_text: "" }]);
  };

  const saveTemplate = async (targetId: string | null, approvalStatus?: string) => {
    if (!name.trim()) { toast.error("Template name is required"); return null; }
    setSaving(true);
    try {
      let tplId = targetId;
      const templateData: any = {
        name, description, age_range_min: ageMin, age_range_max: ageMax,
        problem_area_id: problemAreaId || null, service_id: serviceId || null, is_active: isActive,
      };
      if (approvalStatus) templateData.approval_status = approvalStatus;

      if (tplId) {
        const { error } = await supabase.from("survey_templates").update(templateData).eq("id", tplId);
        if (error) throw error;
      } else {
        if (!approvalStatus) templateData.approval_status = "draft";
        const { data, error } = await supabase.from("survey_templates").insert(templateData).select("id").single();
        if (error) throw error;
        tplId = data.id;
      }

      // Sync questions
      await supabase.from("survey_questions").delete().eq("template_id", tplId!);
      if (questions.length > 0) {
        const qRows = questions.map((q, i) => ({
          template_id: tplId!, question_text: q.question_text, question_type: q.question_type,
          options: q.options, ideal_answer: q.ideal_answer, sort_order: i,
        }));
        const { error } = await supabase.from("survey_questions").insert(qRows);
        if (error) throw error;
      }

      // Sync products
      await supabase.from("survey_template_products").delete().eq("template_id", tplId!);
      if (templateProducts.length > 0) {
        const pRows = templateProducts.map(p => ({
          template_id: tplId!, product_id: p.product_id, advice_text: p.advice_text,
        }));
        const { error } = await supabase.from("survey_template_products").insert(pRows);
        if (error) throw error;
      }

      // Sync services
      await supabase.from("survey_template_services").delete().eq("template_id", tplId!);
      if (templateServices.length > 0) {
        const sRows = templateServices.map(s => ({
          template_id: tplId!, service_id: s.service_id, advice_text: s.advice_text,
        }));
        const { error } = await supabase.from("survey_template_services").insert(sRows);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["survey-templates"] });
      return tplId;
    } catch (e: any) {
      toast.error(e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const result = await saveTemplate(templateId);
    if (result) {
      toast.success(templateId ? "Template updated" : "Template created");
      onOpenChange(false);
    }
  };

  const handleSaveAsNew = async () => {
    const cloneName = name.trim() + " (Copy)";
    setName(cloneName);
    const result = await saveTemplate(null, "draft");
    if (result) {
      toast.success("Saved as new template (Draft)");
      onOpenChange(false);
    }
  };

  const handleSendForApproval = async () => {
    const result = await saveTemplate(templateId, "pending_approval");
    if (result) {
      toast.success("Template sent for approval");
      onOpenChange(false);
    }
  };

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
    !templateProducts.some(tp => tp.product_id === p.id)
  );

  const filteredServices = services.filter((s: any) =>
    s.name.toLowerCase().includes(serviceSearch.toLowerCase()) &&
    !templateServices.some(ts => ts.service_id === s.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{templateId ? "Edit Survey Template" : "New Survey Template"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1 text-xs">Basic Info</TabsTrigger>
            <TabsTrigger value="questions" className="flex-1 text-xs">Questions ({questions.length})</TabsTrigger>
            <TabsTrigger value="products" className="flex-1 text-xs">Products ({templateProducts.length})</TabsTrigger>
            <TabsTrigger value="services" className="flex-1 text-xs">Services ({templateServices.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div>
              <Label>Template Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acne Assessment (18-35)" className="mt-1.5" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this survey covers..." className="mt-1.5" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Age Range Min</Label>
                <Input type="number" value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className="mt-1.5" />
              </div>
              <div>
                <Label>Age Range Max</Label>
                <Input type="number" value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Problem Area</Label>
              <Select value={problemAreaId || "none"} onValueChange={(v) => setProblemAreaId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select problem area" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any</SelectItem>
                  {problemAreas.map((pa: any) => <SelectItem key={pa.id} value={pa.id}>{pa.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Type</Label>
              <Select value={serviceId || "none"} onValueChange={(v) => setServiceId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any</SelectItem>
                  {services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4 mt-4">
            {questions.map((q, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    <span>Q{i + 1}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeQuestion(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  value={q.question_text}
                  onChange={(e) => updateQuestion(i, "question_text", e.target.value)}
                  placeholder="Enter your question..."
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={q.question_type} onValueChange={(v) => updateQuestion(i, "question_type", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="single_choice">Single Choice</SelectItem>
                        <SelectItem value="multi_choice">Multi Choice</SelectItem>
                        <SelectItem value="scale">Scale (1-10)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {q.question_type === "scale" && (
                    <div>
                      <Label className="text-xs">Ideal Score (1-10)</Label>
                      <Input
                        type="number" min={1} max={10}
                        value={q.ideal_answer?.value || ""}
                        onChange={(e) => updateQuestion(i, "ideal_answer", { value: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
                {(q.question_type === "single_choice" || q.question_type === "multi_choice") && (
                  <div className="space-y-2">
                    <Label className="text-xs">Options (comma-separated)</Label>
                    <Input
                      value={q.options.join(", ")}
                      onChange={(e) => updateQuestion(i, "options", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                      placeholder="Option 1, Option 2, Option 3"
                    />
                    <div>
                      <Label className="text-xs">Ideal Answer</Label>
                      <Input
                        value={q.ideal_answer?.value || ""}
                        onChange={(e) => updateQuestion(i, "ideal_answer", { value: e.target.value })}
                        placeholder="The ideal/expected answer"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
                {q.question_type === "text" && (
                  <div>
                    <Label className="text-xs">Ideal Answer (keywords or expected response)</Label>
                    <Input
                      value={q.ideal_answer?.value || ""}
                      onChange={(e) => updateQuestion(i, "ideal_answer", { value: e.target.value })}
                      placeholder="Expected keywords or answer"
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            ))}
            <Button variant="outline" className="w-full gap-2" onClick={addQuestion}>
              <Plus className="h-4 w-4" /> Add Question
            </Button>
          </TabsContent>

          <TabsContent value="products" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products to add..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-9" />
            </div>
            {productSearch && filteredProducts.length > 0 && (
              <div className="border rounded-lg max-h-32 overflow-y-auto">
                {filteredProducts.slice(0, 10).map((p: any) => (
                  <button key={p.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors" onClick={() => { addProduct(p.id); setProductSearch(""); }}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {templateProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No products added yet. Search above to add.</p>
            ) : (
              <div className="space-y-3">
                {templateProducts.map((tp, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{tp.product_name || tp.product_id}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setTemplateProducts(templateProducts.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      value={tp.advice_text}
                      onChange={(e) => {
                        const updated = [...templateProducts];
                        updated[i].advice_text = e.target.value;
                        setTemplateProducts(updated);
                      }}
                      placeholder="Advice text for this product..."
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search services to add..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} className="pl-9" />
            </div>
            {serviceSearch && filteredServices.length > 0 && (
              <div className="border rounded-lg max-h-32 overflow-y-auto">
                {filteredServices.slice(0, 10).map((s: any) => (
                  <button key={s.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors" onClick={() => { addService(s.id); setServiceSearch(""); }}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {templateServices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No services added yet. Search above to add.</p>
            ) : (
              <div className="space-y-3">
                {templateServices.map((ts, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{ts.service_name || ts.service_id}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setTemplateServices(templateServices.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      value={ts.advice_text}
                      onChange={(e) => {
                        const updated = [...templateServices];
                        updated[i].advice_text = e.target.value;
                        setTemplateServices(updated);
                      }}
                      placeholder="Advice text for this service..."
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {templateId && (
            <>
              <Button variant="outline" onClick={handleSaveAsNew} disabled={saving} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Save as New
              </Button>
              <Button variant="outline" onClick={handleSendForApproval} disabled={saving} className="gap-1.5">
                <Send className="h-3.5 w-3.5" /> Send for Approval
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : templateId ? "Update Template" : "Create Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
