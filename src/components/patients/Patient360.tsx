import { useState } from "react";
import { Sparkles, Loader2, Star, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronRight, Activity, IndianRupee, CalendarDays, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Patient360Props {
  patientId: string;
  patientName: string;
}

interface Analysis {
  patientRating: number;
  ratingLabel: string;
  visitFrequency: string;
  avgDaysBetweenVisits: number | null;
  prediction: string;
  predictionConfidence: number;
  totalLifetimeValue: number;
  insights: string[];
  nextVisitEstimate: string;
  engagementScore: number;
  riskFactors: string[];
  opportunities: string[];
}

interface RawStats {
  totalVisits: number;
  totalProcedures: number;
  totalSpend: number;
  totalPaid: number;
  uniqueServices: number;
  noShowCount: number;
}

const predictionConfig: Record<string, { color: string; icon: any; bg: string }> = {
  Growth: { color: "text-emerald-600", icon: TrendingUp, bg: "bg-emerald-50 border-emerald-200" },
  Stable: { color: "text-blue-600", icon: Minus, bg: "bg-blue-50 border-blue-200" },
  Slow: { color: "text-amber-600", icon: TrendingDown, bg: "bg-amber-50 border-amber-200" },
  "Churn Risk": { color: "text-red-600", icon: AlertTriangle, bg: "bg-red-50 border-red-200" },
};

export const Patient360 = ({ patientId, patientName }: Patient360Props) => {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rawStats, setRawStats] = useState<RawStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patient-360`, {
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
      setAnalysis(data.analysis);
      setRawStats(data.rawStats);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate analysis");
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-dashed border-primary/30 rounded-xl p-6 text-center bg-primary/5"
      >
        <Sparkles className="h-8 w-8 mx-auto text-primary mb-3" />
        <h3 className="font-display font-semibold text-lg">AI Patient 360°</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Get AI-powered insights on {patientName}'s engagement, visit patterns, and growth prediction.
        </p>
        <Button onClick={fetchAnalysis} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Analyzing..." : "Generate Patient 360°"}
        </Button>
      </motion.div>
    );
  }

  const pred = predictionConfig[analysis.prediction] || predictionConfig.Stable;
  const PredIcon = pred.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm">AI Patient 360°</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={`text-[10px] ${pred.bg} ${pred.color} border`}>{analysis.prediction}</Badge>
              <span className="text-xs text-muted-foreground">{analysis.ratingLabel} Patient</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); fetchAnalysis(); }} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Refresh
          </Button>
          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Top metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Rating */}
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Rating</p>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < analysis.patientRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{analysis.ratingLabel}</p>
                </div>

                {/* Prediction */}
                <div className={`rounded-lg border p-3 ${pred.bg}`}>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prediction</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <PredIcon className={`h-5 w-5 ${pred.color}`} />
                    <span className={`font-semibold text-sm ${pred.color}`}>{analysis.prediction}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{analysis.predictionConfidence}% confidence</p>
                </div>

                {/* Engagement */}
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Engagement</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-lg">{analysis.engagementScore}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full mt-1.5">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${analysis.engagementScore}%` }} />
                  </div>
                </div>

                {/* Lifetime Value */}
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Lifetime Value</p>
                  <div className="flex items-center gap-1 mt-1">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-lg">₹{Number(analysis.totalLifetimeValue).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{rawStats?.totalProcedures || 0} procedures</p>
                </div>
              </div>

              {/* Visit pattern row */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Visit Frequency</p>
                  <p className="font-semibold text-sm mt-1">{analysis.visitFrequency}</p>
                  {analysis.avgDaysBetweenVisits && <p className="text-xs text-muted-foreground">~{analysis.avgDaysBetweenVisits} days apart</p>}
                </div>
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Target className="h-3 w-3" /> Next Visit</p>
                  <p className="font-semibold text-sm mt-1">{analysis.nextVisitEstimate}</p>
                </div>
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Quick Stats</p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span><strong>{rawStats?.totalVisits || 0}</strong> visits</span>
                    <span><strong>{rawStats?.uniqueServices || 0}</strong> services</span>
                    <span className={rawStats?.noShowCount ? "text-destructive" : ""}><strong>{rawStats?.noShowCount || 0}</strong> no-shows</span>
                  </div>
                </div>
              </div>

              {/* Insights */}
              {analysis.insights.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Key Insights</p>
                  <div className="space-y-1.5">
                    {analysis.insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5 shrink-0">•</span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk & Opportunities side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.riskFactors.length > 0 && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1 mb-2"><AlertTriangle className="h-3 w-3" /> Risk Factors</p>
                    {analysis.riskFactors.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground mb-1">• {r}</p>
                    ))}
                  </div>
                )}
                {analysis.opportunities.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mb-2"><TrendingUp className="h-3 w-3" /> Opportunities</p>
                    {analysis.opportunities.map((o, i) => (
                      <p key={i} className="text-xs text-muted-foreground mb-1">• {o}</p>
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
