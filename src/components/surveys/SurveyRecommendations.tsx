import { useState } from "react";
import { Check, X, Pencil, Bot, Pill, Stethoscope, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  appointmentId: string;
}

export function SurveyRecommendations({ appointmentId }: Props) {
  const queryClient = useQueryClient();
  const [drNotes, setDrNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<string | null>(null);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["survey-responses", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*, survey_templates(name), staff(first_name, last_name)")
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("id, first_name, last_name, role").order("first_name");
      return data || [];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ responseId, status, notes, reviewedBy }: { responseId: string; status: string; notes: string; reviewedBy: string }) => {
      const { error } = await supabase.from("survey_responses").update({
        dr_status: status,
        dr_notes: notes,
        reviewed_by: reviewedBy || null,
        reviewed_at: new Date().toISOString(),
      }).eq("id", responseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-responses", appointmentId] });
      toast.success("Review saved");
      setReviewAction(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>;
  if (responses.length === 0) return null;

  return (
    <div className="space-y-4">
      {responses.map((resp: any) => {
        const aiRec = resp.ai_recommendation as any;
        const aiProducts = (resp.ai_products || []) as any[];
        const aiServices = (resp.ai_services || []) as any[];

        return (
          <div key={resp.id} className="border rounded-lg p-4 space-y-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">AI Recommendations</h4>
                <Badge variant="outline" className="text-[10px]">{resp.survey_templates?.name}</Badge>
              </div>
              <Badge
                variant={resp.dr_status === "approved" ? "default" : resp.dr_status === "modified" ? "secondary" : "outline"}
                className="text-[10px]"
              >
                {resp.dr_status === "pending_review" ? "⏳ Pending Review" : resp.dr_status === "approved" ? "✅ Approved" : "✏️ Modified"}
              </Badge>
            </div>

            {aiRec?.text && (
              <div className="bg-background rounded-md p-3 border">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Shield className="h-3 w-3" /> AI Analysis
                </p>
                <p className="text-sm">{aiRec.text}</p>
              </div>
            )}

            {aiProducts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Pill className="h-3 w-3" /> Recommended Products
                </p>
                <div className="space-y-1">
                  {aiProducts.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-background rounded-md px-3 py-2 border text-sm">
                      <span>{p.name || p.product_name}</span>
                      {p.advice && <span className="text-xs text-muted-foreground ml-2">{p.advice}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiServices.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" /> Recommended Services
                </p>
                <div className="space-y-1">
                  {aiServices.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-background rounded-md px-3 py-2 border text-sm">
                      <span>{s.name || s.service_name}</span>
                      {s.advice && <span className="text-xs text-muted-foreground ml-2">{s.advice}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resp.dr_status === "pending_review" && (
              <div className="border-t pt-3 space-y-3">
                <Label className="text-xs font-medium">Doctor Review</Label>
                <Textarea
                  value={drNotes}
                  onChange={(e) => setDrNotes(e.target.value)}
                  placeholder="Add notes or modifications..."
                  rows={2}
                />
                <div className="flex gap-2">
                  <Select value={reviewAction || ""} onValueChange={setReviewAction}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Reviewed by" /></SelectTrigger>
                    <SelectContent>
                      {staffList.filter((s: any) => s.role === "Doctor").map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>Dr. {s.first_name} {s.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => reviewMutation.mutate({
                      responseId: resp.id,
                      status: "approved",
                      notes: drNotes,
                      reviewedBy: reviewAction || "",
                    })}
                    disabled={reviewMutation.isPending}
                  >
                    <Check className="h-3 w-3" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                    onClick={() => reviewMutation.mutate({
                      responseId: resp.id,
                      status: "modified",
                      notes: drNotes,
                      reviewedBy: reviewAction || "",
                    })}
                    disabled={reviewMutation.isPending}
                  >
                    <Pencil className="h-3 w-3" /> Modify
                  </Button>
                </div>
              </div>
            )}

            {resp.dr_status !== "pending_review" && resp.dr_notes && (
              <div className="bg-background rounded-md p-3 border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Doctor Notes</p>
                <p className="text-sm">{resp.dr_notes}</p>
                {resp.staff && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Reviewed by Dr. {resp.staff.first_name} {resp.staff.last_name}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
