import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus, Search, Camera, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraCapture } from "@/components/shared/CameraCapture";
import { ProcedureFormDialog } from "@/components/procedures/ProcedureFormDialog";
import { ProcedureDetailSheet } from "@/components/procedures/ProcedureDetailSheet";
import { ImportProceduresDialog } from "@/components/procedures/ImportProceduresDialog";
import { ViewSelector } from "@/components/views/ViewSelector";
import { NewListViewDialog } from "@/components/views/NewListViewDialog";
import { useListViews } from "@/hooks/useListViews";
import { toast } from "sonner";
import { SalesforceSyncButton } from "@/components/salesforce/SalesforceSyncButton";
import { withDrPrefix } from "@/lib/staffName";

const PROCEDURE_FIELDS = [
  { value: "procedure_date", label: "Date" },
  { value: "patient", label: "Patient" },
  { value: "service_name", label: "Service" },
  { value: "doctor", label: "Doctor" },
  { value: "status", label: "Status" },
];

const DEFAULT_PROCEDURE_FIELDS = ["procedure_date", "patient", "service_name", "doctor", "status"];

// Salesforce-imported procedures rarely have procedures.staff_id set (the
// source object has no doctor field of its own) - fall back to the doctor
// on the procedure's linked appointment, which the import does set.
const getProcedureDoctor = (proc: any) => {
  const s = proc.staff || proc.appointments?.staff;
  const full = s ? [s.first_name, s.last_name].filter(Boolean).join(" ").trim() : "";
  return full ? withDrPrefix(full) : "";
};

