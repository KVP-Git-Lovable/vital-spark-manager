import { useState, useRef } from "react";
import { format } from "date-fns";
import { Save, Trash2, Pill, Camera, Plus, Paperclip, X } from "lucide-react";
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const statusOptions = ["Completed", "In Progress", "Cancelled"];

interface PrescriptionRow {
  id?: string;
  product_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
  _deleted?: boolean;
}

interface ProcedureDetailSheetProps {
  procedureId: string | null;
  onClose: () => void;
}

export function ProcedureDetailSheet({ procedureId, onClose }: ProcedureDetailSheetProps) {
  const queryClient = useQueryClient();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields
  const [editServiceName, setEditServiceName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDiagnosis, setEditDiagnosis] = useState("");
  const [editProcedureNotes, setEditProcedureNotes] = useState("");
  const [editRecommendations, setEditRecommendations] = useState("");
  const [editPrescriptions, setEditPrescriptions] = useState<PrescriptionRow[]>([]);
  const [attachmentNotes, setAttachmentNotes] = useState("");
  const [uploading, setUploading] = useState(false);

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

  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["procedure-attachments", procedureId],
    queryFn: async () => {
      if (!procedureId) return [];
      const { data, error } = await supabase.from("procedure_attachments").select("*").eq("procedure_id", procedureId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!procedureId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pharma-products-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharma_products").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Initialize form
  if (procedure && !initialized) {
    setEditServiceName(procedure.service_name || "");
    setEditStatus(procedure.status || "Completed");
    setEditDiagnosis(procedure.diagnosis || "");
    setEditProcedureNotes(procedure.procedure_notes || "");
    setEditRecommendations(procedure.recommendations || "");
    setInitialized(true);
  }

  // Init prescriptions from fetched data
  if (prescriptions.length > 0 && initialized && editPrescriptions.length === 0) {
    setEditPrescriptions(prescriptions.map((rx: any) => ({
      id: rx.id,
      product_id: rx.product_id || "",
      medicine_name: rx.medicine_name,
      dosage: rx.dosage || "",
      frequency: rx.frequency || "",
      duration: rx.duration || "",
      instructions: rx.instructions || "",
      quantity: rx.quantity || 1,
    })));
  }

  const handleClose = () => {
    setInitialized(false);
    setEditPrescriptions([]);
    setAttachmentNotes("");
    onClose();
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Update procedure
      const { error } = await supabase.from("procedures").update({
        service_name: editServiceName,
        status: editStatus,
        diagnosis: editDiagnosis,
        procedure_notes: editProcedureNotes,
        recommendations: editRecommendations,
      }).eq("id", procedureId!);
      if (error) throw error;

      // Handle prescriptions: delete removed, update existing, insert new
      const existing = editPrescriptions.filter(rx => rx.id && !rx._deleted);
      const deleted = editPrescriptions.filter(rx => rx.id && rx._deleted);
      const newRx = editPrescriptions.filter(rx => !rx.id && !rx._deleted && (rx.medicine_name || rx.product_id));

      for (const rx of deleted) {
        await supabase.from("prescriptions").delete().eq("id", rx.id!);
      }
      for (const rx of existing) {
        await supabase.from("prescriptions").update({
          product_id: rx.product_id || null,
          medicine_name: rx.medicine_name,
          dosage: rx.dosage,
          frequency: rx.frequency,
          duration: rx.duration,
          instructions: rx.instructions,
          quantity: rx.quantity,
        }).eq("id", rx.id!);
      }
      if (newRx.length > 0) {
        await supabase.from("prescriptions").insert(newRx.map(rx => ({
          procedure_id: procedureId!,
          product_id: rx.product_id || null,
          medicine_name: rx.medicine_name,
          dosage: rx.dosage,
          frequency: rx.frequency,
          duration: rx.duration,
          instructions: rx.instructions,
          quantity: rx.quantity,
        })));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      queryClient.invalidateQueries({ queryKey: ["procedure-detail", procedureId] });
      queryClient.invalidateQueries({ queryKey: ["procedure-prescriptions", procedureId] });
      queryClient.invalidateQueries({ queryKey: ["appointment-procedures"] });
      toast.success("Procedure updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("prescriptions").delete().eq("procedure_id", procedureId!);
      await supabase.from("procedure_attachments").delete().eq("procedure_id", procedureId!);
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

  const addPrescription = () => {
    setEditPrescriptions([...editPrescriptions, { product_id: "", medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "", quantity: 1 }]);
  };

  const updateRx = (index: number, field: string, value: any) => {
    const updated = [...editPrescriptions];
    if (field === "product_id") {
      const prod = products.find((p) => p.id === value);
      updated[index].product_id = value;
      updated[index].medicine_name = prod?.name || "";
    } else {
      (updated[index] as any)[field] = value;
    }
    setEditPrescriptions(updated);
  };

  const removeRx = (index: number) => {
    const updated = [...editPrescriptions];
    if (updated[index].id) {
      updated[index]._deleted = true;
    } else {
      updated.splice(index, 1);
    }
    setEditPrescriptions(updated);
  };

  const handleFileUpload = async (files: FileList) => {
    if (!procedureId || !procedure) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const path = `${procedure.patient_id}/${procedureId}/${Date.now()}_${i}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("procedure-attachments").upload(path, file);
        if (uploadErr) throw uploadErr;

        const url = `${SUPABASE_URL}/storage/v1/object/public/procedure-attachments/${path}`;
        const { error: dbErr } = await supabase.from("procedure_attachments").insert({
          procedure_id: procedureId,
          patient_id: procedure.patient_id,
          appointment_id: procedure.appointment_id || null,
          file_url: url,
          file_name: file.name,
          notes: attachmentNotes || null,
        });
        if (dbErr) throw dbErr;
      }
      toast.success("Attachment(s) uploaded");
      setAttachmentNotes("");
      refetchAttachments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (id: string) => {
    await supabase.from("procedure_attachments").delete().eq("id", id);
    refetchAttachments();
    toast.success("Attachment removed");
  };

  const patientName = procedure?.patients
    ? `${procedure.patients.first_name} ${procedure.patients.last_name}`
    : "Unknown";

  const visibleRx = editPrescriptions.filter(rx => !rx._deleted);

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
                  <Label>Recommendations</Label>
                  <Textarea value={editRecommendations} onChange={(e) => setEditRecommendations(e.target.value)} className="mt-1.5" rows={3} />
                </div>

                {procedure.staff && (
                  <div>
                    <Label>Doctor</Label>
                    <Input value={`Dr. ${procedure.staff.first_name} ${procedure.staff.last_name}`} disabled className="mt-1.5 bg-muted/50" />
                  </div>
                )}

                {/* Prescriptions - editable */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-display font-semibold flex items-center gap-2">
                      <Pill className="h-4 w-4" /> Prescriptions
                    </Label>
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addPrescription}>
                      <Plus className="h-3 w-3" /> Add Medicine
                    </Button>
                  </div>
                  {visibleRx.length > 0 ? visibleRx.map((rx, idx) => {
                    const realIdx = editPrescriptions.indexOf(rx);
                    return (
                      <div key={realIdx} className="border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Medicine {idx + 1}</span>
                          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => removeRx(realIdx)}>Remove</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={rx.product_id} onValueChange={(v) => updateRx(realIdx, "product_id", v)}>
                            <SelectTrigger><SelectValue placeholder="Select medicine *" /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input placeholder="Dosage" value={rx.dosage} onChange={(e) => updateRx(realIdx, "dosage", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input placeholder="Frequency" value={rx.frequency} onChange={(e) => updateRx(realIdx, "frequency", e.target.value)} />
                          <Input placeholder="Duration" value={rx.duration} onChange={(e) => updateRx(realIdx, "duration", e.target.value)} />
                          <Input type="number" placeholder="Qty" value={rx.quantity} onChange={(e) => updateRx(realIdx, "quantity", parseInt(e.target.value) || 1)} />
                        </div>
                        <Input placeholder="Special instructions" value={rx.instructions} onChange={(e) => updateRx(realIdx, "instructions", e.target.value)} />
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-muted-foreground text-center py-2">No prescriptions. Click "Add Medicine" to add.</p>
                  )}
                </div>

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

                {/* Attachments */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-display font-semibold flex items-center gap-2">
                      <Paperclip className="h-4 w-4" /> Attachments
                    </Label>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Plus className="h-3 w-3" /> {uploading ? "Uploading..." : "Add Files"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files) handleFileUpload(e.target.files); e.target.value = ""; }}
                    />
                  </div>
                  <Input
                    placeholder="Notes for attachment (optional)"
                    value={attachmentNotes}
                    onChange={(e) => setAttachmentNotes(e.target.value)}
                    className="mb-3"
                  />
                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((att: any) => (
                        <div key={att.id} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">
                              {att.file_name}
                            </a>
                            {att.notes && <p className="text-xs text-muted-foreground">{att.notes}</p>}
                            <p className="text-[10px] text-muted-foreground">
                              Linked to patient &amp; {att.appointment_id ? "appointment" : "procedure"}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteAttachment(att.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">No attachments yet.</p>
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
                        <AlertDialogDescription>This will permanently remove this procedure, prescriptions and attachments.</AlertDialogDescription>
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
