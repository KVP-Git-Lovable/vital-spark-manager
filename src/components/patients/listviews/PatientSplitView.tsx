import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PatientAvatar } from "@/components/patients/PatientAvatar";
import { fieldDef, formatCell, PATIENT_FIELDS } from "@/lib/patientFields";
import { ExternalLink, Mail, Phone } from "lucide-react";

interface Props {
  rows: any[];
  columns: string[];
  avatars?: Record<string, string>;
  onOpen: (row: any) => void;
}

const DETAIL_FIELDS = [
  "phone", "email", "gender", "age", "date_of_birth", "status", "skin_type",
  "blood_group", "city", "source", "total_visits", "lifetime_value",
  "last_visit_date", "engagement_tier", "created_at",
];

export default function PatientSplitView({ rows, columns, avatars = {}, onOpen }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);

  useEffect(() => {
    if (!rows.some((r) => r.id === selectedId)) setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const secondary = columns.filter((c) => c !== "full_name").slice(0, 2);

  return (
    <div className="flex flex-col md:flex-row md:h-[70vh]">
      <div className="md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-border overflow-y-auto max-h-[40vh] md:max-h-none">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setSelectedId(row.id)}
            className={`w-full border-b border-border/60 px-3 py-2.5 text-left transition-colors ${
              row.id === selectedId ? "bg-primary/10" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <PatientAvatar
                firstName={row.first_name}
                lastName={row.last_name}
                photoUrl={avatars[row.id]}
                className="h-8 w-8"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{formatCell(row, "full_name")}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {secondary.map((k) => formatCell(row, k)).filter((v) => v !== "—").join(" · ") || "—"}
                </p>
              </div>
            </div>
          </button>
        ))}
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No records.</p>}
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto p-5">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Select a record from the list.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <PatientAvatar
                  firstName={selected.first_name}
                  lastName={selected.last_name}
                  photoUrl={avatars[selected.id]}
                  className="h-12 w-12"
                />
                <div>
                  <h3 className="text-lg font-semibold">{formatCell(selected, "full_name")}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {selected.phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selected.phone}</span>
                    )}
                    {selected.email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selected.email}</span>
                    )}
                  </div>
                </div>
              </div>
              <Button size="sm" className="gap-2" onClick={() => onOpen(selected)}>
                <ExternalLink className="h-4 w-4" />
                Open full record
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DETAIL_FIELDS.filter((k) => PATIENT_FIELDS.some((f) => f.key === k)).map((key) => (
                <div key={key} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{fieldDef(key)?.label}</p>
                  <p className="mt-0.5 truncate text-sm font-medium">{formatCell(selected, key)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
