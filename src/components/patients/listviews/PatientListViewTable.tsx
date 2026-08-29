import { Checkbox } from "@/components/ui/checkbox";
import { useStackedTable } from "@/hooks/useStackedTable";
import { fieldDef, formatCell, PATIENT_FIELDS, rawValue } from "@/lib/patientFields";
import { PatientAvatar } from "@/components/patients/PatientAvatar";

interface Props {
  rows: any[];
  columns: string[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (row: any) => void;
  doctorLabels?: Record<string, string>;
  avatars?: Record<string, string>;
}

const labelFor = (key: string) => PATIENT_FIELDS.find((f) => f.key === key)?.label ?? key;

export default function PatientListViewTable({
  rows, columns, selectedIds, onToggle, onToggleAll, onOpen, doctorLabels = {}, avatars = {},
}: Props) {
  const tableRef = useStackedTable<HTMLTableElement>();
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const cell = (row: any, key: string) => {
    if (key === "doctor_id") {
      const id = rawValue(row, key) as string | null;
      return id ? doctorLabels[id] ?? "—" : "—";
    }
    return formatCell(row, key);
  };

  return (
    <div className="overflow-x-auto table-scroll">
      <table ref={tableRef} className="w-full responsive-table">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-4 w-10">
              <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Select all" />
            </th>
            {columns.map((key) => (
              <th key={key} className="text-left text-xs font-medium text-muted-foreground p-4 whitespace-nowrap">
                {labelFor(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onOpen(row)}>
              <td className="p-4" onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => onToggle(row.id)} aria-label="Select row" />
              </td>
              {columns.map((key) => {
                const def = fieldDef(key);
                const value = cell(row, key);
                if (key === "status") {
                  return (
                    <td key={key} className="p-4" data-label={labelFor(key)}>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          row.status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {row.status || "—"}
                      </span>
                    </td>
                  );
                }
                return (
                  <td
                    key={key}
                    data-label={labelFor(key)}
                    className={`p-4 text-sm ${def?.type === "number" ? "tabular-nums" : ""} ${
                      key === "full_name" ? "font-medium" : "text-muted-foreground"
                    }`}
                  >
                    <span className="line-clamp-2">{value}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
