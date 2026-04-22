import { useState, useRef, useCallback, useEffect } from "react";
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
import { toast } from "sonner";

const Procedures = () => {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraProc, setCameraProc] = useState<any>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | HTMLDivElement | null>>({});
  const queryClient = useQueryClient();

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
        .select("*, patients(first_name, last_name), staff(first_name, last_name)")
        .order("procedure_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = procedures.filter((p: any) => {
    const name = `${p.patients?.first_name || ""} ${p.patients?.last_name || ""}`.toLowerCase();
    return name.includes(search.toLowerCase()) || p.service_name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="page-title">Procedures</h1>
          <p className="page-subtitle">Record consultations, procedures & prescriptions</p>
        </div>
        <div className="flex gap-2 w-fit">
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import Procedures
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
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
                    {proc.staff ? `Dr. ${proc.staff.first_name} ${proc.staff.last_name}` : "—"}
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
              <TableHead>Date</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No procedures found</TableCell></TableRow>
            ) : (
              filtered.map((proc: any) => (
                <TableRow key={proc.id} ref={(el) => { rowRefs.current[proc.id] = el; }} className={`cursor-pointer hover:bg-muted/50 transition-all duration-500 ${highlightedId === proc.id ? "ring-2 ring-primary bg-primary/5" : ""}`} onClick={() => setSelectedId(proc.id)}>
                  <TableCell className="text-sm">{new Date(proc.procedure_date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{proc.patients?.first_name} {proc.patients?.last_name}</TableCell>
                  <TableCell>{proc.service_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {proc.staff ? `Dr. ${proc.staff.first_name} ${proc.staff.last_name}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{proc.status}</Badge>
                  </TableCell>
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

      <ProcedureDetailSheet procedureId={selectedId} onClose={() => setSelectedId(null)} onSaved={handleProcedureSaved} />

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
    </div>
  );
};

export default Procedures;
