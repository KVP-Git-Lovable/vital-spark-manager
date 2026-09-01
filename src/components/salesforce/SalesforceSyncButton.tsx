import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Cloud, Loader2, CircleCheck, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSalesforceSync } from "@/hooks/useSalesforceSync";

const STAGE_LABEL: Record<string, string> = {
  linking: "Linking patients",
  clinical: "Appointments, procedures & billing",
  pictures: "Photos",
  attachments: "Documents & attachments",
};

async function fetchPendingCounts() {
  const count = async (build: (q: any) => any) => {
    const { count } = await build(
      supabase.from("patients").select("id", { count: "exact", head: true }),
    );
    return count ?? 0;
  };
  const [totalPatients, linked, clinicalPending, picturesPending, attachmentsPending] = await Promise.all([
    count((q) => q),
    count((q) => q.not("sf_id", "is", null)),
    count((q) => q.not("sf_id", "is", null).is("sf_clinical_synced_at", null)),
    count((q) => q.not("sf_id", "is", null).is("sf_pictures_synced_at", null)),
    count((q) => q.not("sf_id", "is", null).is("sf_attachments_synced_at", null)),
  ]);
  return { totalPatients, linked, clinicalPending, picturesPending, attachmentsPending };
}

// Shared "Sync from Salesforce" trigger + progress panel. Safe to mount on
// multiple pages at once - they all reflect the same underlying run and
// resume automatically from whatever's still pending (nothing gets
// re-imported or missed, tracked per-patient via the sf_*_synced_at
// columns rather than by page or session).
export function SalesforceSyncButton() {
  const sync = useSalesforceSync();
  const queryClient = useQueryClient();
  const wasRunning = useRef(false);

  const { data: pending, refetch } = useQuery({
    queryKey: ["salesforce-sync-pending"],
    queryFn: fetchPendingCounts,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (wasRunning.current && !sync.running) {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      queryClient.invalidateQueries({ queryKey: ["patient-photos"] });
      if (sync.error) {
        toast.error(`Salesforce sync stopped: ${sync.error}`);
      } else if (sync.message === "Sync complete.") {
        const t = sync.totals;
        const total = t.clinical.imported + t.pictures.imported + t.attachments.imported;
        toast.success(`Salesforce sync complete — ${total} record(s) imported`);
      }
    }
    wasRunning.current = sync.running;
  }, [sync.running]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPending = pending
    ? (pending.totalPatients - pending.linked) + pending.clinicalPending + pending.picturesPending + pending.attachmentsPending
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          {sync.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
          {sync.running ? "Syncing…" : "Sync from Salesforce"}
          {!sync.running && totalPending !== undefined && totalPending > 0 && (
            <Badge variant="secondary" className="ml-1">{totalPending.toLocaleString()} pending</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Salesforce sync</p>
          <p className="text-xs text-muted-foreground">
            Pulls patients, appointments, procedures, billing, photos and documents from Salesforce.
            Already-imported records are skipped automatically — nothing gets duplicated, and nothing
            manually entered in the app is ever touched or deleted.
          </p>
        </div>

        {pending && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Patients linked</span>
            <span className="text-right font-medium text-foreground">{pending.linked.toLocaleString()} / {pending.totalPatients.toLocaleString()}</span>
            <span>Appointments/billing/procedures pending</span>
            <span className="text-right font-medium text-foreground">{pending.clinicalPending.toLocaleString()}</span>
            <span>Photos pending</span>
            <span className="text-right font-medium text-foreground">{pending.picturesPending.toLocaleString()}</span>
            <span>Documents pending</span>
            <span className="text-right font-medium text-foreground">{pending.attachmentsPending.toLocaleString()}</span>
          </div>
        )}

        {sync.stage && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              {STAGE_LABEL[sync.stage]}
            </div>
            <p className="text-muted-foreground">{sync.message}</p>
          </div>
        )}

        {!sync.running && sync.message === "Sync complete." && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CircleCheck className="h-3.5 w-3.5" /> Last run completed successfully.
          </div>
        )}
        {!sync.running && sync.error && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <CircleAlert className="h-3.5 w-3.5" /> {sync.error}
          </div>
        )}

        {sync.log.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/20 px-2 py-1.5 text-[11px] font-mono text-muted-foreground space-y-0.5">
            {sync.log.slice(-12).map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {sync.running ? (
            <Button size="sm" variant="outline" onClick={sync.stopSync}>Stop after current batch</Button>
          ) : (
            <Button size="sm" onClick={sync.startSync} className="gap-1.5">
              <Cloud className="h-3.5 w-3.5" />
              Sync from Salesforce
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
