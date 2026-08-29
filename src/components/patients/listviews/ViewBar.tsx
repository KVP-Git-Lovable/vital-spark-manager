import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ListFilter, Pencil, Pin, Plus, Trash2, LayoutGrid, Table2, Copy, BarChart3 } from "lucide-react";
import type { ListView } from "@/lib/patientFields";

interface Props {
  views: ListView[];
  activeView: ListView | null;
  currentUserId?: string;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onEdit: (v: ListView) => void;
  onDelete: (v: ListView) => void;
  onPin: (v: ListView | null) => void;
  onClone: (v: ListView) => void;
  display: "cards" | "table";
  onDisplayChange: (d: "cards" | "table") => void;
  count: number;
  chartsOpen?: boolean;
  onToggleCharts?: () => void;
}

export default function ViewBar({
  views,
  activeView,
  currentUserId,
  onSelect,
  onNew,
  onEdit,
  onDelete,
  onPin,
  onClone,
  display,
  onDisplayChange,
  count,
  chartsOpen,
  onToggleCharts,
}: Props) {
  const canManage = activeView && activeView.owner_id === currentUserId;

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border bg-card shadow-sm px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-base font-semibold max-w-[60vw]">
              <ListFilter className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{activeView ? activeView.name : "All Patients"}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 bg-popover z-50">
            <DropdownMenuLabel className="text-xs">List Views</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onSelect(null)}>All Patients</DropdownMenuItem>
            <DropdownMenuSeparator />
            {views.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet.</div>
            )}
            {views.map((v) => (
              <DropdownMenuItem key={v.id} onClick={() => onSelect(v.id)} className="flex items-center gap-2">
                <span className="truncate flex-1">{v.name}</span>
                {v.is_default && <Pin className="h-3 w-3 opacity-60" />}
                {v.visibility !== "private" && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">
                    {v.visibility === "everyone" ? "All" : "Shared"}
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNew} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              New View
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-xs text-muted-foreground shrink-0">{count} items</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-none"
            title={activeView ? "Pin as default view" : "Pin All Patients as default"}
            onClick={() => onPin(activeView)}
          >
            <Pin
              className={`h-4 w-4 ${
                (activeView ? activeView.is_default : !views.some((v) => v.is_default))
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            />
          </Button>
          {activeView && (
            <>
              <span className="w-px h-5 bg-border" />
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" title="Clone view" onClick={() => onClone(activeView)}>
                <Copy className="h-4 w-4 text-muted-foreground" />
              </Button>
            </>
          )}
          {activeView && canManage && (
            <>
              <span className="w-px h-5 bg-border" />
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" title="Edit view" onClick={() => onEdit(activeView)}>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
              <span className="w-px h-5 bg-border" />
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" title="Delete view" onClick={() => onDelete(activeView)}>
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </>
          )}
        </div>

        {activeView && onToggleCharts && (
          <Button
            variant={chartsOpen ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            title="Charts"
            onClick={onToggleCharts}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
          <button
            type="button"
            aria-label="Card view"
            className={`px-2.5 py-2 transition-colors ${display === "cards" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            onClick={() => onDisplayChange("cards")}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <span className="w-px h-5 bg-border" />
          <button
            type="button"
            aria-label="Table view"
            className={`px-2.5 py-2 transition-colors ${display === "table" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            onClick={() => onDisplayChange("table")}
          >
            <Table2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
