import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("outline");
  const [dragItem, setDragItem] = useState<{ field: string; source: string } | null>(null);

  // Step 1: Object not yet selected
  const primaryObj = getObjectByKey(primaryObject);
  const relatedObj = relatedObject ? getObjectByKey(relatedObject) : null;
  const relatedOptions = primaryObject ? getRelatedObjects(primaryObject) : [];

  // All available fields
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

  const fieldKey = (f: { objectKey: string; key: string }) => `${f.objectKey}.${f.key}`;

  const usedFields = new Set([...columns, ...groupRows, ...groupColumns]);

  const handleDragStart = (field: string, source: string) => {
    setDragItem({ field, source });
  };

  const handleDrop = (target: string) => {
    if (!dragItem) return;
    const { field, source } = dragItem;

    // Remove from source
    if (source === "columns") setColumns((p) => p.filter((c) => c !== field));
    if (source === "groupRows") setGroupRows((p) => p.filter((c) => c !== field));
    if (source === "groupColumns") setGroupColumns((p) => p.filter((c) => c !== field));

    // Add to target
    if (target === "columns" && !columns.includes(field)) setColumns((p) => [...p, field]);
    if (target === "groupRows" && !groupRows.includes(field)) setGroupRows((p) => [...p, field]);
    if (target === "groupColumns" && !groupColumns.includes(field))
      setGroupColumns((p) => [...p, field]);

    setDragItem(null);
  };

  const addFieldToColumns = (fk: string) => {
    if (!columns.includes(fk)) setColumns((p) => [...p, fk]);
  };

  const removeField = (fk: string, from: string) => {
    if (from === "columns") setColumns((p) => p.filter((c) => c !== fk));
    if (from === "groupRows") setGroupRows((p) => p.filter((c) => c !== fk));
    if (from === "groupColumns") setGroupColumns((p) => p.filter((c) => c !== fk));
  };

  const getFieldLabel = (fk: string) => {
    const [objKey, fieldKey] = fk.split(".");
    const obj = getObjectByKey(objKey);
    const field = obj?.fields.find((f) => f.key === fieldKey);
    return field ? `${field.label}` : fk;
  };

  const getFieldObj = (fk: string) => {
    const [objKey] = fk.split(".");
    return getObjectByKey(objKey)?.label || objKey;
  };

  // Filters
  const addFilter = () => {
    if (allFields.length === 0) return;
    const first = allFields[0];
    setFilters((p) => [
      ...p,
      { field: fieldKey(first), operator: "equals", value: "", objectKey: first.objectKey },
    ]);
  };

  const updateFilter = (idx: number, patch: Partial<ReportFilter>) => {
    setFilters((p) => p.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeFilter = (idx: number) => {
    setFilters((p) => p.filter((_, i) => i !== idx));
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
            <h3 className="font-semibold text-foreground mb-1">Select a Report Type</h3>
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
                  <span className="text-xs text-muted-foreground ml-2">
                    {obj.fields.length} fields
                  </span>
                </div>
                <Badge variant="secondary">{obj.table}</Badge>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showPreview) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl font-bold text-foreground flex-1 truncate">
            {name || "Untitled Report"}
          </h1>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
        <ReportPreview
          primaryObject={primaryObject}
          relatedObject={relatedObject}
          columns={columns}
          groupRows={groupRows}
          groupColumns={groupColumns}
          filters={filters}
          chartType={chartType}
        />
      </div>
    );
  }

  // Step 2: Builder UI (Salesforce-style)
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 py-3 border-b border-border shrink-0 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Report Name"
            className="font-display font-semibold text-base border-none shadow-none px-0 h-8 focus-visible:ring-0"
          />
        </div>
        <Badge variant="outline" className="shrink-0">{primaryObj?.label}</Badge>
        {relatedObj && <Badge variant="outline" className="shrink-0">+ {relatedObj.label}</Badge>}

        {/* Chart type picker */}
        <div className="flex gap-1 shrink-0">
          {CHART_TYPES.map((ct) => {
            const Icon = chartIcons[ct.key] || Table;
            return (
              <Button
                key={ct.key}
                size="icon"
                variant={chartType === ct.key ? "default" : "ghost"}
                className="h-8 w-8"
                title={ct.label}
                onClick={() => setChartType(ct.key)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} className="gap-1">
          <Play className="h-3.5 w-3.5" /> Run
        </Button>
        <Button size="sm" onClick={handleSave} className="gap-1">
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      </div>

      {/* Main builder area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Fields */}
        <div className="w-64 border-r border-border flex flex-col shrink-0 bg-card hidden md:flex">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
            <TabsList className="mx-2 mt-2 grid grid-cols-2">
              <TabsTrigger value="outline" className="text-xs">Outline</TabsTrigger>
              <TabsTrigger value="filters" className="text-xs">
                Filters {filters.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px]">{filters.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="outline" className="flex-1 overflow-hidden flex flex-col m-0">
              {/* Related object picker */}
              {relatedOptions.length > 0 && (
                <div className="px-3 py-2 border-b border-border">
                  <Label className="text-xs text-muted-foreground mb-1 block">Related Object</Label>
                  <Select value={relatedObject} onValueChange={setRelatedObject}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {relatedOptions.map((ro) => (
                        <SelectItem key={ro.key} value={ro.key}>
                          {ro.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Search */}
              <div className="px-3 py-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search fields..."
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>
              </div>

              {/* Fields list */}
              <div className="flex-1 overflow-y-auto">
                {primaryObj && (
                  <FieldGroup
                    label={primaryObj.label}
                    fields={filteredFields.filter((f) => f.objectKey === primaryObject)}
                    usedFields={usedFields}
                    onAdd={addFieldToColumns}
                    onDragStart={handleDragStart}
                    fieldKeyFn={fieldKey}
                  />
                )}
                {relatedObj && (
                  <FieldGroup
                    label={relatedObj.label}
                    fields={filteredFields.filter((f) => f.objectKey === relatedObject)}
                    usedFields={usedFields}
                    onAdd={addFieldToColumns}
                    onDragStart={handleDragStart}
                    fieldKeyFn={fieldKey}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="filters" className="flex-1 overflow-y-auto m-0 p-3">
              <div className="space-y-3">
                {filters.map((filter, idx) => (
                  <FilterRow
                    key={idx}
                    filter={filter}
                    allFields={allFields}
                    fieldKeyFn={fieldKey}
                    onChange={(patch) => updateFilter(idx, patch)}
                    onRemove={() => removeFilter(idx)}
                  />
                ))}
                <Button size="sm" variant="outline" onClick={addFilter} className="w-full gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Filter
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Center - Drop zones & preview */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
          {/* Description */}
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Report description (optional)"
            className="text-sm"
          />

          {/* Mobile field picker */}
          <div className="md:hidden">
            <details className="data-table">
              <summary className="px-3 py-2 font-medium text-sm cursor-pointer">
                Fields ({allFields.length}) & Filters
              </summary>
              <div className="px-3 pb-3 space-y-2 max-h-60 overflow-y-auto">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>
                {filteredFields.map((f) => {
                  const fk = fieldKey(f);
                  return (
                    <button
                      key={fk}
                      className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent/50 flex items-center justify-between"
                      onClick={() => addFieldToColumns(fk)}
                    >
                      <span>
                        <span className="text-muted-foreground">{f.prefix}.</span>
                        {f.label}
                      </span>
                      {usedFields.has(fk) && <Badge variant="secondary" className="text-[10px] h-4 px-1">Added</Badge>}
                    </button>
                  );
                })}
              </div>
            </details>
          </div>

          {/* Drop zones */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DropZone
              title="Group Rows"
              icon="📊"
              items={groupRows}
              getLabel={getFieldLabel}
              getObj={getFieldObj}
              onRemove={(fk) => removeField(fk, "groupRows")}
              onDrop={() => handleDrop("groupRows")}
              onDragOver={(e) => e.preventDefault()}
              onDragStart={handleDragStart}
              source="groupRows"
            />
            <DropZone
              title="Group Columns"
              icon="📋"
              items={groupColumns}
              getLabel={getFieldLabel}
              getObj={getFieldObj}
              onRemove={(fk) => removeField(fk, "groupColumns")}
              onDrop={() => handleDrop("groupColumns")}
              onDragOver={(e) => e.preventDefault()}
              onDragStart={handleDragStart}
              source="groupColumns"
            />
            <DropZone
              title="Columns"
              icon="📄"
              items={columns}
              getLabel={getFieldLabel}
              getObj={getFieldObj}
              onRemove={(fk) => removeField(fk, "columns")}
              onDrop={() => handleDrop("columns")}
              onDragOver={(e) => e.preventDefault()}
              onDragStart={handleDragStart}
              source="columns"
            />
          </div>

          {/* Mobile filters */}
          <div className="md:hidden data-table p-3">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Filters
            </h4>
            {filters.map((filter, idx) => (
              <FilterRow
                key={idx}
                filter={filter}
                allFields={allFields}
                fieldKeyFn={fieldKey}
                onChange={(patch) => updateFilter(idx, patch)}
                onRemove={() => removeFilter(idx)}
              />
            ))}
            <Button size="sm" variant="outline" onClick={addFilter} className="w-full gap-1 text-xs mt-2">
              <Plus className="h-3.5 w-3.5" /> Add Filter
            </Button>
          </div>

          {/* Inline preview */}
          <div className="data-table p-4 flex-1 min-h-[300px]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-display font-semibold text-sm">Preview</h4>
              <Button size="sm" variant="outline" onClick={() => setShowPreview(true)} className="gap-1 text-xs">
                <Play className="h-3 w-3" /> Full Preview
              </Button>
            </div>
            {columns.length === 0 && groupRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Add columns or group fields to see a preview
              </p>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function FieldGroup({
  label,
  fields,
  usedFields,
  onAdd,
  onDragStart,
  fieldKeyFn,
}: {
  label: string;
  fields: (ReportField & { objectKey: string; prefix: string })[];
  usedFields: Set<string>;
  onAdd: (fk: string) => void;
  onDragStart: (field: string, source: string) => void;
  fieldKeyFn: (f: { objectKey: string; key: string }) => string;
}) {
  return (
    <div className="border-b border-border">
      <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
        {label} ({fields.length})
      </div>
      {fields.map((f) => {
        const fk = fieldKeyFn(f);
        const used = usedFields.has(fk);
        return (
          <div
            key={fk}
            draggable
            onDragStart={() => onDragStart(fk, "fields")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-grab hover:bg-accent/30 transition-colors ${
              used ? "opacity-50" : ""
            }`}
            onClick={() => !used && onAdd(fk)}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{f.type === "number" ? "#" : f.type === "date" ? "📅" : f.type === "boolean" ? "☑" : "A"}</span>
            <span className="truncate">{f.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DropZone({
  title,
  icon,
  items,
  getLabel,
  getObj,
  onRemove,
  onDrop,
  onDragOver,
  onDragStart,
  source,
}: {
  title: string;
  icon: string;
  items: string[];
  getLabel: (fk: string) => string;
  getObj: (fk: string) => string;
  onRemove: (fk: string) => void;
  onDrop: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragStart: (field: string, source: string) => void;
  source: string;
}) {
  return (
    <div
      className="data-table min-h-[120px] p-3 border-2 border-dashed border-border hover:border-primary/50 transition-colors"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
        <span>{icon}</span> {title}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4 opacity-50">
          Drag fields here
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((fk) => (
            <div
              key={fk}
              draggable
              onDragStart={() => onDragStart(fk, source)}
              className="flex items-center gap-1.5 bg-accent/30 rounded px-2 py-1 text-xs cursor-grab group"
            >
              <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-primary font-medium truncate">{getLabel(fk)}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">({getObj(fk)})</span>
              <button onClick={() => onRemove(fk)} className="ml-auto opacity-0 group-hover:opacity-100">
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
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
    { key: "gt", label: "Greater Than" },
    { key: "lt", label: "Less Than" },
    { key: "gte", label: "≥" },
    { key: "lte", label: "≤" },
    { key: "is_null", label: "Is Empty" },
    { key: "is_not_null", label: "Is Not Empty" },
  ];

  return (
    <div className="flex flex-wrap gap-2 items-end p-2 bg-muted/30 rounded-lg">
      <div className="flex-1 min-w-[120px]">
        <Label className="text-[10px] text-muted-foreground">Field</Label>
        <Select value={filter.field} onValueChange={(v) => onChange({ field: v })}>
          <SelectTrigger className="h-7 text-xs">
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
      </div>
      <div className="w-28">
        <Label className="text-[10px] text-muted-foreground">Operator</Label>
        <Select value={filter.operator} onValueChange={(v: any) => onChange({ operator: v })}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.key} value={op.key} className="text-xs">
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!["is_null", "is_not_null"].includes(filter.operator) && (
        <div className="flex-1 min-w-[100px]">
          <Label className="text-[10px] text-muted-foreground">Value</Label>
          <Input
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
            className="h-7 text-xs"
            placeholder="Value"
          />
        </div>
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}
