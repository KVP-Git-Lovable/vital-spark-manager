import { useState } from "react";
import { format } from "date-fns";
import { X, Save, Trash2, Plus, Camera, Eye, FileText, Pill, IndianRupee, Image as ImageIcon, ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const statusOptions = ["Scheduled", "Requested", "Confirmed", "In Progress", "Completed", "Cancelled", "No Show"];

interface AppointmentDetailSheetProps {
  appointmentId: string | null;
  onClose: () => void;
}

export function AppointmentDetailSheet({ appointmentId, onClose }: AppointmentDetailSheetProps) {
  const queryClient = useQueryClient();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  // Fetch appointment
  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointment-detail", appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null;
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(id, first_name, last_name), staff(first_name, last_name)")
        .eq("id", appointmentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  // Editable fields
  const [editService, setEditService] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialize form when appointment loads
  if (appointment && !initialized) {
    setEditService(appointment.service || "");
    setEditStatus(appointment.status || "Scheduled");
    setEditStartTime(appointment.start_time ? format(new Date(appointment.start_time), "yyyy-MM-dd'T'HH:mm") : "");
    setEditEndTime(appointment.end_time ? format(new Date(appointment.end_time), "yyyy-MM-dd'T'HH:mm") : "");
    setInitialized(true);
  }

  // Reset on close
  const handleClose = () => {
    setInitialized(false);
    setActiveTab("details");
    onClose();
  };

  // Fetch procedures for this appointment
  const { data: procedures = [] } = useQuery({
    queryKey: ["appointment-procedures", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedures")
        .select("*, staff(first_name, last_name)")
        .eq("appointment_id", appointmentId!)
        .order("procedure_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  // Fetch invoices for this patient
  const { data: invoices = [] } = useQuery({
    queryKey: ["appointment-invoices", appointment?.patient_id],
    queryFn: async () => {
      if (!appointment?.patient_id) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("patient_id", appointment.patient_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!appointment?.patient_id,
  });

  // Fetch photos for this appointment + patient
  const { data: photos = [] } = useQuery({
    queryKey: ["appointment-photos", appointmentId, appointment?.patient_id],
    queryFn: async () => {
      if (!appointment?.patient_id) return [];
      const { data, error } = await supabase
        .from("patient_photos")
        .select("*, procedures(service_name)")
        .eq("patient_id", appointment.patient_id)
        .order("taken_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!appointment?.patient_id,
  });

  // Update appointment
  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("appointments")
        .update({
          service: editService,
          status: editStatus,
          start_time: new Date(editStartTime).toISOString(),
          end_time: new Date(editEndTime).toISOString(),
        })
        .eq("id", appointmentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-detail", appointmentId] });
      toast.success("Appointment updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete appointment
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("appointments").delete().eq("id", appointmentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment deleted");
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Quick create procedure from appointment
  const createProcedureMutation = useMutation({
    mutationFn: async () => {
      if (!appointment) throw new Error("No appointment");
      const { error } = await supabase.from("procedures").insert({
        patient_id: appointment.patient_id!,
        appointment_id: appointmentId!,
        staff_id: appointment.staff_id || null,
        service_name: appointment.service,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-procedures", appointmentId] });
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      toast.success("Procedure created from appointment");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patientName = appointment?.patients
    ? `${appointment.patients.first_name} ${appointment.patients.last_name}`
    : appointment?.patient_name || "Unknown";

  const appointmentPhotos = photos.filter((p: any) => p.appointment_id === appointmentId);
  const otherPhotos = photos.filter((p: any) => p.appointment_id !== appointmentId);

  return (
    <>
      <Sheet open={!!appointmentId} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto p-0">
          {isLoading || !appointment ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : (
            <>
              {/* Header */}
              <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="font-display text-lg">{patientName}</SheetTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(appointment.start_time), "EEE, MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{appointment.status}</Badge>
                </div>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b px-6 bg-transparent h-auto p-0">
                  <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3">Details</TabsTrigger>
                  <TabsTrigger value="procedures" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3">Procedures</TabsTrigger>
                  <TabsTrigger value="billing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3">Billing</TabsTrigger>
                  <TabsTrigger value="photos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3">Photos</TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="p-6 space-y-4 mt-0">
                  <div>
                    <Label>Patient</Label>
                    <Input value={patientName} disabled className="mt-1.5 bg-muted/50" />
                  </div>
                  <div>
                    <Label>Service *</Label>
                    <Input value={editService} onChange={(e) => setEditService(e.target.value)} className="mt-1.5" />
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start</Label>
                      <Input type="datetime-local" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input type="datetime-local" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="mt-1.5" />
                    </div>
                  </div>
                  {appointment.staff && (
                    <div>
                      <Label>Doctor</Label>
                      <Input value={`Dr. ${appointment.staff.first_name} ${appointment.staff.last_name}`} disabled className="mt-1.5 bg-muted/50" />
                    </div>
                  )}
                  {appointment.source && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Source: {appointment.source}</Badge>
                      {appointment.is_recurring && <Badge variant="outline" className="text-xs">Recurring</Badge>}
                    </div>
                  )}

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
                          <AlertDialogTitle>Delete appointment?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove this appointment.</AlertDialogDescription>
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
                </TabsContent>

                {/* Procedures Tab */}
                <TabsContent value="procedures" className="p-6 space-y-4 mt-0">
                  {appointment.patient_id ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                          <Pill className="h-4 w-4" /> Linked Procedures
                        </h3>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => createProcedureMutation.mutate()} disabled={createProcedureMutation.isPending}>
                          <Plus className="h-3 w-3" /> Add Procedure
                        </Button>
                      </div>
                      {procedures.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No procedures linked. Click "Add Procedure" to create one.</p>
                      ) : (
                        <div className="space-y-2">
                          {procedures.map((proc: any) => (
                            <div key={proc.id} className="border rounded-lg p-3 bg-muted/30">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{proc.service_name}</p>
                                <Badge variant="secondary" className="text-xs">{proc.status}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(proc.procedure_date), "MMM d, yyyy")}
                                {proc.staff && ` · Dr. ${proc.staff.first_name}`}
                              </p>
                              {proc.diagnosis && <p className="text-xs mt-2 text-muted-foreground">{proc.diagnosis}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No patient linked to this appointment.</p>
                  )}
                </TabsContent>

                {/* Billing Tab */}
                <TabsContent value="billing" className="p-6 space-y-4 mt-0">
                  <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" /> Patient Invoices
                  </h3>
                  {invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No invoices found for this patient.</p>
                  ) : (
                    <div className="space-y-2">
                      {invoices.map((inv: any) => (
                        <div key={inv.id} className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{inv.invoice_number}</p>
                            <Badge variant="secondary" className={`text-xs ${inv.status === "Paid" ? "bg-success/10 text-success" : inv.status === "Partial" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                              {inv.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {inv.services?.join(", ")} · ₹{Number(inv.total_amount).toLocaleString()}
                          </p>
                          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                            <span>Paid: ₹{Number(inv.paid_amount).toLocaleString()}</span>
                            <span>Balance: ₹{(Number(inv.total_amount) - Number(inv.paid_amount)).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Photos Tab */}
                <TabsContent value="photos" className="p-6 space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                      <Camera className="h-4 w-4" /> Photos
                    </h3>
                    {appointment.patient_id && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => setCameraOpen(true)}>
                        <Plus className="h-3 w-3" /> Take Photo
                      </Button>
                    )}
                  </div>

                  {appointmentPhotos.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">This Appointment</p>
                      <div className="grid grid-cols-3 gap-2">
                        {appointmentPhotos.map((photo: any) => (
                          <div key={photo.id} className="relative group">
                            <img src={photo.photo_url} alt="" className="w-full h-24 object-cover rounded-lg border" />
                            <Badge variant="secondary" className="absolute top-1 left-1 text-[10px]">{photo.photo_type}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {otherPhotos.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">All Patient Photos</p>
                      <div className="grid grid-cols-3 gap-2">
                        {otherPhotos.map((photo: any) => (
                          <div key={photo.id} className="relative group">
                            <img src={photo.photo_url} alt="" className="w-full h-24 object-cover rounded-lg border" />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 rounded-b-lg">
                              {photo.photo_type} · {format(new Date(photo.taken_at), "MMM d")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {photos.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No photos yet. Click "Take Photo" to add one.</p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {cameraOpen && appointment?.patient_id && (
        <CameraCapture
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          patientId={appointment.patient_id}
          patientName={patientName}
          context="appointment"
          contextId={appointmentId!}
        />
      )}
    </>
  );
}
