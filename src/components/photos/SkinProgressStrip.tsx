import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { measureLabel, progressLabel, type SkinProgressRow } from "@/lib/skinProgress";

/**
 * The AI's improvement figure, on the patient's own record.
 *
 * One quiet line above the photo grid - the two measures the clinic asked
 * for, first photo to latest and since the previous photo - and nothing at
 * all when the runner has not reached this patient. Deliberately not a card,
 * a tab or a panel: the photo tab's layout is unchanged.
 *
 * A pair the AI would not vouch for prints its reason instead of a figure.
 * That is the point of showing it this way: "not comparable - one photo is of
 * the face, the other of a forearm" tells a clinician something true, where a
 * 0% would be a lie about the same two photos.
 */
export function SkinProgressStrip({ patientId }: { patientId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["skin-progress", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skin_progress")
        .select("measure,improvement,comparable,not_comparable_reason,computed_at")
        .eq("patient_id", patientId);
      if (error) throw error;
      return (data ?? []) as SkinProgressRow[];
    },
    enabled: !!patientId,
  });

  if (rows.length === 0) return null;

  // Overall first, then the recent change - the order a clinician reads them.
  const order = ["overall", "since_last"];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.measure) - order.indexOf(b.measure));
  const computed = sorted.find((r) => r.computed_at)?.computed_at;

  return (
    <div className="mb-3 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> AI skin progress
        </span>
        {sorted.map((row) => (
          <span key={row.measure} className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground">{measureLabel(row.measure)}:</span>
            <span className={row.comparable ? "font-semibold text-foreground" : "text-muted-foreground italic"}>
              {progressLabel(row)}
            </span>
          </span>
        ))}
        {computed && (
          <span className="text-muted-foreground">
            computed {format(new Date(computed), "d MMM yyyy")}
          </span>
        )}
      </div>
    </div>
  );
}
