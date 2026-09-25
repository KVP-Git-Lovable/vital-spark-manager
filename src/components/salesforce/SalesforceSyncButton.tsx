import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Cloud, Loader2, CircleCheck, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSalesforceSync } from "@/hooks/useSalesforceSync";
import { recentSyncWindow } from "@/lib/salesforceSyncWindow";
import { getSalesforcePatientTotal } from "@/lib/salesforceSyncStore";

const STAGE_LABEL: Record<string, string> = {
  patients: "Importing patients",
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
  // Salesforce's own patient count, from the last completed all-patients walk.
  // Null until one has run, in which case the shortfall is simply not claimed
  // rather than guessed at.
  const sfTotal = getSalesforcePatientTotal();
  return {
    totalPatients,
    linked,
    clinicalPending,
    picturesPending,
    attachmentsPending,
    sfTotal,
    notYetImported: sfTotal ? Math.max(0, sfTotal - linked) : 0,
  };
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
  const [panelOpen, setPanelOpen] = useState(false);

  const runRecent = (daysBack: number, daysForward = 0) => {
    const { start, end } = recentSyncWindow(daysBack, daysForward);
    sync.startRecentSync(start, end);
  };


  const { data: pending, refetch } = useQuery({
    queryKey: ["salesforce-sync-pending"],
    queryFn: fetchPendingCounts,
    staleTime: 30_000,
    // These figures used to be refetched only once the whole run finished, so
    // for the length of a sync they sat frozen on whatever they were when the
    // panel mounted - a sync that was working perfectly read as hung.
    //
    // Only while the panel is actually on screen, though: fetchPendingCounts is
    // five exact counts over 27k rows, and PopoverContent is unmounted when
    // closed, so polling a closed panel would burn thousands of queries
    // updating nothing (the trigger badge is hidden mid-run anyway).
    refetchInterval: sync.running && panelOpen ? 10_000 : false,
  });

  useEffect(() => {
    if (wasRunning.current && !sync.running) {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices-page"] });
      queryClient.invalidateQueries({ queryKey: ["invoices-bounded"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      queryClient.invalidateQueries({ queryKey: ["patient-photos"] });
      if (sync.error) {
        toast.error(`Salesforce sync stopped: ${sync.error}`);
      } else if (sync.message === "Sync complete.") {
        const t = sync.totals;
        const total = t.patients.imported + t.clinical.imported + t.pictures.imported + t.attachments.imported;
        toast.success(`Salesforce sync complete — ${total} record(s) imported`);
      }
    }
    wasRunning.current = sync.running;
  }, [sync.running]); // eslint-disable-line react-hooks/exhaustive-deps

  // Two different gaps here, and only one of them is outstanding work.
  // (totalPatients - linked) is mostly app-only patients - walk-ins and manual
  // entries that will never have a Salesforce match - so it stays out of the
  // badge, as it always has. What does belong is the shortfall against
  // Salesforce's own patient count: patients that exist there and have never
  // been imported here at all. Those carry no sf_id, so every other count below
  // is structurally blind to them, which is how ~3,669 of them sat missing
  // while this badge read as if only documents were outstanding.
  const totalPending = pending
    ? pending.clinicalPending + pending.picturesPending + pending.attachmentsPending + pending.notYetImported
    : undefined;
  const unmatchedPatients = pending ? pending.totalPatients - pending.linked : 0;

  // Counted in memory and pushed on every batch, so this ticks over without
  // costing a query - and it keeps moving through the patients stage, where
  // the imported count legitimately stays at zero because those patients have
  // no visits to bring across.
  const stage = sync.stage;
  const stageTotals = stage ? sync.totals[stage] : null;

  return (
    <Popover open={panelOpen} onOpenChange={setPanelOpen}>
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
            manually entered in the app is ever touched or deleted. Anything you have deleted here
            stays deleted: the sync will not bring it back.
          </p>
        </div>

        {pending && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Patients linked</span>
            <span className="text-right font-medium text-foreground">{pending.linked.toLocaleString()} / {pending.totalPatients.toLocaleString()}</span>
            {unmatchedPatients > 0 && (
              <span className="col-span-2 text-[11px] text-muted-foreground/80">
                {unmatchedPatients.toLocaleString()} have no Salesforce match by phone — likely app-only patients, not outstanding sync work.
              </span>
            )}
            {pending.sfTotal !== null && (
              <>
                <span>Patients not yet imported</span>
                <span className="text-right font-medium text-foreground">{pending.notYetImported.toLocaleString()}</span>
              </>
            )}
            <span>Appointments/billing/procedures pending</span>
            <span className="text-right font-medium text-foreground">{pending.clinicalPending.toLocaleString()}</span>
            <span>Photos pending</span>
            <span className="text-right font-medium text-foreground">{pending.picturesPending.toLocaleString()}</span>
            <span>Documents pending</span>
            <span className="text-right font-medium text-foreground">{pending.attachmentsPending.toLocaleString()}</span>
          </div>
        )}

        {stage && stageTotals && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              {STAGE_LABEL[stage]}
            </div>
            <p className="text-muted-foreground">{sync.message}</p>
            <p className="text-muted-foreground tabular-nums">
              {stageTotals.processed.toLocaleString()} processed
              {stageTotals.imported > 0 && ` · ${stageTotals.imported.toLocaleString()} imported`}
              {stageTotals.errors > 0 && ` · ${stageTotals.errors.toLocaleString()} error(s)`}
            </p>
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

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium">Bring in appointments by date</p>
          <p className="text-[11px] text-muted-foreground">
            Matches on the appointment's own date, not when it was booked — so pick a range that
            covers the days you want, including days still to come. Patients who exist only in
            Salesforce are created as they are found.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={sync.running} onClick={() => runRecent(0)}>Today</Button>
            <Button size="sm" variant="secondary" disabled={sync.running} onClick={() => runRecent(7)}>Last 7 days</Button>
            <Button size="sm" variant="secondary" disabled={sync.running} onClick={() => runRecent(30)}>Last 30 days</Button>
            <Button size="sm" variant="secondary" disabled={sync.running} onClick={() => runRecent(0, 7)}>Next 7 days</Button>
            <Button size="sm" variant="secondary" disabled={sync.running} onClick={() => runRecent(0, 30)}>Next 30 days</Button>
            <Button size="sm" variant="secondary" disabled={sync.running} onClick={() => runRecent(30, 60)}>Last 30 + next 60</Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          {sync.running ? (
            <Button size="sm" variant="outline" onClick={sync.stopSync}>Stop after current batch</Button>
          ) : (
            <Button size="sm" onClick={sync.startSync} className="gap-1.5">
              <Cloud className="h-3.5 w-3.5" />
              Sync everything
            </Button>
          )}
        </div>

      </PopoverContent>
    </Popover>
  );
}
