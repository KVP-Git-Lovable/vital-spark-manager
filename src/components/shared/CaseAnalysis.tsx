import { useState } from "react";
import { Sparkles, Loader2, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface CaseAnalysisProps {
  patientId: string;
  patientName: string;
}

interface CaseResult {
  summary: string;
  timeline: { date: string; event: string; details: string }[];
  diagnosisHistory: string[];
  treatmentPatterns: string;
  medicationSummary: string;
  skinProgress: string;
  keyFindings: string[];
  clinicalRecommendations: string[];
}

export const CaseAnalysis = ({ patientId, patientName }: CaseAnalysisProps) => {
  const [result, setResult] = useState<CaseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/case-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ patientId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Analysis failed");
      }
      const data = await res.json();
      setResult(data.analysis);
    } catch (e: any) {
      toast.error(e.message || "Case analysis failed");
    } finally {
      setLoading(false);
    }
  };

  if (!result) {
    return (
      <Button onClick={runAnalysis} disabled={loading} variant="outline" size="sm" className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {loading ? "Analysing..." : "Case Analyse AI"}
      </Button>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm">AI Case Analysis</h3>
            <p className="text-xs text-muted-foreground">{patientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); runAnalysis(); }} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Refresh
          </Button>
          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4">
              {/* Summary */}
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Case Summary</p>
                <p className="text-sm leading-relaxed">{result.summary}</p>
              </div>

              {/* Timeline */}
              {result.timeline.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Clinical Timeline</p>
                  <div className="space-y-2 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {result.timeline.map((t, i) => (
                      <div key={i} className="flex items-start gap-3 pl-6 relative">
                        <div className="absolute left-0.5 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                        <div>
                          <p className="text-xs font-medium">{t.date} — {t.event}</p>
                          <p className="text-xs text-muted-foreground">{t.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnosis History */}
              {result.diagnosisHistory.length > 0 && (
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Diagnosis History</p>
                  {result.diagnosisHistory.map((d, i) => (
                    <p key={i} className="text-xs text-muted-foreground mb-0.5">• {d}</p>
                  ))}
                </div>
              )}

              {/* Treatment & Medication */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Treatment Patterns</p>
                  <p className="text-xs">{result.treatmentPatterns}</p>
                </div>
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Medication Summary</p>
                  <p className="text-xs">{result.medicationSummary}</p>
                </div>
              </div>

              {/* Skin Progress */}
              {result.skinProgress && (
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Skin Progress Assessment</p>
                  <p className="text-xs">{result.skinProgress}</p>
                </div>
              )}

              {/* Key Findings & Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.keyFindings.length > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary mb-2">Key Findings</p>
                    {result.keyFindings.map((f, i) => (
                      <p key={i} className="text-xs text-muted-foreground mb-1">• {f}</p>
                    ))}
                  </div>
                )}
                {result.clinicalRecommendations.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">Clinical Recommendations</p>
                    {result.clinicalRecommendations.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground mb-1">• {r}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
