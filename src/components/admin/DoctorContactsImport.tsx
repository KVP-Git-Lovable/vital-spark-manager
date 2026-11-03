import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Bringing the referring doctors' phone numbers across from Salesforce.
 *
 * The clinic asked for these directly: Salesforce holds the doctors with
 * their contact numbers, and this database has an external_doctors table
 * with phone, email and clinic columns standing empty.
 *
 * WHICH Salesforce object holds the doctors is not guessed. Step 1 lists
 * what the org actually has, a human picks the object and names the fields,
 * step 2 shows exactly what would be written, step 3 writes. The same shape
 * as the referring-doctor name import beside it, for the same reason: a
 * guess at somebody else's schema puts a mobile number in a column labelled
 * clinic and nobody notices for a year.
 *
 * Fill-only in both directions. A doctor already on the clinic's list keeps
 * the name as they spell it and only gains a contact detail where that
 * column is empty, so anything typed at the front desk outranks Salesforce.
 */
interface ContactsResult {
  ok: boolean;
  error?: string;
  applied?: boolean;
  salesforceRows?: number;
  withoutAName?: number;
  distinctDoctors?: number;
  wouldInsert?: number;
  wouldFill?: number;
  inserted?: number;
  filled?: number;
  sampleNew?: { name: string; phone: string | null; clinic_name: string | null }[];
  sampleFilled?: Record<string, string>[];
  note?: string;
}

export function DoctorContactsImport() {
  const [objects, setObjects] = useState<string[]>([]);
  const [object, setObject] = useState("");
  const [nameField, setNameField] = useState("");
  const [phoneField, setPhoneField] = useState("");
  const [emailField, setEmailField] = useState("");
  const [clinicField, setClinicField] = useState("");
  const [busy, setBusy] = useState<null | "list" | "preview" | "apply">(null);
  const [result, setResult] = useState<ContactsResult | null>(null);

  const listObjects = async () => {
    setBusy("list");
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sf-describe-patient-fields", { body: {} });
      if (error) throw error;
      const names: string[] = (data?.objects || []).map((o: { name?: string } | string) =>
        typeof o === "string" ? o : String(o?.name ?? ""),
      ).filter(Boolean);
      setObjects(names);
      if (names.length === 0) toast.error("Salesforce returned no objects.");
      else toast.success(`${names.length} Salesforce objects`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const run = async (apply: boolean) => {
    if (!object || !nameField) {
      toast.error("Name the Salesforce object and the field holding the doctor's name");
      return;
    }
    setBusy(apply ? "apply" : "preview");
    try {
      const { data, error } = await supabase.functions.invoke("sf-import-doctor-contacts", {
        body: { object, nameField, phoneField, emailField, clinicField, apply },
      });
      if (error) throw error;
      setResult(data as ContactsResult);
      if (data?.ok === false) toast.error(data.error || "Salesforce call failed");
      else if (apply) toast.success(`${data?.inserted ?? 0} doctor(s) added, ${data?.filled ?? 0} updated`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const likelyObjects = objects.filter((o) => /doctor|referr|physician|consultant|contact|account/i.test(o));

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Phone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold font-display">Doctor contact details from Salesforce</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Brings referring doctors' phone, email and clinic into the clinic's own doctor list. Nothing a
        receptionist typed here is ever overwritten — only empty fields are filled, and doctors who are
        missing are added.
      </p>

      <div className="space-y-3">
        <Button variant="outline" size="sm" onClick={listObjects} disabled={busy !== null} className="min-h-11 gap-2 sm:min-h-0">
          {busy === "list" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          1. List what Salesforce has
        </Button>

        {objects.length > 0 && (
          <div className="space-y-2">
            {likelyObjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-muted-foreground self-center">Likely:</span>
                {likelyObjects.slice(0, 12).map((o) => (
                  <Badge key={o} variant={object === o ? "default" : "outline"}
                    className="cursor-pointer text-xs" onClick={() => setObject(o)}>{o}</Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{objects.length} objects available.</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="sf-object" className="text-xs">Salesforce object *</Label>
            <Input id="sf-object" value={object} onChange={(e) => setObject(e.target.value)} placeholder="e.g. Referring_Doctor__c" />
          </div>
          <div>
            <Label htmlFor="sf-name" className="text-xs">Name field *</Label>
            <Input id="sf-name" value={nameField} onChange={(e) => setNameField(e.target.value)} placeholder="e.g. Name" />
          </div>
          <div>
            <Label htmlFor="sf-phone" className="text-xs">Phone field</Label>
            <Input id="sf-phone" value={phoneField} onChange={(e) => setPhoneField(e.target.value)} placeholder="e.g. Phone__c" />
          </div>
          <div>
            <Label htmlFor="sf-email" className="text-xs">Email field</Label>
            <Input id="sf-email" value={emailField} onChange={(e) => setEmailField(e.target.value)} placeholder="e.g. Email__c" />
          </div>
          <div>
            <Label htmlFor="sf-clinic" className="text-xs">Clinic / hospital field</Label>
            <Input id="sf-clinic" value={clinicField} onChange={(e) => setClinicField(e.target.value)} placeholder="e.g. Hospital__c" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => run(false)} disabled={busy !== null} className="min-h-11 gap-2 sm:min-h-0">
            {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            2. Preview — writes nothing
          </Button>
          <Button size="sm" onClick={() => run(true)} disabled={busy !== null || !result?.ok} className="min-h-11 gap-2 sm:min-h-0">
            {busy === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            3. Import
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
          {result.ok === false ? (
            <p className="text-destructive">{result.error}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <span><strong>{result.salesforceRows ?? 0}</strong> rows in Salesforce</span>
                <span><strong>{result.distinctDoctors ?? 0}</strong> distinct doctors</span>
                <span><strong>{result.applied ? result.inserted : result.wouldInsert}</strong> {result.applied ? "added" : "to add"}</span>
                <span><strong>{result.applied ? result.filled : result.wouldFill}</strong> {result.applied ? "updated" : "to update"}</span>
                {!!result.withoutAName && <span className="text-muted-foreground">{result.withoutAName} with no name, skipped</span>}
              </div>
              {!!result.sampleNew?.length && (
                <div>
                  <p className="text-xs font-medium">New doctors (first few)</p>
                  <ul className="text-xs text-muted-foreground">
                    {result.sampleNew.map((d, i) => (
                      <li key={i}>{d.name}{d.phone ? ` — ${d.phone}` : " — no phone"}{d.clinic_name ? ` · ${d.clinic_name}` : ""}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.note && <p className="text-xs text-muted-foreground">{result.note}</p>}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
