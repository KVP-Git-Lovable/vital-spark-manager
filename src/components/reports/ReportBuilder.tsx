import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  Play,
  X,
  Search,
  GripVertical,
  Plus,
  Trash2,
  Table,
  BarChart3,
  PieChart,
  LineChart,
  Hash,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  REPORT_OBJECTS,
  getObjectByKey,
  getRelatedObjects,
  CHART_TYPES,
  type SavedReport,
  type ReportFilter,
  type ReportField,
} from "@/lib/reportObjects";
import { ReportPreview } from "./ReportPreview";

const chartIcons: Record<string, any> = {
  table: Table,
  bar: BarChart3,
  doughnut: PieChart,
  line: LineChart,
  number: Hash,
};

interface Props {
  initial: SavedReport | null;
  onSave: (r: SavedReport) => void;
  onClose: () => void;
}

export function ReportBuilder({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [primaryObject, setPrimaryObject] = useState(initial?.primary_object || "");
  const [relatedObject, setRelatedObject] = useState(initial?.related_object || "");
  const [columns, setColumns] = useState<string[]>(initial?.columns || []);
  const [groupRows, setGroupRows] = useState<string[]>(initial?.group_rows || []);
  const [groupColumns, setGroupColumns] = useState<string[]>(initial?.group_columns || []);
  const [filters, setFilters] = useState<ReportFilter[]>(initial?.filters || []);
  const [chartType, setChartType] = useState(initial?.chart_type || "table");
  const [fieldSearch, setFieldSearch] = useState("");
  const [dragItem, setDragItem] = useState<{ field: string; source: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    fields: true,
    groupRows: true,
    groupColumns: false,
    columns: true,
    filters: true,
  });

  const primaryObj = getObjectByKey(primaryObject);
  const relatedObj = relatedObject ? getObjectByKey(relatedObject) : null;
  const relatedOptions = primaryObject ? getRelatedObjects(primaryObject) : [];

  const allFields: (ReportField & { objectKey: string; prefix: string })[] = [];
  if (primaryObj) {
    primaryObj.fields.forEach((f) =>
      allFields.push({ ...f, objectKey: primaryObject, prefix: primaryObj.label })
    );
  }
  if (relatedObj) {
    relatedObj.fields.forEach((f) =>
      allFields.push({ ...f, objectKey: relatedObject, prefix: relatedObj.label })
    );
  }

  const filteredFields = allFields.filter(
    (f) =>
      f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
      f.prefix.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const fieldKeyStr = (f: { objectKey: string; key: string }) => `${f.objectKey}.${f.key}`;
  const usedFields = new Set([...columns, ...groupRows, ...groupColumns]);

  const handleDragStart = (field: string, source: string) => {
    setDragItem({ field, source });
  };

  const handleDrop = (target: string) => {
    if (!dragItem) return;
    const { field, source } = dragItem;
    if (source === "columns") setColumns((p) => p.filter((c) => c !== field));
    if (source === "groupRows") setGroupRows((p) => p.filter((c) => c !== field));
    if (source === "groupColumns") setGroupColumns((p) => p.filter((c) => c !== field));
    if (target === "columns" && !columns.includes(field)) setColumns((p) => [...p, field]);
    if (target === "groupRows" && !groupRows.includes(field)) setGroupRows((p) => [...p, field]);
    if (target === "groupColumns" && !groupColumns.includes(field)) setGroupColumns((p) => [...p, field]);
    setDragItem(null);
  };

  const addFieldTo = (fk: string, target: string) => {
    if (target === "columns" && !columns.includes(fk)) setColumns((p) => [...p, fk]);
    if (target === "groupRows" && !groupRows.includes(fk)) setGroupRows((p) => [...p, fk]);
    if (target === "groupColumns" && !groupColumns.includes(fk)) setGroupColumns((p) => [...p, fk]);
  };

  const removeField = (fk: string, from: string) => {
    if (from === "columns") setColumns((p) => p.filter((c) => c !== fk));
    if (from === "groupRows") setGroupRows((p) => p.filter((c) => c !== fk));
    if (from === "groupColumns") setGroupColumns((p) => p.filter((c) => c !== fk));
  };

  const getFieldLabel = (fk: string) => {
    const [objKey, fldKey] = fk.split(".");
    const obj = getObjectByKey(objKey);
    return obj?.fields.find((f) => f.key === fldKey)?.label || fk;
  };

  const addFilter = () => {
    if (allFields.length === 0) return;
    const first = allFields[0];
    setFilters((p) => [
      ...p,
      { field: fieldKeyStr(first), operator: "equals", value: "", objectKey: first.objectKey },
    ]);
  };

  const updateFilter = (idx: number, patch: Partial<ReportFilter>) => {
    setFilters((p) => p.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeFilter = (idx: number) => {
    setFilters((p) => p.filter((_, i) => i !== idx));
  };

  const toggleSection = (key: string) => {
    setExpandedSections((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id,
      name,
      description,
      primary_object: primaryObject,
      related_object: relatedObject || undefined,
      columns,
      group_rows: groupRows,
      group_columns: groupColumns,
      filters,
      chart_type: chartType,
    });
  };

  // Step 1: Select objects
  if (!primaryObject) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Create Report</h1>
            <p className="text-sm text-muted-foreground">Step 1: Select a primary object</p>
          </div>
        </div>
        <div className="data-table overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search objects..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {REPORT_OBJECTS.filter((o) =>
              o.label.toLowerCase().includes(fieldSearch.toLowerCase())
            ).map((obj) => (
              <button
                key={obj.key}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                onClick={() => {
                  setPrimaryObject(obj.key);
                  setFieldSearch("");
                }}
              >
                <div>
                  <span className="font-medium text-foreground">{obj.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{obj.fields.length} fields</span>
                </div>
                <Badge variant="secondary">{obj.table}</Badge>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Salesforce-style builder
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap bg-card">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Report Name"
          className="font-display font-semibold text-sm border-none shadow-none px-1 h-7 focus-visible:ring-0 max-w-[200px] md:max-w-[300px]"
        />
        <Badge variant="outline" className="text-[10px] shrink-0">{primaryObj?.label}</Badge>
        {relatedObj && <Badge variant="outline" className="text-[10px] shrink-0">+ {relatedObj.label}</Badge>}

        <div className="flex gap-0.5 shrink-0 ml-auto">
          {CHART_TYPES.map((ct) => {
            const Icon = chartIcons[ct.key] || Table;
            return (
              <Button
                key={ct.key}
                size="icon"
                variant={chartType === ct.key ? "default" : "ghost"}
                className="h-7 w-7"
                title={ct.label}
                onClick={() => setChartType(ct.key)}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            );
          })}
        </div>

        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleSave}>
          <Save className="h-3 w-3" /> Save
        </Button>
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSave}>
          <Play className="h-3 w-3" /> Save & Run
        </Button>
      </div>

      {/* Main area: left panel + right preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Salesforce-style cascaded outline */}
        <div className="w-72 md:w-80 border-r border-border flex flex-col shrink-0 bg-card overflow-y-auto">
          {/* Search fields */}
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search all fields..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="pl-7 h-7 text-xs"
              />
            </div>
          </div>

          {/* Related object selector */}
          {relatedOptions.length > 0 && (
            <div className="px-3 py-2 border-b border-border">
              <Label className="text-[10px] text-muted-foreground mb-1 block">Related Object</Label>
              <Select value={relatedObject || "none"} onValueChange={(v) => setRelatedObject(v === "none" ? "" : v)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {relatedOptions.map((ro) => (
                    <SelectItem key={ro.key} value={ro.key}>{ro.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="px-3 py-2 border-b border-border">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="h-7 text-xs"
            />
          </div>

          {/* GROUPS section */}
          <CollapsibleSection
            title="GROUP ROWS"
            count={groupRows.length}
            expanded={expandedSections.groupRows}
            onToggle={() => toggleSection("groupRows")}
          >
            <DropZone
              items={groupRows}
              getLabel={getFieldLabel}
              onRemove={(fk) => removeField(fk, "groupRows")}
              onDrop={() => handleDrop("groupRows")}
              onDragOver={(e) => e.preventDefault()}
              onDragStart={handleDragStart}
              source="groupRows"
              placeholder="Drag fields here or search below"
            />
            <AddFieldSearch
              allFields={filteredFields}
              usedFields={usedFields}
              fieldKeyFn={fieldKeyStr}
              onAdd={(fk) => addFieldTo(fk, "groupRows")}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="GROUP COLUMNS"
            count={groupColumns.length}
            expanded={expandedSections.groupColumns}
            onToggle={() => toggleSection("groupColumns")}
          >
            <DropZone
              items={groupColumns}
              getLabel={getFieldLabel}
              onRemove={(fk) => removeField(fk, "groupColumns")}
              onDrop={() => handleDrop("groupColumns")}
              onDragOver={(e) => e.preventDefault()}
              onDragStart={handleDragStart}
              source="groupColumns"
              placeholder="Drag fields here"
            />
            <AddFieldSearch
              allFields={filteredFields}
              usedFields={usedFields}
              fieldKeyFn={fieldKeyStr}
              onAdd={(fk) => addFieldTo(fk, "groupColumns")}
            />
          </CollapsibleSection>

          {/* COLUMNS section */}
          <CollapsibleSection
            title="COLUMNS"
            count={columns.length}
            expanded={expandedSections.columns}
            onToggle={() => toggleSection("columns")}
          >
            <DropZone
              items={columns}
              getLabel={getFieldLabel}
              onRemove={(fk) => removeField(fk, "columns")}
              onDrop={() => handleDrop("columns")}
              onDragOver={(e) => e.preventDefault()}
              onDragStart={handleDragStart}
              source="columns"
              placeholder="Drag fields here"
            />
            <AddFieldSearch
              allFields={filteredFields}
              usedFields={usedFields}
              fieldKeyFn={fieldKeyStr}
              onAdd={(fk) => addFieldTo(fk, "columns")}
            />
          </CollapsibleSection>

          {/* FILTERS section */}
          <CollapsibleSection
            title="FILTERS"
            count={filters.length}
            expanded={expandedSections.filters}
            onToggle={() => toggleSection("filters")}
            icon={<Filter className="h-3 w-3" />}
          >
            <div className="space-y-2">
              {filters.map((filter, idx) => (
                <FilterRow
                  key={idx}
                  filter={filter}
                  allFields={allFields}
                  fieldKeyFn={fieldKeyStr}
                  onChange={(patch) => updateFilter(idx, patch)}
                  onRemove={() => removeFilter(idx)}
                />
              ))}
              <Button size="sm" variant="outline" onClick={addFilter} className="w-full gap-1 text-xs h-7">
                <Plus className="h-3 w-3" /> Add Filter
              </Button>
            </div>
          </CollapsibleSection>

          {/* FIELDS tree (cascaded) */}
          <CollapsibleSection
            title={`${primaryObj?.label || "Fields"} (${filteredFields.filter(f => f.objectKey === primaryObject).length})`}
            expanded={expandedSections.fields}
            onToggle={() => toggleSection("fields")}
          >
            <div className="space-y-0">
              {filteredFields
                .filter((f) => f.objectKey === primaryObject)
                .map((f) => {
                  const fk = fieldKeyStr(f);
                  const used = usedFields.has(fk);
                  return (
                    <div
                      key={fk}
                      draggable
                      onDragStart={() => handleDragStart(fk, "fields")}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs cursor-grab hover:bg-accent/30 transition-colors ${used ? "opacity-40" : ""}`}
                      onClick={() => !used && addFieldTo(fk, "columns")}
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                      <TypeIcon type={f.type} />
                      <span className="truncate">{f.label}</span>
                    </div>
                  );
                })}
            </div>
          </CollapsibleSection>

          {relatedObj && (
            <CollapsibleSection
              title={`${relatedObj.label} (${filteredFields.filter(f => f.objectKey === relatedObject).length})`}
              expanded={false}
              onToggle={() => {}}
            >
              <div className="space-y-0">
                {filteredFields
                  .filter((f) => f.objectKey === relatedObject)
                  .map((f) => {
                    const fk = fieldKeyStr(f);
                    const used = usedFields.has(fk);
                    return (
                      <div
                        key={fk}
                        draggable
                        onDragStart={() => handleDragStart(fk, "fields")}
                        className={`flex items-center gap-1.5 px-2 py-1 text-xs cursor-grab hover:bg-accent/30 transition-colors ${used ? "opacity-40" : ""}`}
                        onClick={() => !used && addFieldTo(fk, "columns")}
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                        <TypeIcon type={f.type} />
                        <span className="truncate">{f.label}</span>
                      </div>
                    );
                  })}
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* RIGHT — Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-background">
          {/* Preview info bar */}
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
              Preview
            </span>
            {groupRows.length > 0 && (
              <span>Grouped by: {groupRows.map(getFieldLabel).join(", ")}</span>
            )}
            {filters.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                <Filter className="h-2.5 w-2.5 mr-1" /> {filters.length} filter{filters.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* Column pills */}
          {columns.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {columns.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px] gap-1 pr-1">
                  {getFieldLabel(c)}
                  <button onClick={() => removeField(c, "columns")}>
                    <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {columns.length === 0 && groupRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
              <Table className="h-12 w-12 opacity-20" />
              <p className="text-sm">Add columns or group fields to see a preview</p>
              <p className="text-xs">Click fields in the left panel or drag them to groups/columns</p>
            </div>
          ) : (
            <div className="data-table p-3">
              <ReportPreview
                primaryObject={primaryObject}
                relatedObject={relatedObject}
                columns={columns}
                groupRows={groupRows}
                groupColumns={groupColumns}
                filters={filters}
                chartType={chartType}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function TypeIcon({ type }: { type: string }) {
  const map: Record<string, string> = { number: "#", date: "📅", boolean: "☑", text: "A" };
  return <span className="text-muted-foreground text-[10px] w-3 text-center shrink-0">{map[type] || "A"}</span>;
}

function CollapsibleSection({
  title,
  count,
  expanded: initialExpanded,
  onToggle,
  icon,
  children,
}: {
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialExpanded);
  return (
    <div className="border-b border-border">
      <button
        className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        <span>{title}</span>
        {count !== undefined && count > 0 && (
          <Badge className="ml-auto h-4 px-1.5 text-[9px]">{count}</Badge>
        )}
      </button>
      {open && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
}

function AddFieldSearch({
  allFields,
  usedFields,
  fieldKeyFn,
  onAdd,
}: {
  allFields: (ReportField & { objectKey: string; prefix: string })[];
  usedFields: Set<string>;
  fieldKeyFn: (f: { objectKey: string; key: string }) => string;
  onAdd: (fk: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = allFields.filter(
    (f) => !usedFields.has(fieldKeyFn(f)) && f.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mt-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Add field..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="pl-6 h-6 text-[11px]"
        />
      </div>
      {open && search && filtered.length > 0 && (
        <div className="max-h-32 overflow-y-auto bg-popover border border-border rounded mt-1 shadow-md">
          {filtered.slice(0, 8).map((f) => {
            const fk = fieldKeyFn(f);
            return (
              <button
                key={fk}
                className="w-full text-left px-2 py-1 text-[11px] hover:bg-accent/50 flex items-center gap-1"
                onClick={() => { onAdd(fk); setSearch(""); setOpen(false); }}
              >
                <TypeIcon type={f.type} />
                <span className="text-muted-foreground">{f.prefix}.</span>
                {f.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DropZone({
  items,
  getLabel,
  onRemove,
  onDrop,
  onDragOver,
  onDragStart,
  source,
  placeholder,
}: {
  items: string[];
  getLabel: (fk: string) => string;
  onRemove: (fk: string) => void;
  onDrop: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragStart: (field: string, source: string) => void;
  source: string;
  placeholder: string;
}) {
  return (
    <div
      className="min-h-[32px] rounded border border-dashed border-border/60 hover:border-primary/40 transition-colors p-1.5"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {items.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-1 opacity-50">{placeholder}</p>
      ) : (
        <div className="space-y-0.5">
          {items.map((fk) => (
            <div
              key={fk}
              draggable
              onDragStart={() => onDragStart(fk, source)}
              className="flex items-center gap-1 bg-primary/10 rounded px-1.5 py-0.5 text-[11px] cursor-grab group"
            >
              <GripVertical className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              <span className="text-primary font-medium truncate">{getLabel(fk)}</span>
              <button onClick={() => onRemove(fk)} className="ml-auto opacity-0 group-hover:opacity-100">
                <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  filter,
  allFields,
  fieldKeyFn,
  onChange,
  onRemove,
}: {
  filter: ReportFilter;
  allFields: (ReportField & { objectKey: string; prefix: string })[];
  fieldKeyFn: (f: { objectKey: string; key: string }) => string;
  onChange: (patch: Partial<ReportFilter>) => void;
  onRemove: () => void;
}) {
  const operators = [
    { key: "equals", label: "Equals" },
    { key: "not_equals", label: "Not Equals" },
    { key: "contains", label: "Contains" },
    { key: "gt", label: ">" },
    { key: "lt", label: "<" },
    { key: "gte", label: "≥" },
    { key: "lte", label: "≤" },
    { key: "is_null", label: "Is Empty" },
    { key: "is_not_null", label: "Not Empty" },
  ];

  return (
    <div className="flex flex-col gap-1 p-1.5 bg-muted/30 rounded text-[11px]">
      <div className="flex gap-1 items-center">
        <Select value={filter.field} onValueChange={(v) => onChange({ field: v })}>
          <SelectTrigger className="h-6 text-[11px] flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allFields.map((f) => (
              <SelectItem key={fieldKeyFn(f)} value={fieldKeyFn(f)} className="text-xs">
                {f.prefix}.{f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={onRemove}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
      <div className="flex gap-1">
        <Select value={filter.operator} onValueChange={(v: any) => onChange({ operator: v })}>
          <SelectTrigger className="h-6 text-[11px] w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.key} value={op.key} className="text-xs">{op.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!["is_null", "is_not_null"].includes(filter.operator) && (
          <Input
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
            className="h-6 text-[11px] flex-1"
            placeholder="Value"
          />
        )}
      </div>
    </div>
  );
}
