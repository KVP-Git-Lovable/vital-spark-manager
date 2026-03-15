import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Link2,
  Layers,
} from "lucide-react";
import {
  REPORT_OBJECTS,
  getObjectByKey,
  getRelatedObjects,
  getJoinPresets,
  generateReportName,
  CHART_TYPES,
  type SavedReport,
  type ReportFilter,
  type ReportField,
} from "@/lib/reportObjects";
import { ReportPreview } from "./ReportPreview";
import { FilterRow } from "./FilterRow";

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
  onSaveAndRun: (r: SavedReport) => void;
  onClose: () => void;
  folders: { id: string; name: string }[];
}

export function ReportBuilder({ initial, onSave, onSaveAndRun, onClose, folders }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [primaryObject, setPrimaryObject] = useState(initial?.primary_object || "");
  const [relatedObject, setRelatedObject] = useState(initial?.related_object || "");
  const [columns, setColumns] = useState<string[]>(initial?.columns || []);
  const [groupRows, setGroupRows] = useState<string[]>(initial?.group_rows || []);
  const [groupColumns, setGroupColumns] = useState<string[]>(initial?.group_columns || []);
  const [filters, setFilters] = useState<ReportFilter[]>(initial?.filters || []);
  const [chartType, setChartType] = useState(initial?.chart_type || "table");
  const [folderId, setFolderId] = useState(initial?.folder_id || "");
  const [fieldSearch, setFieldSearch] = useState("");
  const [leftTab, setLeftTab] = useState("fields");
  const [objectSearch, setObjectSearch] = useState("");
  const [collapsedObjects, setCollapsedObjects] = useState<Set<string>>(new Set());

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

  const moveField = (fk: string, from: string, dir: "up" | "down") => {
    const setter = from === "columns" ? setColumns : from === "groupRows" ? setGroupRows : setGroupColumns;
    setter((prev) => {
      const arr = [...prev];
      const idx = arr.indexOf(fk);
      if (idx < 0) return arr;
      const newIdx = dir === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= arr.length) return arr;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
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

  const toggleCollapse = (objKey: string) => {
    setCollapsedObjects((prev) => {
      const next = new Set(prev);
      if (next.has(objKey)) next.delete(objKey);
      else next.add(objKey);
      return next;
    });
  };

  const [showPreview, setShowPreview] = useState(false);

  const buildReport = (): SavedReport | null => {
    if (!name.trim()) {
      toast.error("Please enter a report name");
      return null;
    }
    return {
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
      folder_id: folderId || null,
    };
  };

  const handleSave = () => {
    const r = buildReport();
    if (r) onSave(r);
  };

  const handleSaveAndRun = () => {
    const r = buildReport();
    if (r) onSaveAndRun(r);
  };

  const handleRun = () => {
    setShowPreview(true);
  };

  // Step 1: Select objects
  if (!primaryObject) {
    const joinPresets = getJoinPresets();
    const filteredObjects = REPORT_OBJECTS.filter((o) =>
      o.label.toLowerCase().includes(objectSearch.toLowerCase())
    );
    const filteredPresets = joinPresets.filter((p) =>
      p.label.toLowerCase().includes(objectSearch.toLowerCase())
    );

    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Create Report</h1>
            <p className="text-sm text-muted-foreground">Choose an object or a joined combination</p>
          </div>
        </div>
        <div className="data-table overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search objects..."
                value={objectSearch}
                onChange={(e) => setObjectSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {/* Joined Reports */}
            {filteredPresets.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-primary/5 text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" /> Joined Reports
                </div>
                <div className="divide-y divide-border">
                  {filteredPresets.map((jp) => (
                    <button
                      key={`${jp.primary}+${jp.related}`}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                      onClick={() => {
                        setPrimaryObject(jp.primary);
                        setRelatedObject(jp.related);
                        setName(generateReportName(jp.primary, jp.related));
                        setObjectSearch("");
                      }}
                    >
                      <div>
                        <span className="font-medium text-foreground">{jp.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{jp.fieldCount} fields</span>
                      </div>
                      <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" /> Joined</Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Objects */}
            <div>
              <div className="px-4 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Individual Objects
              </div>
              <div className="divide-y divide-border">
                {filteredObjects.map((obj) => (
                  <button
                    key={obj.key}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                    onClick={() => {
                      setPrimaryObject(obj.key);
                      setName(generateReportName(obj.key));
                      setObjectSearch("");
                    }}
                  >
                    <div>
                      <span className="font-medium text-foreground">{obj.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{obj.fields.length} fields</span>
                      {obj.relations && obj.relations.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          · {obj.relations.length} relation{obj.relations.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary">{obj.table}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Builder
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

        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleRun}>
          <Play className="h-3 w-3" /> Run
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleSave}>
          <Save className="h-3 w-3" /> Save
        </Button>
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSaveAndRun}>
          <Play className="h-3 w-3" /> Save & Run
        </Button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-72 md:w-80 border-r border-border flex flex-col shrink-0 bg-card overflow-hidden">
          {/* Related object + folder + description */}
          <div className="px-3 py-2 border-b border-border space-y-2">
            {relatedOptions.length > 0 && (
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Related Object</Label>
                <Select value={relatedObject || "none"} onValueChange={(v) => {
                  const newRel = v === "none" ? "" : v;
                  setRelatedObject(newRel);
                  if (!initial) setName(generateReportName(primaryObject, newRel || undefined));
                }}>
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
            {folders.length > 0 && (
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Folder</Label>
                <Select value={folderId || "none"} onValueChange={(v) => setFolderId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="No folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="h-7 text-xs"
            />
          </div>

          <Tabs value={leftTab} onValueChange={setLeftTab} className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mx-3 mt-2 mb-1 h-8">
              <TabsTrigger value="fields" className="text-xs flex-1 gap-1">
                <Table className="h-3 w-3" /> Fields
              </TabsTrigger>
              <TabsTrigger value="grouping" className="text-xs flex-1 gap-1">
                <GripVertical className="h-3 w-3" /> Grouping
                {(groupRows.length + groupColumns.length + columns.length) > 0 && (
                  <Badge className="h-4 px-1 text-[9px] ml-1">{groupRows.length + groupColumns.length + columns.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="filters" className="text-xs flex-1 gap-1">
                <Filter className="h-3 w-3" /> Filters
                {filters.length > 0 && <Badge className="h-4 px-1 text-[9px] ml-1">{filters.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* TAB: Fields — Available fields browser with collapsible objects */}
            <TabsContent value="fields" className="flex-1 overflow-y-auto mt-0 px-3 pb-3 space-y-3">
              <div>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search fields..."
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">Click a field to add it as a column</p>
                <div className="border border-border rounded max-h-[calc(100vh-16rem)] overflow-y-auto">
                  {primaryObj && (
                    <ObjectFieldTree
                      obj={primaryObj}
                      objectKey={primaryObject}
                      fields={filteredFields.filter((f) => f.objectKey === primaryObject)}
                      usedFields={usedFields}
                      fieldKeyStr={fieldKeyStr}
                      collapsed={collapsedObjects.has(primaryObject)}
                      onToggle={() => toggleCollapse(primaryObject)}
                      onAdd={(fk) => addFieldTo(fk, "columns")}
                    />
                  )}
                  {relatedObj && (
                    <ObjectFieldTree
                      obj={relatedObj}
                      objectKey={relatedObject}
                      fields={filteredFields.filter((f) => f.objectKey === relatedObject)}
                      usedFields={usedFields}
                      fieldKeyStr={fieldKeyStr}
                      collapsed={collapsedObjects.has(relatedObject)}
                      onToggle={() => toggleCollapse(relatedObject)}
                      onAdd={(fk) => addFieldTo(fk, "columns")}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB: Grouping — Group Rows, Group Columns, then Columns */}
            <TabsContent value="grouping" className="flex-1 overflow-y-auto mt-0 px-3 pb-3 space-y-4">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                  Group Rows ({groupRows.length})
                </Label>
                <FieldSearchAndAdd
                  allFields={filteredFields}
                  usedFields={usedFields}
                  fieldKeyFn={fieldKeyStr}
                  onAdd={(fk) => addFieldTo(fk, "groupRows")}
                  placeholder="Search & add group row..."
                />
                <ReorderableList
                  items={groupRows}
                  getLabel={getFieldLabel}
                  onRemove={(fk) => removeField(fk, "groupRows")}
                  onMove={(fk, dir) => moveField(fk, "groupRows", dir)}
                />
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                  Group Columns ({groupColumns.length})
                </Label>
                <FieldSearchAndAdd
                  allFields={filteredFields}
                  usedFields={usedFields}
                  fieldKeyFn={fieldKeyStr}
                  onAdd={(fk) => addFieldTo(fk, "groupColumns")}
                  placeholder="Search & add group column..."
                />
                <ReorderableList
                  items={groupColumns}
                  getLabel={getFieldLabel}
                  onRemove={(fk) => removeField(fk, "groupColumns")}
                  onMove={(fk, dir) => moveField(fk, "groupColumns", dir)}
                />
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                  Columns ({columns.length})
                </Label>
                <FieldSearchAndAdd
                  allFields={filteredFields}
                  usedFields={usedFields}
                  fieldKeyFn={fieldKeyStr}
                  onAdd={(fk) => addFieldTo(fk, "columns")}
                  placeholder="Search & add column..."
                />
                <ReorderableList
                  items={columns}
                  getLabel={getFieldLabel}
                  onRemove={(fk) => removeField(fk, "columns")}
                  onMove={(fk, dir) => moveField(fk, "columns", dir)}
                />
              </div>
            </TabsContent>

            {/* TAB: Filters */}
            <TabsContent value="filters" className="flex-1 overflow-y-auto mt-0 px-3 pb-3">
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
                {filters.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No filters applied.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT — Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-background">
          {!showPreview && (columns.length === 0 && groupRows.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
              <Table className="h-12 w-12 opacity-20" />
              <p className="text-sm">Add columns or group fields to see a preview</p>
              <p className="text-xs">Use the Fields tab to add columns, Grouping tab for row/column groups</p>
            </div>
          ) : !showPreview ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
              <Play className="h-12 w-12 opacity-20" />
              <p className="text-sm">Click "Run" to preview the report</p>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleRun}>
                <Play className="h-3 w-3" /> Run Preview
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground flex-wrap">
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">Preview</span>
                {groupRows.length > 0 && (
                  <span>Grouped by: {groupRows.map(getFieldLabel).join(", ")}</span>
                )}
                {filters.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Filter className="h-2.5 w-2.5 mr-1" /> {filters.length} filter{filters.length > 1 ? "s" : ""}
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-5 text-[10px] ml-auto" onClick={() => setShowPreview(false)}>
                  Hide Preview
                </Button>
              </div>

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
            </>
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

function ObjectFieldTree({
  obj,
  objectKey,
  fields,
  usedFields,
  fieldKeyStr,
  collapsed,
  onToggle,
  onAdd,
}: {
  obj: { label: string };
  objectKey: string;
  fields: (ReportField & { objectKey: string; prefix: string })[];
  usedFields: Set<string>;
  fieldKeyStr: (f: { objectKey: string; key: string }) => string;
  collapsed: boolean;
  onToggle: () => void;
  onAdd: (fk: string) => void;
}) {
  return (
    <div>
      <button
        className="w-full px-2 py-1.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 flex items-center gap-1 hover:bg-muted/60 transition-colors"
        onClick={onToggle}
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-90"}`} />
        {obj.label}
        <span className="ml-auto text-[9px] font-normal">{fields.length} fields</span>
      </button>
      {!collapsed && fields.map((f) => {
        const fk = fieldKeyStr(f);
        const used = usedFields.has(fk);
        return (
          <button
            key={fk}
            className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-accent/30 transition-colors text-left ${used ? "opacity-40" : ""}`}
            onClick={() => !used && onAdd(fk)}
            disabled={used}
          >
            <TypeIcon type={f.type} />
            <span className="truncate">{f.label}</span>
            {used && <Badge variant="secondary" className="text-[8px] px-1 ml-auto">In use</Badge>}
          </button>
        );
      })}
    </div>
  );
}

function FieldSearchAndAdd({
  allFields,
  usedFields,
  fieldKeyFn,
  onAdd,
  placeholder,
}: {
  allFields: (ReportField & { objectKey: string; prefix: string })[];
  usedFields: Set<string>;
  fieldKeyFn: (f: { objectKey: string; key: string }) => string;
  onAdd: (fk: string) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = allFields.filter(
    (f) => !usedFields.has(fieldKeyFn(f)) && f.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mb-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="pl-6 h-7 text-[11px]"
        />
      </div>
      {open && search && filtered.length > 0 && (
        <div className="max-h-32 overflow-y-auto bg-popover border border-border rounded mt-1 shadow-md z-10 relative">
          {filtered.slice(0, 10).map((f) => {
            const fk = fieldKeyFn(f);
            return (
              <button
                key={fk}
                className="w-full text-left px-2 py-1 text-[11px] hover:bg-accent/50 flex items-center gap-1"
                onMouseDown={(e) => { e.preventDefault(); onAdd(fk); setSearch(""); setOpen(false); }}
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

function ReorderableList({
  items,
  getLabel,
  onRemove,
  onMove,
}: {
  items: string[];
  getLabel: (fk: string) => string;
  onRemove: (fk: string) => void;
  onMove: (fk: string, dir: "up" | "down") => void;
}) {
  if (items.length === 0) {
    return <p className="text-[10px] text-muted-foreground text-center py-2 opacity-50">No fields added yet</p>;
  }

  return (
    <div className="space-y-0.5 border border-border rounded p-1">
      {items.map((fk, idx) => (
        <div key={fk} className="flex items-center gap-1 bg-primary/10 rounded px-1.5 py-1 text-[11px] group">
          <span className="text-primary font-medium truncate flex-1">{getLabel(fk)}</span>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => onMove(fk, "up")} disabled={idx === 0} className="h-4 w-4 flex items-center justify-center rounded hover:bg-primary/20 disabled:opacity-30" title="Move up">
              <ChevronUp className="h-3 w-3 text-primary" />
            </button>
            <button onClick={() => onMove(fk, "down")} disabled={idx === items.length - 1} className="h-4 w-4 flex items-center justify-center rounded hover:bg-primary/20 disabled:opacity-30" title="Move down">
              <ChevronDown className="h-3 w-3 text-primary" />
            </button>
            <button onClick={() => onRemove(fk)} className="h-4 w-4 flex items-center justify-center rounded hover:bg-destructive/20" title="Remove">
              <X className="h-3 w-3 text-destructive" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

