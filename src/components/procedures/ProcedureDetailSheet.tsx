import { useState } from "react";
import { format } from "date-fns";
import { Save, Trash2, Pill, Camera, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CameraCapture } from "@/components/shared/CameraCapture";

const statusOptions = ["Completed", "In Progress", "Cancelled"];

interface ProcedureDetailSheetProps {
  procedureId: string | null;
  onClose: () => void;
}

export function ProcedureDetailSheet({ procedureId, onClose }: ProcedureDetailSheetProps) {
  const queryClient = useQueryClient();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Editable fields
  const [editServiceName, setEditServiceName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDiagnosis, setEditDiagnosis] = useState("");
  const [editProcedureNotes, setEditProcedureNotes] = useState("");
  const [editConsultationNotes, setEditConsultationNotes] = useState("");

  const { data: procedure, isLoading } = useQuery({
    queryKey: ["procedure-detail", procedureId],
    queryFn: async () => {
      if (!procedureId) return null;
      const { data, error } = await supabase
        .from("procedures")
        .select("*, patients(first_name, last_name), staff(first_name, last_name)")
        .eq("id", procedureId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!procedureId,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["procedure-prescriptions", procedureId],
    queryFn: async () => {
      if (!procedureId) return [];
      const { data, error } = await supabase.from("prescriptions").select("*").eq("procedure_id", procedureId);
      if (error) throw error;
      return data;
    },
    enabled: !!procedureId,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["procedure-photos", procedureId],
    queryFn: async () => {
      if (!procedureId) return [];
      const { data, error } = await supabase.from("patient_photos").select("*").eq("procedure_id", procedureId).order("taken_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!procedureId,
  });

  // Initialize form
  if (procedure && !initialized) {
    setEditServiceName(procedure.service_name || "");
    setEditStatus(procedure.status || "Completed");
    setEditDiagnosis(procedure.diagnosis || "");
    setEditProcedureNotes(procedure.procedure_notes || "");
    setEditConsultationNotes(procedure.consultation_notes || "");
    setInitialized(true);
  }

  const handleClose = () => {
    setInitialized(false);
    onClose();
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("procedures").update({
        service_name: editServiceName,
        status: editStatus,
        diagnosis: editDiagnosis,
        procedure_notes: editProcedureNotes,
        consultation_notes: editConsultationNotes,
      }).eq("id", procedureId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      queryClient.invalidateQueries({ queryKey: ["procedure-detail", procedureId] });
      queryClient.invalidateQueries({ queryKey: ["appointment-procedures"] });
      toast.success("Procedure updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Delete prescriptions first
      await supabase.from("prescriptions").delete().eq("procedure_id", procedureId!);
      const { error } = await supabase.from("procedures").delete().eq("id", procedureId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-procedures"] });
      toast.success("Procedure deleted");
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patientName = procedure?.patients
    ? `${procedure.patients.first_name} ${procedure.patients.last_name}`
    : "Unknown";

  return (
    <>
      <Sheet open={!!procedureId} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto p-0">
          {isLoading || !procedure ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : (
            <>
              <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="font-display text-lg">{patientName}</SheetTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(procedure.procedure_date), "EEE, MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{procedure.status}</Badge>
                </div>
              </SheetHeader>

              <div className="p-6 space-y-4">
                <div>
                  <Label>Service / Procedure Name *</Label>
                  <Input value={editServiceName} onChange={(e) => setEditServiceName(e.target.value)} className="mt-1.5" />
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Diagnosis</Label>
                  <Textarea value={editDiagnosis} onChange={(e) => setEditDiagnosis(e.target.value)} className="mt-1.5" rows={2} />
                </div>

                <div>
                  <Label>Procedure Notes</Label>
                  <Textarea value={editProcedureNotes} onChange={(e) => setEditProcedureNotes(e.target.value)} className="mt-1.5" rows={3} />
                </div>

                <div>
                  <Label>Consultation Notes</Label>
                  <Textarea value={editConsultationNotes} onChange={(e) => setEditConsultationNotes(e.target.value)} className="mt-1.5" rows={3} />
                </div>

                {procedure.staff && (
                  <div>
                    <Label>Doctor</Label>
                    <Input value={`Dr. ${procedure.staff.first_name} ${procedure.staff.last_name}`} disabled className="mt-1.5 bg-muted/50" />
                  </div>
                )}

                {/* Prescriptions */}
                {prescriptions.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="text-base font-display font-semibold flex items-center gap-2 mb-3">
                      <Pill className="h-4 w-4" /> Prescriptions
                    </Label>
                    <div className="space-y-2">
                      {prescriptions.map((rx: any) => (
                        <div key={rx.id} className="bg-muted/50 rounded-md p-3">
                          <p className="font-medium text-sm">{rx.medicine_name}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                            {rx.quantity > 1 && ` · Qty: ${rx.quantity}`}
                          </p>
                          {rx.instructions && <p className="text-xs mt-1 text-muted-foreground italic">{rx.instructions}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Photos */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-display font-semibold flex items-center gap-2">
                      <Camera className="h-4 w-4" /> Photos
                    </Label>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setCameraOpen(true)}>
                      <Plus className="h-3 w-3" /> Take Photo
                    </Button>
                  </div>
                  {photos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((photo: any) => (
                        <div key={photo.id} className="relative group">
                          <img src={photo.photo_url} alt="" className="w-full h-24 object-cover rounded-lg border" />
                          <Badge variant="secondary" className="absolute top-1 left-1 text-[10px]">{photo.photo_type}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No photos yet.</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="flex-1 gap-2">
                    <Save className="h-4 w-4" />
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete procedure?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove this procedure and its prescriptions.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {cameraOpen && procedure?.patient_id && (
        <CameraCapture
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          patientId={procedure.patient_id}
          patientName={patientName}
          context="procedure"
          contextId={procedureId!}
        />
      )}
    </>
  );
}
