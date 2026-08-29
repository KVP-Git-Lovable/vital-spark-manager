import { useState, useEffect, useMemo } from "react";
import { useStackedTable } from "@/hooks/useStackedTable";
import { useNavigate } from "react-router-dom";
import { Search, Plus, MoreHorizontal, Phone, Mail, Filter, Loader2, Camera, Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ViewBar from "@/components/patients/listviews/ViewBar";
import ViewEditorDialog from "@/components/patients/listviews/ViewEditorDialog";
import PatientListViewTable from "@/components/patients/listviews/PatientListViewTable";
import { usePatientListViews } from "@/hooks/usePatientListViews";
import { applyFilters, sortRows, DEFAULT_VIEW_COLUMNS, type ListView } from "@/lib/patientFields";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { PatientFormSheet } from "@/components/patients/PatientFormSheet";
import { CameraCapture } from "@/components/shared/CameraCapture";
import { ImportPatientsDialog } from "@/components/patients/ImportPatientsDialog";
import { EngagementBadge } from "@/components/patients/EngagementBadge";
import { useEngagementScores } from "@/hooks/useEngagementScores";
import { buildOrFilter, buildFuzzyOrFilter, fuzzyRank } from "@/lib/fuzzySearch";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

const PAGE_SIZE = 50;

const PATIENT_FIELDS = [
  { value: "name", label: "Patient Name" },
  { value: "contact", label: "Contact" },
  { value: "skin_type", label: "Skin Type" },
  { value: "engagement", label: "Engagement" },
  { value: "status", label: "Status" },
  { value: "gender", label: "Gender" },
  { value: "age", label: "Age" },
  { value: "date_of_birth", label: "Date of Birth" },
];

const DEFAULT_PATIENT_FIELDS = ["name", "contact", "skin_type", "engagement", "status"];

const fetchPatientsPage = async (
  page: number,
  search: string
): Promise<{ rows: Patient[]; total: number }> => {
  const fromIdx = (page - 1) * PAGE_SIZE;
  const toIdx = fromIdx + PAGE_SIZE - 1;
  const term = search.trim();
  const cols = ["first_name", "last_name", "email", "phone"];

  let q = supabase
    .from("patients")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (term) {
    const tokens = term.split(/\s+/).filter(Boolean);

    // For 2+ token searches, try exact match first (first_name + last_name)
    if (tokens.length >= 2) {
      const [firstName, ...rest] = tokens;
      const lastName = rest.join(" ");

      // Step 1: Exact match (case-insensitive but whole word)
      const { data: exactMatch } = await supabase
        .from("patients")
        .select("*", { count: "exact" })
        .ilike("first_name", firstName)
        .ilike("last_name", lastName)
        .order("created_at", { ascending: false });

      if (exactMatch && exactMatch.length > 0) {
        return { rows: (exactMatch as Patient[]), total: exactMatch.length };
      }

      // Step 2: Prefix match (first_name starts with token AND last_name starts with lastName)
      const { data: prefixMatch } = await supabase
        .from("patients")
        .select("*", { count: "exact" })
        .ilike("first_name", `${firstName}%`)
        .ilike("last_name", `${lastName}%`)
        .order("created_at", { ascending: false });

      if (prefixMatch && prefixMatch.length > 0) {
        return { rows: (prefixMatch as Patient[]), total: prefixMatch.length };
      }
    } else if (tokens.length === 1) {
      // Single word: try exact match first
      const token = tokens[0];

      // Step 1: Exact match
      const { data: exactMatch } = await supabase
        .from("patients")
        .select("*", { count: "exact" })
        .or(`first_name.ilike.${token},last_name.ilike.${token}`)
        .order("created_at", { ascending: false });

      if (exactMatch && exactMatch.length > 0) {
        return { rows: (exactMatch as Patient[]), total: exactMatch.length };
      }

      // Step 2: Prefix match (starts with the term)
      const { data: prefixMatch } = await supabase
        .from("patients")
        .select("*")
        .or(`first_name.ilike.${token}%,last_name.ilike.${token}%`)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (prefixMatch && prefixMatch.length > 0) {
        return { rows: (prefixMatch as Patient[]), total: prefixMatch.length };
      }
    }

    // Final fallback: standard OR search (substring matching)
    const or = buildOrFilter(term, cols);
    if (or) q = q.or(or);
  }

  const { data, error, count } = await q;
  if (error) throw error;

  // Typo-tolerant fallback: nothing matched literally, so pull a loose candidate
  // set (matching the first few letters) and rank it by fuzzy similarity.
  if (term && (count ?? 0) === 0) {
    const looseOr = buildFuzzyOrFilter(term, ["first_name", "last_name"]);
    if (looseOr) {
      const { data: loose } = await supabase
        .from("patients")
        .select("*")
        .or(looseOr)
        .limit(300);
      const ranked = fuzzyRank(
        (loose as Patient[]) || [],
        term,
        (p) => `${p.first_name || ""} ${p.last_name || ""} ${p.phone || ""} ${p.email || ""}`,
        0.55
      );
      return { rows: ranked.slice(0, PAGE_SIZE), total: ranked.length };
    }
  }
  return { rows: (data as Patient[]) || [], total: count ?? 0 };
};

const Patients = () => {
  const patientsTableRef = useStackedTable<HTMLTableElement>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [cameraPatient, setCameraPatient] = useState<Patient | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingView, setEditingView] = useState<ListView | null>(null);
  const [display, setDisplay] = useState<"cards" | "table">("cards");
  const [deleteViewTarget, setDeleteViewTarget] = useState<ListView | null>(null);

  const {
    views,
    userId,
    activeView,
    selectView,
    saveView,
    deleteView,
    pinDefault,
  } = usePatientListViews("patients");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const viewActive = !!activeView;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["patients", page, debouncedSearch],
    queryFn: () => fetchPatientsPage(page, debouncedSearch),
    placeholderData: keepPreviousData,
    enabled: !viewActive,
  });

  const {
    data: allPatients = [],
    isLoading: viewLoading,
    isFetching: viewFetching,
    refetch: refetchAll,
  } = useQuery({
    queryKey: ["patients-all", debouncedSearch],
    queryFn: () => fetchAllPatients(debouncedSearch),
    placeholderData: keepPreviousData,
    enabled: viewActive,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-active-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, first_name, last_name").eq("is_active", true).order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const paged: Patient[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const patientIds = paged.map((p) => p.id);
  const { data: engagementScores = {} } = useEngagementScores(patientIds);

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  // Get columns to display based on current view or default
  const getDisplayColumns = () => {
    if (currentView?.display_fields && currentView.display_fields.length > 0) {
      return currentView.display_fields;
    }
    return DEFAULT_PATIENT_FIELDS;
  };

  const displayColumns = getDisplayColumns();

  // Check if a column should be displayed
  const shouldShowColumn = (column: string) => displayColumns.includes(column);

  const openAdd = () => {
    setEditingPatient(null);
    setSheetOpen(true);
  };

  const openEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setSheetOpen(true);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (paged.length === 0) return;
    if (paged.every((p) => selectedIds.has(p.id))) {
      const next = new Set(selectedIds);
      paged.forEach((p) => next.delete(p.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paged.forEach((p) => next.add(p.id));
      setSelectedIds(next);
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("patients").delete().in("id", ids);
    setDeleting(false);
    if (error) {
      toast.error(`Failed to delete: ${error.message}`);
      return;
    }
    toast.success(`Deleted ${ids.length} patient${ids.length > 1 ? "s" : ""}`);
    setSelectedIds(new Set());
    setConfirmOpen(false);
    refetch();
  };

  const allFilteredSelected = paged.length > 0 && paged.every((p) => selectedIds.has(p.id));

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">Manage your patient records</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewSelector
            views={views}
            selectedViewId={selectedViewId}
            onSelectView={setSelectedViewId}
            onCreateView={() => setShowNewViewDialog(true)}
            onDeleteView={deleteView}
            currentViewName={currentView?.name}
          />
          {selectedIds.size > 0 && (
            <Button variant="destructive" className="gap-2" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import Patients
          </Button>
          <Button className="gap-2 w-fit" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Patient
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="data-table"
      >
          <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              className="pl-9 bg-muted border-0"
              value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">{debouncedSearch ? "No patients match your search." : "No patients yet. Add your first patient!"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table ref={patientsTableRef} className="w-full responsive-table">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  {shouldShowColumn("name") && <th className="text-left text-xs font-medium text-muted-foreground p-4">Patient</th>}
                  {shouldShowColumn("contact") && <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Contact</th>}
                  {shouldShowColumn("skin_type") && <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Skin Type</th>}
                  {shouldShowColumn("engagement") && <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden sm:table-cell">Engagement</th>}
                  {shouldShowColumn("status") && <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>}
                  <th className="text-right text-xs font-medium text-muted-foreground p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((patient) => (
                  <tr key={patient.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/patients/${patient.id}`)}>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(patient.id)}
                        onCheckedChange={() => toggleOne(patient.id)}
                        aria-label={`Select ${patient.first_name}`}
                      />
                    </td>
                    {shouldShowColumn("name") && (
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-semibold text-sm shrink-0">
                            {(patient.first_name?.[0] || "?")}{(patient.last_name?.[0] || "")}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{`${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground">
                              {patient.gender || "—"}
                              {getAge(patient.date_of_birth) !== null && ` · Age ${getAge(patient.date_of_birth)}`}
                            </p>
                          </div>
                        </div>
                      </td>
                    )}
                    {shouldShowColumn("contact") && (
                      <td className="p-4 hidden md:table-cell">
                        <div className="space-y-1">
                          {patient.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {patient.phone}
                            </div>
                          )}
                          {patient.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {patient.email}
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                    {shouldShowColumn("skin_type") && (
                      <td className="p-4 hidden lg:table-cell">
                        <span className="text-sm">{patient.skin_type || "—"}</span>
                      </td>
                    )}
                    {shouldShowColumn("engagement") && (
                      <td className="p-4 hidden sm:table-cell">
                        <EngagementBadge data={engagementScores[patient.id]} />
                      </td>
                    )}
                    {shouldShowColumn("status") && (
                      <td className="p-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          patient.status === "Active"
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {patient.status}
                        </span>
                      </td>
                    )}
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(patient); }}>
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCameraPatient(patient); }}>
                            <Camera className="h-3.5 w-3.5 mr-1.5" /> Take Photo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Showing {total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, total)} of {total.toLocaleString()}
            {isFetching && !isLoading ? " · loading…" : ""}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      <PatientFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        patient={editingPatient}
        onSuccess={() => refetch()}
      />

      <ImportPatientsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => refetch()}
      />

      {cameraPatient && (
        <CameraCapture
          open={!!cameraPatient}
          onOpenChange={(o) => { if (!o) setCameraPatient(null); }}
          patientId={cameraPatient.id}
          patientName={`${cameraPatient.first_name} ${cameraPatient.last_name}`}
          context="patient"
        />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} patient{selectedIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected patient records will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewListViewDialog
        open={showNewViewDialog}
        onOpenChange={setShowNewViewDialog}
        section="patients"
        availableFields={PATIENT_FIELDS}
        defaultFields={DEFAULT_PATIENT_FIELDS}
        onCreate={createView}
        isLoading={isCreating}
        teamMembers={staffList.map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))}
        fieldOptions={{
          status: ["Active", "Inactive", "Archived"].map((s) => ({ value: s, label: s })),
          gender: ["Male", "Female", "Other"].map((s) => ({ value: s, label: s })),
          engagement: ["High", "Medium", "Low"].map((s) => ({ value: s, label: s })),
          skin_type: ["Oily", "Dry", "Combination", "Sensitive", "Normal"].map((s) => ({ value: s, label: s })),
        }}
      />
    </div>
  );
};

export default Patients;
