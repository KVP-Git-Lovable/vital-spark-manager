import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Loader2, Trash2, ChevronRight, ChevronLeft, ChevronUp, ChevronDown } from "lucide-react";
import { ListViewConfig, Filter } from "@/hooks/useListViews";
import { Badge } from "@/components/ui/badge";

interface NewListViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: "appointments" | "procedures" | "patients" | "billing";
  availableFields: { value: string; label: string }[];
  defaultFields: string[];
  onCreate: (config: ListViewConfig) => Promise<void>;
  isLoading?: boolean;
}

export function NewListViewDialog({
  open,
  onOpenChange,
  section,
  availableFields,
  defaultFields,
  onCreate,
  isLoading = false,
}: NewListViewDialogProps) {
  const [viewName, setViewName] = useState("");
  const [displayFields, setDisplayFields] = useState<string[]>(defaultFields);
  const [sortBy, setSortBy] = useState(availableFields[0]?.value || "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [filterLogic, setFilterLogic] = useState<"all" | "any">("all");
  const [isShared, setIsShared] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [filterField, setFilterField] = useState(availableFields[0]?.value || "");
  const [filterOperator, setFilterOperator] = useState("equals");
  const [filterValue, setFilterValue] = useState("");

  const availableFieldOptions = availableFields.filter((f) => !displayFields.includes(f.value));
  const visibleFieldOptions = displayFields.map((f) =>
    availableFields.find((af) => af.value === f)
  ).filter(Boolean) as { value: string; label: string }[];

  const handleCreateView = async () => {
    if (!viewName.trim()) {
      alert("Please enter a view name");
      return;
    }

    if (displayFields.length === 0) {
      alert("Please select at least one field to display");
      return;
    }

    await onCreate({
      name: viewName,
      section,
      filters,
      displayFields,
      sortBy,
      sortDirection,
      isShared,
    });

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setViewName("");
    setDisplayFields(defaultFields);
    setSortBy(availableFields[0]?.value || "");
    setSortDirection("desc");
    setFilters([]);
    setFilterLogic("all");
    setIsShared(false);
  };

  const moveFieldToVisible = (field: string) => {
    setDisplayFields([...displayFields, field]);
  };

  const moveFieldToAvailable = (field: string) => {
    setDisplayFields(displayFields.filter((f) => f !== field));
  };

  const moveFieldUp = (index: number) => {
    if (index > 0) {
      const newFields = [...displayFields];
      [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
      setDisplayFields(newFields);
    }
  };

  const moveFieldDown = (index: number) => {
    if (index < displayFields.length - 1) {
      const newFields = [...displayFields];
      [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
      setDisplayFields(newFields);
    }
  };

  const addFilter = () => {
    if (!filterField || !filterValue.trim()) {
      alert("Please select a field and enter a value");
      return;
    }
    setFilters([...filters, { field: filterField, operator: filterOperator, value: filterValue }]);
    setFilterField(availableFields[0]?.value || "");
    setFilterOperator("equals");
    setFilterValue("");
    setShowFilterBuilder(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New List View</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* View Name */}
          <div>
            <Label htmlFor="view-name" className="text-sm font-medium">
              View Name *
            </Label>
            <Input
              id="view-name"
              placeholder="e.g. My Open Requisitions"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* Filters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Filters</span>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterLogic} onValueChange={(v) => setFilterLogic(v as "all" | "any")}>
                  <SelectTrigger className="w-48 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Match ALL filters</SelectItem>
                    <SelectItem value="any">Match ANY filter</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setShowFilterBuilder(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-muted/20 min-h-[60px]">
              {filters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No filters — this view shows all records.</p>
              ) : (
                <div className="space-y-2">
                  {filters.map((filter, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                      <Badge variant="secondary" className="text-xs">
                        {availableFields.find((f) => f.value === filter.field)?.label || filter.field}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">{filter.operator}</Badge>
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {Array.isArray(filter.value) ? filter.value.join(", ") : filter.value}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Display Fields - Dual Panel */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Display Fields</Label>
            <div className="grid grid-cols-3 gap-4">
              {/* Available Fields */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Available Fields</p>
                <div className="border rounded-lg bg-white p-3 min-h-[280px] space-y-1 overflow-y-auto">
                  {availableFieldOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">All fields are visible</p>
                  ) : (
                    availableFieldOptions.map((field) => (
                      <div
                        key={field.value}
                        className="flex items-center justify-between p-2.5 hover:bg-muted/50 rounded cursor-pointer group text-sm"
                      >
                        <span>{field.label}</span>
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chevron Buttons */}
              <div className="flex flex-col items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    const firstAvailable = availableFieldOptions[0]?.value;
                    if (firstAvailable) moveFieldToVisible(firstAvailable);
                  }}
                  disabled={availableFieldOptions.length === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    const lastVisible = displayFields[displayFields.length - 1];
                    if (lastVisible) moveFieldToAvailable(lastVisible);
                  }}
                  disabled={visibleFieldOptions.length === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              {/* Visible Fields */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Visible Fields (In Order)</p>
                <div className="border rounded-lg bg-white p-3 min-h-[280px] space-y-1 overflow-y-auto">
                  {visibleFieldOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Select fields to display</p>
                  ) : (
                    visibleFieldOptions.map((field, idx) => (
                      <div
                        key={field?.value}
                        className="flex items-center justify-between p-2.5 bg-muted/30 rounded border text-sm"
                      >
                        <span className="flex-1">{field?.label}</span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0"
                            disabled={idx === 0}
                            onClick={() => moveFieldUp(idx)}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0"
                            disabled={idx === visibleFieldOptions.length - 1}
                            onClick={() => moveFieldDown(idx)}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sort Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sort-by" className="text-sm font-medium">
                Sort by
              </Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger id="sort-by" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sort-direction" className="text-sm font-medium">
                Direction
              </Label>
              <Select value={sortDirection} onValueChange={(v) => setSortDirection(v as "asc" | "desc")}>
                <SelectTrigger id="sort-direction" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sharing */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Sharing</Label>
            <Select value={isShared ? "shared" : "private"} onValueChange={(v) => setIsShared(v === "shared")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Only me</SelectItem>
                <SelectItem value="shared">Specific people (coming soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreateView} disabled={isLoading} className="gap-2 min-w-[120px]">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create View
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Filter Builder Dialog */}
      <Dialog open={showFilterBuilder} onOpenChange={setShowFilterBuilder}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Filter</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="filter-field" className="text-sm font-medium">
                Field
              </Label>
              <Select value={filterField} onValueChange={setFilterField}>
                <SelectTrigger id="filter-field" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-operator" className="text-sm font-medium">
                Operator
              </Label>
              <Select value={filterOperator} onValueChange={setFilterOperator}>
                <SelectTrigger id="filter-operator" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="starts_with">Starts With</SelectItem>
                  <SelectItem value="ends_with">Ends With</SelectItem>
                  <SelectItem value="greater_than">Greater Than</SelectItem>
                  <SelectItem value="less_than">Less Than</SelectItem>
                  <SelectItem value="is_empty">Is Empty</SelectItem>
                  <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterOperator !== "is_empty" && filterOperator !== "is_not_empty" && (
              <div>
                <Label htmlFor="filter-value" className="text-sm font-medium">
                  Value
                </Label>
                <Input
                  id="filter-value"
                  placeholder="Enter filter value"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowFilterBuilder(false)}>
                Cancel
              </Button>
              <Button onClick={addFilter}>Add Filter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
