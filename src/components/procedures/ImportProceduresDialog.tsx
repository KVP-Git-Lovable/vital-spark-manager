import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PROCEDURE_FIELDS,
  ProcedureField,
  FIELD_LABELS,
  parseFile,
  buildMappedProcedureRows,
  toProcedureInsertPayload,
  MappedProcedureRow,
  ResolutionMaps,
  autoDetectProcedureMapping,
  normalizePhone,
  normalizeName,
} from "@/lib/procedureImport";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4;

export const ImportProceduresDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const [step, setStep] = useState<Step>(1);
  const [parsing, setParsing] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ProcedureField | "">>({});
  const [mapped, setMapped] = useState<MappedProcedureRow[]>([]);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const reset = () => {
    setStep(1);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setMapped([]);
    setShowOnlyErrors(false);
    setProgress(0);
    setImportedCount(0);
    setSkippedCount(0);
  };

  const handleClose = (o: boolean) => {
    if (!o && !importing) reset();
    onOpenChange(o);
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const { headers: h, rows: r } = await parseFile(file);
      if (!h.length || !r.length) {
        toast.error("File is empty or unreadable");
        return;
      }
      setHeaders(h);
      setRows(r);
      setMapping(Object.fromEntries(h.map((c) => [c, ""])) as Record<string, ProcedureField | "">);
      setStep(2);
    } catch (e: any) {
      toast.error(`Failed to parse: ${e.message}`);
    } finally {
      setParsing(false);
    }
  };

  const mappingValid = useMemo(() => {
    const used = new Set(Object.values(mapping).filter(Boolean));
    return REQUIRED_PROCEDURE_FIELDS.every((f) => used.has(f));
  }, [mapping]);

  const goToPreview = async () => {
    // Collect phones to lookup
    const phones = new Set<string>();
    for (const r of rows) {
      for (const [h, f] of Object.entries(mapping)) {
        if (f === "patient_phone" && r[h]) {
          const p = normalizePhone(r[h]);
          if (p) phones.add(p);
        }
      }
    }
    const phoneToPatient = new Map<string, string>();
    if (phones.size) {
      const { data } = await supabase
        .from("patients")
        .select("id, phone")
        .in("phone", Array.from(phones));
      (data || []).forEach((p: any) => {
        if (p.phone) phoneToPatient.set(p.phone, p.id);
      });
    }

    // Load staff for name match
    const nameToStaff = new Map<string, string>();
    const { data: staffData } = await supabase.from("staff").select("id, first_name, last_name");
    (staffData || []).forEach((s: any) => {
      const full = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase().trim();
      if (full) nameToStaff.set(full, s.id);
      const firstOnly = String(s.first_name || "").toLowerCase().trim();
      if (firstOnly && !nameToStaff.has(firstOnly)) nameToStaff.set(firstOnly, s.id);
    });

    const m = buildMappedProcedureRows(rows, mapping, phoneToPatient, nameToStaff);
    setMapped(m);
    setStep(3);
  };

  const importableRows = mapped.filter((r) => r.errors.length === 0 && !r.skip);
  const errorCount = mapped.filter((r) => r.errors.length > 0).length;
  const warningCount = mapped.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length;

  const handleImport = async () => {
    setImporting(true);
    setStep(4);
    const payloads = importableRows.map((r) => toProcedureInsertPayload(r));
    const batch = 100;
    let inserted = 0;
    let failed = 0;
    let lastError: string | null = null;
    for (let i = 0; i < payloads.length; i += batch) {
      const chunk = payloads.slice(i, i + batch);
      const { error } = await supabase.from("procedures").insert(chunk as any);
      if (error) {
        failed += chunk.length;
        lastError = error.message;
        console.error("Procedure import batch error:", error, "sample row:", chunk[0]);
      } else inserted += chunk.length;
      setProgress(Math.round(((i + chunk.length) / payloads.length) * 100));
    }
    const totalSkipped = errorCount + failed;
    setImportedCount(inserted);
    setSkippedCount(totalSkipped);
    setImporting(false);
    if (inserted > 0) {
      toast.success(`Imported ${inserted} · Skipped ${totalSkipped}`);
    } else {
      toast.error(`Import failed: ${lastError ?? "Unknown error"}`);
    }
    onSuccess();
  };

  const usedFields = new Set(Object.values(mapping).filter(Boolean));
  const previewRows = mapped.filter((r) => !r.skip);
  const visibleRows = showOnlyErrors ? previewRows.filter((r) => r.errors.length) : previewRows;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Procedures</DialogTitle>
          <DialogDescription>
            Step {step} of 4 · {step === 1 ? "Upload file" : step === 2 ? "Map columns" : step === 3 ? "Preview & validate" : "Import"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === 1 && (
            <div className="py-8">
              <label className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Click to upload Excel or CSV file</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv supported</p>
                </div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {parsing && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Map each file column to a procedure field. Required: Patient Phone, Service Name, Procedure Date.
              </p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">File Column</th>
                      <th className="text-left p-3 font-medium">Procedure Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {headers.map((h) => (
                      <tr key={h}>
                        <td className="p-3 font-mono text-xs">{h}</td>
                        <td className="p-3">
                          <Select
                            value={mapping[h] || "__skip__"}
                            onValueChange={(v) =>
                              setMapping((prev) => ({ ...prev, [h]: v === "__skip__" ? "" : (v as ProcedureField) }))
                            }
                          >
                            <SelectTrigger className="h-8 w-64">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__skip__">— Skip —</SelectItem>
                              {PROCEDURE_FIELDS.map((f) => (
                                <SelectItem key={f} value={f} disabled={usedFields.has(f) && mapping[h] !== f}>
                                  {FIELD_LABELS[f]}
                                  {REQUIRED_PROCEDURE_FIELDS.includes(f) && " *"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> {importableRows.length} valid</span>
                  <span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4 text-destructive" /> {errorCount} errors</span>
                  {warningCount > 0 && (
                    <span className="text-muted-foreground">{warningCount} with warnings</span>
                  )}
                  <span className="text-muted-foreground">Total: {mapped.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="errs-only" className="text-xs">Errors only</Label>
                  <Switch id="errs-only" checked={showOnlyErrors} onCheckedChange={setShowOnlyErrors} />
                </div>
              </div>
              <div className="border rounded-lg overflow-auto max-h-[50vh]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Row</th>
                      <th className="text-left p-2">Status</th>
                      {Array.from(usedFields).map((f) => (
                        <th key={f} className="text-left p-2 whitespace-nowrap">{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleRows.slice(0, 100).map((r) => (
                      <tr key={r.index} className={r.errors.length ? "bg-destructive/5" : ""}>
                        <td className="p-2">{r.index + 1}</td>
                        <td className="p-2">
                          {r.errors.length ? (
                            <span className="text-destructive">{r.errors.join("; ")}</span>
                          ) : r.warnings.length ? (
                            <span className="text-warning">OK · {r.warnings.join("; ")}</span>
                          ) : (
                            <span className="text-success">OK</span>
                          )}
                        </td>
                        {Array.from(usedFields).map((f) => (
                          <td key={f} className="p-2 whitespace-nowrap max-w-[180px] truncate">
                            {r.data[f] !== undefined ? String(r.data[f]) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleRows.length > 100 && (
                  <div className="p-3 text-center text-xs text-muted-foreground border-t">
                    Showing first 100 of {visibleRows.length} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="py-8 space-y-4">
              <div className="flex items-center justify-center">
                <FileSpreadsheet className="h-12 w-12 text-primary" />
              </div>
              <Progress value={progress} />
              <p className="text-center text-sm text-muted-foreground">
                {importing ? `Importing... ${progress}%` : `Imported ${importedCount} · Skipped ${skippedCount}`}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>
            {step === 4 && !importing ? "Close" : "Cancel"}
          </Button>
          <div className="flex gap-2">
            {step === 2 && (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={goToPreview} disabled={!mappingValid}>
                  Preview {!mappingValid && "(map required fields)"}
                </Button>
              </>
            )}
            {step === 3 && (
              <>
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={handleImport} disabled={importableRows.length === 0}>
                  Import {importableRows.length} valid procedure{importableRows.length !== 1 ? "s" : ""}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};