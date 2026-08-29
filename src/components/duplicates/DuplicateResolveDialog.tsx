import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Merge, Link2, Loader2 } from "lucide-react";

export interface ResolveTargets {
  /** Record kept after resolution. */
  primaryId: string;
  /** Record folded into the primary. */
  duplicateId: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  primary: Record<string, any> | null;
  duplicate: Record<string, any> | null;
  /** Called after a successful merge/link with the mode used. */
  onResolved?: (mode: "merged" | "linked", kept: string) => void;
}

const label = (p: Record<string, any> | null) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.phone || "Patient" : "—";

/** Tables that hold patient-owned records and can be carried over on merge. */
const CARRY_GROUPS = [
  { key: "appointments", label: "Appointments", tables: ["appointments"] },
  { key: "invoices", label: "Invoices & bills", tables: ["invoices", "pharma_bills"] },
  {
    key: "clinical",
    label: "Clinical records (procedures, prescriptions, photos, surveys)",
    tables: ["procedures", "prescriptions", "patient_photos", "survey_responses", "therapy_notes"],
  },
] as const;

export default function DuplicateResolveDialog({ open, onClose, primary, duplicate, onResolved }: Props) {
  const [keepId, setKeepId] = useState<string>("");
  const [carry, setCarry] = useState<Record<string, boolean>>({ appointments: true, invoices: true, clinical: true });
  const [fillBlanks, setFillBlanks] = useState(true);
  const [deactivate, setDeactivate] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && primary) setKeepId(primary.id);
  }, [open, primary?.id]);

  const kept = keepId === duplicate?.id ? duplicate : primary;
  const dropped = keepId === duplicate?.id ? primary : duplicate;

  const diffRows = useMemo(() => {
    if (!primary || !duplicate) return [];
    const keys = ["first_name", "last_name", "phone", "email", "date_of_birth", "gender", "city", "status"];
    return keys.map((k) => ({ key: k, a: primary[k], b: duplicate[k] }));
  }, [primary, duplicate]);

  const run = async (mode: "merged" | "linked") => {
    if (!kept || !dropped) return;
    setBusy(true);
    try {
      if (mode === "merged") {
        if (fillBlanks) {
          const patch: Record<string, any> = {};
          Object.entries(dropped).forEach(([k, v]) => {
            if (["id", "created_at", "updated_at"].includes(k)) return;
            const cur = (kept as any)[k];
            if ((cur === null || cur === undefined || cur === "") && v !== null && v !== undefined && v !== "") {
              patch[k] = v;
            }
          });
          if (Object.keys(patch).length) {
            const { error } = await supabase.from("patients").update(patch).eq("id", kept.id);
            if (error) throw error;
          }
        }

        for (const group of CARRY_GROUPS) {
          if (!carry[group.key]) continue;
          for (const table of group.tables) {
            const { error } = await (supabase as any)
              .from(table)
              .update({ patient_id: kept.id })
              .eq("patient_id", dropped.id);
            if (error && !/column .* does not exist|relation .* does not exist/i.test(error.message)) throw error;
          }
        }

        if (deactivate) {
          const { error } = await supabase.from("patients").update({ status: "Inactive" } as any).eq("id", dropped.id);
          if (error) throw error;
        }
      }

      await (supabase as any)
        .from("duplicate_alerts")
        .update({ status: mode, resolved_at: new Date().toISOString() })
        .or(
          `and(record_id.eq.${kept.id},match_record_id.eq.${dropped.id}),and(record_id.eq.${dropped.id},match_record_id.eq.${kept.id})`,
        );

      toast({
        title: mode === "merged" ? "Records merged" : "Records linked",
        description:
          mode === "merged"
            ? `${label(dropped)} was folded into ${label(kept)}.`
            : `Both records were kept and marked as reviewed.`,
      });
      onResolved?.(mode, kept.id);
      onClose();
    } catch (e: any) {
      toast({ title: "Could not resolve duplicate", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-primary" /> Resolve duplicate patients
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Which record should be kept?</Label>
            <RadioGroup value={keepId} onValueChange={setKeepId} className="grid gap-2 sm:grid-cols-2">
              {[primary, duplicate].filter(Boolean).map((p: any) => (
                <Card key={p.id} className={"p-3 " + (keepId === p.id ? "border-primary ring-1 ring-primary" : "")}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <RadioGroupItem value={p.id} className="mt-1" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{label(p)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.phone || "no phone"}
                        {p.email ? ` · ${p.email}` : ""}
                      </div>
                      {keepId === p.id && <Badge className="mt-1">Keep</Badge>}
                    </div>
                  </label>
                </Card>
              ))}
            </RadioGroup>
          </div>

          <Card className="p-3">
            <div className="text-xs font-medium mb-2">Field comparison</div>
            <div className="space-y-1 text-xs">
              {diffRows.map((r) => (
                <div key={r.key} className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">{r.key.replace(/_/g, " ")}</span>
                  <span className="truncate">{String(r.a ?? "—")}</span>
                  <span className={"truncate " + (String(r.a ?? "") !== String(r.b ?? "") ? "text-amber-600" : "")}>
                    {String(r.b ?? "—")}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-2">
            <Label>Carry over to the kept record</Label>
            {CARRY_GROUPS.map((g) => (
              <div key={g.key} className="flex items-center gap-2">
                <Checkbox
                  id={`carry-${g.key}`}
                  checked={!!carry[g.key]}
                  onCheckedChange={(v) => setCarry((c) => ({ ...c, [g.key]: !!v }))}
                />
                <Label htmlFor={`carry-${g.key}`} className="text-sm font-normal">{g.label}</Label>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Checkbox id="fill-blanks" checked={fillBlanks} onCheckedChange={(v) => setFillBlanks(!!v)} />
              <Label htmlFor="fill-blanks" className="text-sm font-normal">
                Fill empty fields on the kept record from the duplicate
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="deactivate" checked={deactivate} onCheckedChange={(v) => setDeactivate(!!v)} />
              <Label htmlFor="deactivate" className="text-sm font-normal">
                Mark the duplicate record as Inactive after merging
              </Label>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="secondary" onClick={() => run("linked")} disabled={busy || !kept || !dropped}>
              <Link2 className="h-4 w-4 mr-1" /> Link only
            </Button>
            <Button onClick={() => run("merged")} disabled={busy || !kept || !dropped}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Merge className="h-4 w-4 mr-1" />}
              Merge records
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
