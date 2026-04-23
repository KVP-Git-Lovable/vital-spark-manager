import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, MoreHorizontal, Phone, Mail, Filter, Loader2, Camera, Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useQuery } from "@tanstack/react-query";
import { PatientFormSheet } from "@/components/patients/PatientFormSheet";
import { CameraCapture } from "@/components/shared/CameraCapture";
import { ImportPatientsDialog } from "@/components/patients/ImportPatientsDialog";
import { EngagementBadge } from "@/components/patients/EngagementBadge";
import { useEngagementScores } from "@/hooks/useEngagementScores";
import { fetchAll } from "@/lib/supabasePaginate";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

const fetchPatients = async (): Promise<Patient[]> => {
  return await fetchAll<Patient>((from, to) =>
    supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to)
  );
};

const Patients = () => {
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
  const PAGE_SIZE = 50;

  const { data: patients = [], isLoading, refetch } = useQuery({
    queryKey: ["patients"],
    queryFn: fetchPatients,
  });

  const patientIds = patients.map((p) => p.id);
  const { data: engagementScores = {} } = useEngagementScores(patientIds);

  const filtered = useMemo(
    () =>
      patients.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
          p.email?.toLowerCase().includes(search.toLowerCase()) ||
          p.phone?.includes(search)
      ),
    [patients, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

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
    if (filtered.every((p) => selectedIds.has(p.id)) && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
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

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">Manage your patient records</p>
        </div>
        <div className="flex items-center gap-2">
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
              onChange={(e) => setSearch(e.target.value)}
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">{patients.length === 0 ? "No patients yet. Add your first patient!" : "No patients match your search."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Patient</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Contact</th>
                   <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Skin Type</th>
                   <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden sm:table-cell">Engagement</th>
                   <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                   <th className="text-right text-xs font-medium text-muted-foreground p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((patient) => (
                  <tr key={patient.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/patients/${patient.id}`)}>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(patient.id)}
                        onCheckedChange={() => toggleOne(patient.id)}
                        aria-label={`Select ${patient.first_name}`}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-semibold text-sm shrink-0">
                          {patient.first_name[0]}{patient.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{patient.first_name} {patient.last_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {patient.gender || "—"}
                            {getAge(patient.date_of_birth) !== null && ` · Age ${getAge(patient.date_of_birth)}`}
                          </p>
                        </div>
                      </div>
                    </td>
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
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm">{patient.skin_type || "—"}</span>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <EngagementBadge data={engagementScores[patient.id]} />
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        patient.status === "Active"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {patient.status}
                      </span>
                    </td>
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

        <div className="p-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {filtered.length} of {patients.length} patients</span>
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
    </div>
  );
};

export default Patients;
