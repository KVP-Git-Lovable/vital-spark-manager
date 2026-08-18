import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Loader2 } from "lucide-react";
import { ListViewConfig, Filter } from "@/hooks/useListViews";

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

          {/* Filters Section (Placeholder for now) */}
          <div>
            <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
              Filters (Coming Soon)
            </Label>
            <div className="p-3 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
              Filter functionality will be added in the next phase
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
    </Dialog>
  );
}
