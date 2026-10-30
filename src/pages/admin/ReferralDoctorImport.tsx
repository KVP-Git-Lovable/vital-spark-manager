import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Download, Stethoscope, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { referralFieldCandidates, type SfField } from "@/lib/salesforceReferral";

/**
 * Fetching the referring doctors Salesforce still holds.
 *
 * The migration brought the referral FLAG across and not the NAME: 152
 * patients read "Reference - other Dr" and none of them says who sent them.
 * The Salesforce connector is already wired up, so the names can still be
 * fetched - what nobody knew was which Salesforce field holds them.
 *
 * So this asks Salesforce what it has rather than guessing. Step 1 lists the
 * fields whose names suggest a referral, with how often each is filled in;
 * a human picks one; step 2 shows what would be written without writing it;
 * step 3 writes, filling only the patients that have nothing recorded.
 */

interface ImportResult {
  ok: boolean;
  field?: string;
  applied?: boolean;
  waiting?: number;
  found?: number;
  placeholdersIgnored?: number;
  filled?: number;
  sample?: { sf_id: string; name: string }[];
  note?: string;
  error?: string;
}

export default function ReferralDoctorImport() {
  const [busy, setBusy] = useState<"" | "describe" | "preview" | "apply">("");
  const [candidates, setCandidates] = useState<SfField[] | null>(null);
  const [allFields, setAllFields] = useState<SfField[]>([]);
  const [field, setField] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const describe = async () => {
    setBusy("describe");
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sf-describe-patient-fields", {
        body: {},
      });
      if (error) throw error;
      const fields: SfField[] = data?.fields || [];
      setAllFields(fields);
      setCandidates(referralFieldCandidates(fields));
      if (fields.length === 0) toast.error("Salesforce returned no fields.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const run = async (apply: boolean) => {
    if (!field) return;
    setBusy(apply ? "apply" : "preview");
    try {
      const { data, error } = await supabase.functions.invoke("sf-import-referral-doctor", {
        body: { field, apply },
      });
      if (error) throw error;
      setResult(data as ImportResult);
      if (data?.ok === false) toast.error(data.error || "Salesforce call failed");
      else if (apply) toast.success(`Filled in ${data?.filled ?? 0} referring doctor(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Stethoscope className="h-5 w-5" /> Referring Doctors from Salesforce
        </h1>
        <p className="page-subtitle">
          The migration brought the referral across but not the doctor's name. This fetches the
          names Salesforce still holds, for the patients that have none.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium text-sm">1 · Find the field</h2>
            <p className="text-xs text-muted-foreground">
              Asks Salesforce what it holds. Nothing is written, and no patient details are read —
              only which fields exist and how often they are filled in.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={describe} disabled={!!busy}>
            {busy === "describe" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Ask Salesforce</span>
          </Button>
        </div>

        {candidates && (
          <div className="space-y-2">
            {candidates.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
                None of the {allFields.length} fields on the Salesforce patient looks like a
                referring doctor. The name may live on a different Salesforce object — worth asking
                whoever set Salesforce up.
              </p>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Fields that could hold the referring doctor, most filled in first. Pick the right
                  one — a wrong field would write the wrong thing onto patient records.
                </p>
                <div className="flex flex-wrap gap-2">
                  {candidates.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => { setField(c.name); setResult(null); }}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                        field === c.name ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-mono">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        filled on {c.pct}% of {c.of} sampled
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium text-sm">2 · See what would be filled</h2>
            <p className="text-xs text-muted-foreground">
              {field ? <>Reads <span className="font-mono">{field}</span> for the patients that have no doctor recorded. Writes nothing.</>
                     : "Pick a field above first."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => run(false)} disabled={!field || !!busy}>
            {busy === "preview" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Preview</span>
          </Button>
        </div>

        {result?.ok && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{result.waiting} waiting</Badge>
              <Badge variant="outline">{result.found} found in Salesforce</Badge>
              {!!result.placeholdersIgnored && (
                <Badge variant="outline">{result.placeholdersIgnored} blank placeholders ignored</Badge>
              )}
              {result.applied && <Badge>{result.filled} filled in</Badge>}
            </div>
            {!!result.sample?.length && (
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">First few, to check the field is the right one:</p>
                <ul className="font-mono text-[11px] space-y-0.5">
                  {result.sample.map((s) => <li key={s.sf_id}>{s.name}</li>)}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">{result.note}</p>
          </div>
        )}
        {result?.ok === false && (
          <p className="text-xs text-destructive">{result.error}</p>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium text-sm">3 · Fill them in</h2>
            <p className="text-xs text-muted-foreground">
              Only patients referred by a doctor, and only where nothing is recorded. A name typed
              in here is never replaced, and every change is kept so it can be traced.
            </p>
          </div>
          <Button size="sm" onClick={() => run(true)} disabled={!field || !!busy || !result?.ok}>
            {busy === "apply" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span className={busy === "apply" ? "ml-1.5" : ""}>Import</span>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Preview first — the Import button stays off until you have.
        </p>
      </Card>
    </div>
  );
}