const Procedures = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showNewViewDialog, setShowNewViewDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const [cameraProc, setCameraProc] = useState<any>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | HTMLDivElement | null>>({});
  const queryClient = useQueryClient();

  const { views, currentView, selectedViewId, setSelectedViewId, createView, deleteView, isCreating } = useListViews("procedures");

  const handleProcedureSaved = useCallback((savedId: string) => {
    setHighlightedId(savedId);
    // Scroll to the row after a short delay to let the sheet close
    setTimeout(() => {
      rowRefs.current[savedId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    toast.success("Procedure saved", {
      description: "View Record",
      action: {
        label: "View Record",
        onClick: () => setSelectedId(savedId),
      },
      duration: 6000,
    });
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedId(null), 3000);
  }, []);

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ["procedures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedures")
        .select("*, patients(first_name, last_name), staff:staff!procedures_staff_id_fkey(first_name, last_name), appointments(staff:staff_id(first_name, last_name))")
        .order("procedure_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-active-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, first_name, last_name, role").eq("is_active", true).order("first_name");
      if (error) throw error;
      return data;
    },
  });

  let filtered = procedures.filter((p: any) => {
    const name = `${p.patients?.first_name || ""} ${p.patients?.last_name || ""}`.toLowerCase();
    return name.includes(search.toLowerCase()) || p.service_name?.toLowerCase().includes(search.toLowerCase());
  });

  // Get columns to display based on current view or default
  const getDisplayColumns = () => {
    if (currentView?.display_fields && currentView.display_fields.length > 0) {
      return currentView.display_fields;
    }
    return DEFAULT_PROCEDURE_FIELDS;
  };

  const displayColumns = getDisplayColumns();

  // Check if a column should be displayed
  const shouldShowColumn = (column: string) => displayColumns.includes(column);

  // Apply view filters
  const applyViewFilters = (items: any[]) => {
    if (!currentView?.filters || currentView.filters.length === 0) return items;
    return items.filter((proc) => {
      return currentView.filters.every((filter) => {
        const fieldValue = getFieldValue(proc, filter.field);
        return applyFilterCondition(fieldValue, filter.operator, filter.value);
      });
    });
  };

  const getFieldValue = (proc: any, field: string) => {
    switch (field) {
      case "procedure_date": return new Date(proc.procedure_date).toLocaleDateString();
      case "patient": return `${proc.patients?.first_name || ""} ${proc.patients?.last_name || ""}`;
      case "service_name": return proc.service_name || "";
      case "doctor": return getProcedureDoctor(proc);
      case "status": return proc.status || "";
      default: return "";
    }
  };

  const applyFilterCondition = (value: any, operator: string, filterValue: any) => {
    const val = String(value).toLowerCase();
    const fval = String(filterValue).toLowerCase();
    switch (operator) {
      case "equals": return val === fval;
      case "contains": return val.includes(fval);
      case "starts_with": return val.startsWith(fval);
      case "ends_with": return val.endsWith(fval);
      case "greater_than": return Number(value) > Number(filterValue);
      case "less_than": return Number(value) < Number(filterValue);
      case "is_empty": return !value || value === "";
      case "is_not_empty": return value && value !== "";
      default: return true;
    }
  };

  // Apply view filters to filtered items
  filtered = applyViewFilters(filtered);

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="page-title">Procedures</h1>
          <p className="page-subtitle">Record consultations, procedures & prescriptions</p>
        </div>
        <div className="flex gap-2 w-fit flex-wrap">
          <ViewSelector
            views={views}
            selectedViewId={selectedViewId}
            onSelectView={setSelectedViewId}
            onCreateView={() => setShowNewViewDialog(true)}
            onDeleteView={deleteView}
            currentViewName={currentView?.name}
          />
          <SalesforceSyncButton />
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import Procedures
          </Button>
          <Button className="gap-2" onClick={() => navigate("/procedures/new")}>
            <Plus className="h-4 w-4" />
            New Procedure
          </Button>
        </div>
      </div>

      <div className="relative max-w-md mb-4 md:mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by patient or service..." className="pl-9 bg-card border" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No procedures found</div>
        ) : (
          filtered.map((proc: any) => (
            <motion.div
              key={proc.id}
              ref={(el) => { rowRefs.current[proc.id] = el; }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`stat-card p-3 cursor-pointer active:scale-[0.98] transition-all duration-500 ${highlightedId === proc.id ? "ring-2 ring-primary bg-primary/5" : ""}`}
              onClick={() => setSelectedId(proc.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{proc.patients?.first_name} {proc.patients?.last_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{proc.service_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getProcedureDoctor(proc) || "—"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="secondary" className="text-xs">{proc.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(proc.procedure_date).toLocaleDateString()}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setCameraProc(proc); }}>
                    <Camera className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="hidden md:block data-table">
        <Table>
          <TableHeader>
            <TableRow>
              {shouldShowColumn("procedure_date") && <TableHead>Date</TableHead>}
              {shouldShowColumn("patient") && <TableHead>Patient</TableHead>}
              {shouldShowColumn("service_name") && <TableHead>Service</TableHead>}
              {shouldShowColumn("doctor") && <TableHead>Doctor</TableHead>}
              {shouldShowColumn("status") && <TableHead>Status</TableHead>}
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={displayColumns.length + 1} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={displayColumns.length + 1} className="text-center py-8 text-muted-foreground">No procedures found</TableCell></TableRow>
            ) : (
              filtered.map((proc: any) => (
                <TableRow key={proc.id} ref={(el) => { rowRefs.current[proc.id] = el; }} className={`cursor-pointer hover:bg-muted/50 transition-all duration-500 ${highlightedId === proc.id ? "ring-2 ring-primary bg-primary/5" : ""}`} onClick={() => setSelectedId(proc.id)}>
                  {shouldShowColumn("procedure_date") && <TableCell className="text-sm">{new Date(proc.procedure_date).toLocaleDateString()}</TableCell>}
                  {shouldShowColumn("patient") && <TableCell className="font-medium">{proc.patients?.first_name} {proc.patients?.last_name}</TableCell>}
                  {shouldShowColumn("service_name") && <TableCell>{proc.service_name}</TableCell>}
                  {shouldShowColumn("doctor") && (
                    <TableCell className="text-sm text-muted-foreground">
                      {getProcedureDoctor(proc) || "—"}
                    </TableCell>
                  )}
                  {shouldShowColumn("status") && (
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{proc.status}</Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setCameraProc(proc); }} title="Take Photo">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </motion.div>

      {createOpen && (
        <ProcedureFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}

      <ImportProceduresDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["procedures"] })}
      />

      <ProcedureDetailSheet
        procedureId={selectedId}
        onClose={() => {
          setSelectedId(null);
          if (searchParams.get("id")) {
            const next = new URLSearchParams(searchParams);
            next.delete("id");
            setSearchParams(next, { replace: true });
          }
        }}
        onSaved={handleProcedureSaved}
      />

      {cameraProc && (
        <CameraCapture
          open={!!cameraProc}
          onOpenChange={(o) => { if (!o) setCameraProc(null); }}
          patientId={cameraProc.patient_id}
          patientName={`${cameraProc.patients?.first_name || ""} ${cameraProc.patients?.last_name || ""}`}
          context="procedure"
          contextId={cameraProc.id}
        />
      )}

      <NewListViewDialog
        open={showNewViewDialog}
        onOpenChange={setShowNewViewDialog}
        section="procedures"
        availableFields={PROCEDURE_FIELDS}
        defaultFields={DEFAULT_PROCEDURE_FIELDS}
        onCreate={createView}
        isLoading={isCreating}
        teamMembers={staffList.map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))}
        fieldOptions={{
          doctor: staffList.filter((s: any) => s.role === "Doctor").map((s: any) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })),
          status: ["Pending", "Completed", "Cancelled"].map((s) => ({ value: s, label: s })),
        }}
      />
    </div>
  );
};

export default Procedures;
