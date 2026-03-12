import { useEffect, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface EngagementData {
  score: number;
  tier: string;
  tierEmoji: string;
  breakdown: {
    visitFrequency: number;
    revenueValue: number;
    treatmentDepth: number;
    retentionSignal: number;
    compliance: number;
  };
  stats: {
    totalAppointments: number;
    completedAppointments: number;
    totalProcedures: number;
    distinctServices: number;
    totalBilled: number;
    daysSinceLastVisit: number;
  };
}

const tierStyles: Record<string, string> = {
  Platinum: "bg-violet-100 text-violet-700 border-violet-200",
  Gold: "bg-amber-100 text-amber-700 border-amber-200",
  Silver: "bg-slate-100 text-slate-600 border-slate-200",
  Early: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

const factorLabels = [
  { key: "visitFrequency", label: "Visit Frequency", max: 30, color: "bg-blue-500" },
  { key: "revenueValue", label: "Revenue Value", max: 25, color: "bg-amber-500" },
  { key: "treatmentDepth", label: "Treatment Depth", max: 20, color: "bg-purple-500" },
  { key: "retentionSignal", label: "Retention Signal", max: 15, color: "bg-emerald-500" },
  { key: "compliance", label: "Compliance", max: 10, color: "bg-rose-500" },
];

export const EngagementScoreCard = ({ patientId }: { patientId: string }) => {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScore = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patient-engagement`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ patientIds: [patientId] }),
        });
        if (res.ok) {
          const json = await res.json();
          setData(json.scores?.[patientId] || null);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchScore();
  }, [patientId]);

  if (loading) {
    return (
      <div className="stat-card p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="stat-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Engagement Score</h3>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-semibold ${tierStyles[data.tier] || tierStyles.Early}`}>
          {data.tierEmoji} {data.tier}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-4">
        <span className="text-3xl font-bold">{data.score}</span>
        <span className="text-sm text-muted-foreground mb-1">/100</span>
      </div>

      <div className="space-y-2.5">
        {factorLabels.map((f) => {
          const value = data.breakdown[f.key as keyof typeof data.breakdown];
          const pct = (value / f.max) * 100;
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium">{value}/{f.max}</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${f.color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t">
        <div className="text-center">
          <p className="text-lg font-bold">{data.stats.totalAppointments}</p>
          <p className="text-[10px] text-muted-foreground">Visits</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{data.stats.distinctServices}</p>
          <p className="text-[10px] text-muted-foreground">Services</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">₹{(data.stats.totalBilled / 1000).toFixed(1)}k</p>
          <p className="text-[10px] text-muted-foreground">Billed</p>
        </div>
      </div>
    </div>
  );
};
