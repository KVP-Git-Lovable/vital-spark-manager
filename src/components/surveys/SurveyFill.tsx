import { useState, useEffect } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  appointmentId: string;
  patientId: string;
  onComplete?: () => void;
}

export function SurveyFill({ open, onOpenChange, templateId, appointmentId, patientId, onComplete }: Props) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: questions = [] } = useQuery({
    queryKey: ["survey-questions", templateId],
    queryFn: async () => {
      const { data, error } = await supabase.from("survey_questions").select("*").eq("template_id", templateId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!templateId && open,
  });

  const { data: template } = useQuery({
    queryKey: ["survey-template", templateId],
    queryFn: async () => {
      const { data, error } = await supabase.from("survey_templates").select("*").eq("id", templateId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!templateId && open,
  });

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    const unanswered = questions.filter((q: any) => !answers[q.id] && answers[q.id] !== 0);
    if (unanswered.length > 0) {
      toast.error(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }
    setSubmitting(true);
    try {
      // Get template products and services for AI context
      const [{ data: tplProducts }, { data: tplServices }] = await Promise.all([
        supabase.from("survey_template_products").select("*, pharma_products(name, category)").eq("template_id", templateId),
        supabase.from("survey_template_services").select("*, services(name, category)").eq("template_id", templateId),
      ]);

      // Call AI recommendation edge function
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/survey-recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          template, questions, answers,
          available_products: tplProducts || [],
          available_services: tplServices || [],
        }),
      });

      let aiResult = { recommendation: "", products: [], services: [] };
      if (resp.ok) {
        aiResult = await resp.json();
      } else {
        console.error("AI recommendation failed, saving without AI");
      }

      const { enrichAiProducts, enrichAiServices } = await import("@/lib/surveyApproval");
      const enrichedProducts = enrichAiProducts(aiResult.products || [], tplProducts || []);
      const enrichedServices = enrichAiServices(aiResult.services || [], tplServices || []);

      // Save response
      const { error } = await supabase.from("survey_responses").insert({
        template_id: templateId,
        appointment_id: appointmentId || null,
        patient_id: patientId,
        answers,
        ai_recommendation: aiResult.recommendation ? { text: aiResult.recommendation } : {},
        ai_products: enrichedProducts,
        ai_services: enrichedServices,
        dr_status: "pending_review",
      });
      if (error) throw error;

      toast.success("Survey submitted! AI recommendations pending doctor review.");
      onOpenChange(false);
      onComplete?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            {template?.name || "Patient Survey"}
          </DialogTitle>
        </DialogHeader>

        {template?.description && (
          <p className="text-sm text-muted-foreground">{template.description}</p>
        )}

        <div className="space-y-6 mt-2">
          {questions.map((q: any, i: number) => {
            // Normalize options: could be string[], { choices: string[] }, or other
            const getOptions = (): string[] => {
              if (Array.isArray(q.options)) return q.options;
              if (q.options && Array.isArray(q.options.choices)) return q.options.choices;
              return [];
            };
            const opts = getOptions();
            const scaleMin = q.options?.min ?? 1;
            const scaleMax = q.options?.max ?? 10;

            return (
              <div key={q.id} className="space-y-2 p-3 rounded-lg border bg-muted/30">
                <Label className="text-sm font-medium">
                  {i + 1}. {q.question_text}
                </Label>

                {q.question_type === "text" && (
                  <Textarea
                    value={answers[q.id] || ""}
                    onChange={(e) => updateAnswer(q.id, e.target.value)}
                    placeholder="Type your answer here..."
                    rows={2}
                  />
                )}

                {q.question_type === "single_choice" && (
                  <RadioGroup value={answers[q.id] || ""} onValueChange={(v) => updateAnswer(q.id, v)} className="pl-1">
                    {opts.map((opt: string) => (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                        <Label htmlFor={`${q.id}-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {q.question_type === "multi_choice" && (
                  <div className="space-y-2 pl-1">
                    {opts.map((opt: string) => (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox
                          checked={(answers[q.id] || []).includes(opt)}
                          onCheckedChange={(checked) => {
                            const current = answers[q.id] || [];
                            updateAnswer(q.id, checked ? [...current, opt] : current.filter((o: string) => o !== opt));
                          }}
                        />
                        <Label className="font-normal cursor-pointer">{opt}</Label>
                      </div>
                    ))}
                  </div>
                )}

                {q.question_type === "scale" && (
                  <div className="space-y-2 px-1">
                    <Slider
                      value={[answers[q.id] ?? Math.round((scaleMin + scaleMax) / 2)]}
                      onValueChange={([v]) => updateAnswer(q.id, v)}
                      min={scaleMin} max={scaleMax} step={1}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{scaleMin} - Low</span>
                      <Badge variant="outline">{answers[q.id] ?? Math.round((scaleMin + scaleMax) / 2)}</Badge>
                      <span>{scaleMax} - High</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit & Get AI Recommendations
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
