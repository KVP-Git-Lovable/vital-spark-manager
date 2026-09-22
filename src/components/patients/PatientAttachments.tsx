import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Camera, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraDialog } from "@/components/shared/CameraDialog";
import { displayDate } from "@/lib/dateInput";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * A patient's attachments - their documents, consent forms, lab reports and
 * scanned prescriptions.
 *
 * This lived inline on the patient page. The clinic asked for the same list on
 * the appointment sheet, because the consent form or the outside lab report is
 * wanted while the patient is in front of you, not two screens away. Copying
 * the markup would have left two lists to keep in step, so it is one component
 * used in both places.
 *
 * It is deliberately the PATIENT's whole set in both places rather than only
 * the documents tied to this visit. A consent form signed last year is exactly
 * what you need to see at today's appointment, and the file rows carry their
 * own dates, so nothing is hidden by showing everything.
 *
 * The query key is shared with the patient page, so an upload on one screen
 * shows on the other without a refetch being wired between them.
 */

/** One row of procedure_attachments, as this list reads it. */
export interface PatientAttachment {
  id: string;
  file_name: string | null;
  file_url: string | null;
  document_type: string | null;
  notes: string | null;
  created_at: string;
  procedures?: { service_name: string | null } | null;
}

const DOCUMENT_TYPES = [
  "Prescription",
  "Consent Form",
  "Lab Report",
  "Previous Doctor Report",
  "Other",
] as const;

interface PatientAttachmentsProps {
  patientId: string | null | undefined;
  /** Uploads are filed against this prescription when there is one. */
  defaultProcedureId?: string | null;
  /** Heading shown above the list; the patient page's tab already has one. */
  title?: string;
}

export function PatientAttachments({
  patientId,
  defaultProcedureId = null,
  title,
}: PatientAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<string>("all");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docTypeDialogOpen, setDocTypeDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("Prescription");
  const [viewing, setViewing] = useState<PatientAttachment | null>(null);

  const { data: attachments = [], refetch } = useQuery({
    queryKey: ["patient-attachments", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedure_attachments")
        .select("*, procedures(service_name)")
        .eq("patient_id", patientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PatientAttachment[];
    },
    enabled: !!patientId,
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !patientId) return;
    setPendingFile(file);
    setSelectedDocType("Prescription");
    setDocTypeDialogOpen(true);
    e.target.value = "";
  };

  const uploadPending = async () => {
    if (!pendingFile || !patientId) return;
    setUploading(true);
    const file = pendingFile;
    try {
      const ext = file.name.split(".").pop() || "bin";
      const filePath = `${patientId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("patient-photos").upload(filePath, file);
      if (uploadError) throw uploadError;
      const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/patient-photos/${filePath}`;
      const { error } = await supabase.from("procedure_attachments").insert({
        patient_id: patientId,
        procedure_id: defaultProcedureId,
        file_name: file.name,
        file_url: fileUrl,
        document_type: selectedDocType,
        // The generated table types do not describe this insert shape.
      } as never);
      if (error) throw error;
      toast.success("Attachment uploaded");
      setDocTypeDialogOpen(false);
      setPendingFile(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (att: PatientAttachment) => {
    if (!confirm("Delete this attachment?")) return;
    try {
      const parts = att.file_url?.split("/patient-photos/");
      if (parts && parts[1]) {
        await supabase.storage.from("patient-photos").remove([parts[1]]);
      }
      const { error } = await supabase.from("procedure_attachments").delete().eq("id", att.id);
      if (error) throw error;
      toast.success("Attachment deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete attachment");
    }
  };

  const filtered = filter === "all"
    ? attachments
    : attachments.filter((a) => a.document_type === filter);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
        {title && (
          <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> {title}
          </h3>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-56"><SelectValue placeholder="Filter by type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" disabled={uploading || !patientId} onClick={() => setCameraOpen(true)}>
              <Camera className="h-3.5 w-3.5" /> Take Photo
            </Button>
            <Button size="sm" className="gap-1.5 h-8 text-xs" disabled={uploading || !patientId} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload File
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Paperclip className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              No attachments {filter !== "all" ? `of type "${filter}"` : "yet"}. Upload files to attach to this patient.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((att) => (
              <div key={att.id} className="stat-card p-3 md:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{att.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {att.document_type && (
                          <Badge variant="default" className="text-[10px]">{att.document_type}</Badge>
                        )}
                        {att.procedures?.service_name && (
                          <Badge variant="secondary" className="text-[10px]">{att.procedures.service_name}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{displayDate(att.created_at)}</span>
                      </div>
                      {att.notes && <p className="text-xs text-muted-foreground mt-1">{att.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setViewing(att)}>
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteAttachment(att)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <Dialog open={docTypeDialogOpen} onOpenChange={(o) => { if (!o) { setDocTypeDialogOpen(false); setPendingFile(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Document Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {pendingFile && (
              <p className="text-xs text-muted-foreground truncate">File: {pendingFile.name}</p>
            )}
            <div>
              <Label>Type</Label>
              <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setDocTypeDialogOpen(false); setPendingFile(null); }}>Cancel</Button>
              <Button size="sm" disabled={uploading} onClick={uploadPending}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title="Capture Attachment"
        onCapture={(file) => {
          setPendingFile(file);
          setSelectedDocType("Prescription");
          setDocTypeDialogOpen(true);
        }}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display truncate pr-8">{viewing?.file_name}</DialogTitle>
          </DialogHeader>
          {viewing && (() => {
            const url: string = viewing.file_url || "";
            const name: string = viewing.file_name || url;
            const lower = name.toLowerCase();
            const isImage = /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg)$/i.test(lower) || /\.(jpe?g|png|gif|webp|bmp)$/i.test(url.split("?")[0]);
            const isPdf = /\.pdf$/i.test(lower) || /\.pdf(\?|$)/i.test(url);
            return (
              <div className="space-y-3">
                <div className="bg-muted/40 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: 400 }}>
                  {isImage ? (
                    <img src={url} alt={name} className="max-h-[70vh] w-auto object-contain" />
                  ) : isPdf ? (
                    <iframe src={url} title={name} className="w-full h-[70vh]" />
                  ) : (
                    <div className="p-8 text-center">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Preview not available for this file type.</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">Open in new tab</a>
                  </Button>
                  <Button size="sm" asChild>
                    <a href={url} download={name}>Download</a>
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
