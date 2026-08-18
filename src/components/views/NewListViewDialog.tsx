import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Loader2, Trash2 } from "lucide-react";
import { ListViewConfig, Filter } from "@/hooks/useListViews";
import { Badge } from "@/components/ui/badge";

interface NewListViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: "appointments" | "procedures";
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
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [filterField, setFilterField] = useState(availableFields[0]?.value || "");
  const [filterOperator, setFilterOperator] = useState("equals");
  const [filterValue, setFilterValue] = useState("");

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
    });

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setViewName("");
    setDisplayFields(defaultFields);
    setSortBy("created_at");
    setSortDirection("desc");
    setFilters([]);
  };

  const toggleField = (field: string) => {
    setDisplayFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New View</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* View Name */}
          <div>
            <Label htmlFor="view-name" className="text-sm font-medium">
              View Name *
            </Label>
            <Input
              id="view-name"
              placeholder="e.g. My Open Appointments"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* Display Fields */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Display Fields</Label>
            <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-muted/30">
              {availableFields.map((field) => (
                <div key={field.value} className="flex items-center gap-2">
                  <Checkbox
                    id={field.value}
                    checked={displayFields.includes(field.value)}
                    onCheckedChange={() => toggleField(field.value)}
                  />
                  <Label htmlFor={field.value} className="text-sm font-normal cursor-pointer">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Sort Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sort-by" className="text-sm font-medium">
                Sort By
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

          {/* Filters Section */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Filters</Label>
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              {filters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No filters added yet</p>
              ) : (
                filters.map((filter, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-background rounded border">
                    <Badge variant="outline" className="text-xs">
                      {availableFields.find(f => f.value === filter.field)?.label || filter.field}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{filter.operator}</Badge>
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {Array.isArray(filter.value) ? filter.value.join(", ") : filter.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowFilterBuilder(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Filter
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreateView} disabled={isLoading} className="gap-2">
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
