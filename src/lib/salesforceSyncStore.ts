import { supabase } from "@/integrations/supabase/client";

export type SyncStage = "linking" | "clinical" | "pictures" | "attachments";

export interface StageTotals {
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
}

interface SyncState {
  running: boolean;
  stage: SyncStage | null;
  message: string;
  log: string[];
  totals: Record<SyncStage, StageTotals>;
  error: string | null;
}

function initialTotals(): Record<SyncStage, StageTotals> {
  return {
    linking: { processed: 0, imported: 0, skipped: 0, errors: 0 },
    clinical: { processed: 0, imported: 0, skipped: 0, errors: 0 },
    pictures: { processed: 0, imported: 0, skipped: 0, errors: 0 },
    attachments: { processed: 0, imported: 0, skipped: 0, errors: 0 },
  };
}

let state: SyncState = {
  running: false,
  stage: null,
  message: "",
  log: [],
  totals: initialTotals(),
  error: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeSync(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSyncState() {
  return state;
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  emit();
}

function pushLog(msg: string) {
  state = { ...state, log: [...state.log.slice(-49), msg] };
  emit();
}

function addTotals(stage: SyncStage, delta: Partial<StageTotals>) {
  const current = state.totals[stage];
  state = {
    ...state,
    totals: {
      ...state.totals,
      [stage]: {
        processed: current.processed + (delta.processed ?? 0),
        imported: current.imported + (delta.imported ?? 0),
        skipped: current.skipped + (delta.skipped ?? 0),
        errors: current.errors + (delta.errors ?? 0),
      },
    },
  };
  emit();
}

let stopRequested = false;

export function stopSync() {
  if (!state.running) return;
  stopRequested = true;
  pushLog("Stopping after the current batch…");
}

async function invoke(nameWithQuery: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke(nameWithQuery);
  if (error) throw new Error(`${nameWithQuery.split("?")[0]}: ${error.message}`);
  if (!data?.ok) throw new Error(`${nameWithQuery.split("?")[0]}: ${data?.error || "request failed"}`);
  return data;
}

async function loopLinking() {
  let offset = 0;
  for (;;) {
    if (stopRequested) return;
    const data = await invoke(`sf-match-phones?apply=true&apply_offset=${offset}&apply_limit=2000`);
    addTotals("linking", { processed: data.updated ?? 0, imported: data.updated ?? 0 });
    pushLog(`Linking: matched ${data.updated ?? 0} patient(s) by phone number`);
    if (data.next_apply_offset === null || data.next_apply_offset === undefined) return;
    offset = data.next_apply_offset;
  }
}

async function loopClinical() {
  for (;;) {
    if (stopRequested) return;
    const data = await invoke("sf-import-clinical?limit=25");
    const results: any[] = data.results || [];
    const imported = results.reduce((s, r) => s + (r.appointments || 0) + (r.invoices || 0) + (r.procedures || 0), 0);
    const skipped = results.reduce((s, r) => s + (r.skipped || 0), 0);
    const errors = results.reduce((s, r) => s + (r.errors?.length || 0), 0);
    addTotals("clinical", { processed: data.processed ?? 0, imported, skipped, errors });
    pushLog(`Clinical: processed ${data.processed ?? 0} patient(s), ${imported} record(s) imported`);
    if (!data.processed) return;
  }
}

async function loopPictures() {
  for (;;) {
    if (stopRequested) return;
    const data = await invoke("sf-import-pictures?limit=12");
    const results: any[] = data.results || [];
    const imported = results.reduce((s, r) => s + (r.imported || 0), 0);
    const skipped = results.reduce((s, r) => s + (r.skipped || 0), 0);
    addTotals("pictures", { processed: data.processed ?? 0, imported, skipped, errors: data.error_count || 0 });
    pushLog(`Photos: processed ${data.processed ?? 0} patient(s), ${imported} photo(s) imported`);
    if (!data.processed) return;
  }
}

async function loopAttachments() {
  for (;;) {
    if (stopRequested) return;
    const data = await invoke("sf-import-attachments?limit=12");
    const results: any[] = data.results || [];
    const imported = results.reduce((s, r) => s + (r.imported || 0), 0);
    const skipped = results.reduce((s, r) => s + (r.skipped || 0), 0);
    addTotals("attachments", { processed: data.processed ?? 0, imported, skipped, errors: data.error_count || 0 });
    pushLog(`Attachments: processed ${data.processed ?? 0} patient(s), ${imported} file(s) imported`);
    if (!data.processed) return;
  }
}

export async function startSync() {
  if (state.running) return;
  stopRequested = false;
  setState({ running: true, error: null, log: [], totals: initialTotals(), message: "Starting…" });
  try {
    setState({ stage: "linking", message: "Linking patients to Salesforce by phone number…" });
    await loopLinking();
    if (stopRequested) { setState({ running: false, stage: null, message: "Stopped." }); return; }

    setState({ stage: "clinical", message: "Syncing appointments, procedures & invoices…" });
    await loopClinical();
    if (stopRequested) { setState({ running: false, stage: null, message: "Stopped." }); return; }

    setState({ stage: "pictures", message: "Syncing before/after photos…" });
    await loopPictures();
    if (stopRequested) { setState({ running: false, stage: null, message: "Stopped." }); return; }

    setState({ stage: "attachments", message: "Syncing documents & attachments…" });
    await loopAttachments();

    setState({ running: false, stage: null, message: "Sync complete." });
    pushLog("All stages complete.");
  } catch (e: any) {
    setState({ running: false, stage: null, error: e.message, message: `Failed: ${e.message}` });
    pushLog(`Error: ${e.message}`);
  }
}
