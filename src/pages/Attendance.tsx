import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarCheck, Camera, CheckCircle2, Clock, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CameraDialog } from "@/components/shared/CameraDialog";
import {
  attendanceAction,
  attendancePhotoPath,
  checkInBlockedReason,
  faceVerdict,
  hoursWorked,
  MAX_FACE_ATTEMPTS,
  type AttendanceRecord,
  type FaceResult,
} from "@/lib/attendance";
import { stampTimeOrOriginal } from "@/lib/stampPhoto";

/**
 * Starting and ending a working day.
 *
 * One row per person per day, enforced by a unique index, so this page has
 * exactly one button: start the day, end the day, or nothing left to do.
 *
 * The decisions - which button, whether they may start at all, what a face
 * result means - live in src/lib/attendance.ts so they can be tested without
 * a camera, storage and an edge function all mocked.
 */
const today = () => format(new Date(), "yyyy-MM-dd");

type Step = "idle" | "photo" | "verifying" | "saving";

export default function Attendance() {
  const { staffProfile } = useAuth();
  const qc = useQueryClient();
  const staffId = staffProfile?.id;

  const [cameraOpen, setCameraOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [attempt, setAttempt] = useState(0);

  const { data: staff } = useQuery({
    queryKey: ["staff", "photo", staffId],
    enabled: !!staffId,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("photo_url").eq("id", staffId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: record, refetch } = useQuery({
    queryKey: ["attendance", "today", staffId],
    enabled: !!staffId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records").select("*")
        .eq("staff_id", staffId!).eq("date", today()).maybeSingle();
      if (error) throw error;
      return (data as unknown as AttendanceRecord) ?? null;
    },
  });

  const action = attendanceAction(record);
  const blocked = checkInBlockedReason(staff?.photo_url);
  const busy = step !== "idle";

  const stepLabel =
    step === "photo" ? "Saving your photo…"
    : step === "verifying" ? "Checking your face…"
    : step === "saving" ? "Recording…"
    : "";

  /**
   * The whole check-in, from a captured selfie to a saved row.
   *
   * Order is deliberate: the photo is stamped and stored BEFORE the face is
   * checked, because the verifier reads it out of storage - and because a
   * refused attempt should still leave the photo behind for an admin to look
   * at when somebody says the check was wrong.
   */
  const submit = async (file: File) => {
    if (!staffId) return;
    const kind = action === "check_out" ? "check_out" : "check_in";
    const now = new Date();
    const thisAttempt = attempt + 1;
    setAttempt(thisAttempt);

    try {
      setStep("photo");
      // Never costs the check-in: on any failure the unstamped photo is used.
      const stamped = await stampTimeOrOriginal(file, now);
      const path = attendancePhotoPath(staffId, kind, now);
      const { error: upErr } = await supabase.storage
        .from("attendance-photos").upload(path, stamped, { contentType: "image/jpeg" });
      if (upErr) throw upErr;

      setStep("verifying");
      // The selfie's PATH, not a URL: the function looks up the caller's own
      // baseline photo server-side, so nobody can ask it to compare a selfie
      // against somebody else's face.
      let result: FaceResult = { status: "bypassed", confidence: 0 };
      try {
        const { data, error } = await supabase.functions.invoke("verify-face-match", {
          body: { selfie_path: path },
        });
        if (!error && data) {
          result = {
            status: (data.status as FaceResult["status"]) ?? "bypassed",
            confidence: Number(data.confidence) || 0,
          };
        }
      } catch {
        // Unreachable function is a service fault, not a mismatch.
        result = { status: "bypassed", confidence: 0 };
      }

      const verdict = faceVerdict(result, thisAttempt);
      if (!verdict.proceed) {
        setStep("idle");
        toast.error(verdict.message, { duration: 8000 });
        if (verdict.retry) setCameraOpen(true);
        return;
      }

      setStep("saving");
      const { data: signed } = await supabase.storage
        .from("attendance-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      const photoRef = signed?.signedUrl ?? path;

      if (kind === "check_in") {
        const { error } = await supabase.from("attendance_records").insert({
          staff_id: staffId, date: today(), check_in_time: now.toISOString(),
          check_in_photo: photoRef, check_in_face_status: verdict.recordStatus,
          check_in_face_confidence: result.confidence, status: "present",
        } as never);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_records").update({
          check_out_time: now.toISOString(), check_out_photo: photoRef,
          check_out_face_status: verdict.recordStatus,
          check_out_face_confidence: result.confidence,
        } as never).eq("id", record!.id);
        if (error) throw error;
      }

      setAttempt(0);
      await refetch();
      void qc.invalidateQueries({ queryKey: ["dashboard-attendance"] });
      toast.success(
        verdict.message || (kind === "check_in" ? "Your day has started." : "Your day is recorded."),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record attendance");
    } finally {
      setStep("idle");
    }
  };

  const hours = hoursWorked(record?.check_in_time, record?.check_out_time);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <header className="flex items-center gap-2">
        <CalendarCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold font-display">Attendance</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{format(new Date(), "EEEE, d MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {blocked ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{blocked}</p>
              <Button asChild variant="outline" size="sm">
                <Link to="/profile"><Camera className="h-4 w-4 mr-2" />Set your profile photo</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Slot label="Started" time={record?.check_in_time} status={record?.check_in_face_status} />
                <Slot label="Ended" time={record?.check_out_time} status={record?.check_out_face_status} />
              </div>
              {hours !== null && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />{hours} hours recorded
                </p>
              )}

              {action === "done" ? (
                <p className="text-sm flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" />Your day is complete. See you tomorrow.
                </p>
              ) : (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={busy}
                  onClick={() => setCameraOpen(true)}
                >
                  {busy
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{stepLabel}</>
                    : <><Camera className="h-4 w-4 mr-2" />{action === "check_in" ? "Start my day" : "End my day"}</>}
                </Button>
              )}

              {attempt > 0 && attempt < MAX_FACE_ATTEMPTS && (
                <p className="text-xs text-muted-foreground">
                  Attempt {attempt} of {MAX_FACE_ATTEMPTS}. Face a window and look straight at the camera.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title={action === "check_out" ? "Selfie to end your day" : "Selfie to start your day"}
        defaultFacing="user"
        onCapture={(file) => { setCameraOpen(false); void submit(file); }}
      />
    </div>
  );
}

function Slot({ label, time, status }: { label: string; time?: string | null; status?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{time ? format(new Date(time), "h:mm a") : "—"}</p>
      {status && <FaceBadge status={status} />}
    </div>
  );
}

/**
 * Three outcomes, shown as three different things - a service fault must not
 * look like a failed match.
 */
export function FaceBadge({ status }: { status: string }) {
  if (status === "verified") {
    return <Badge variant="outline" className="mt-1 gap-1 text-success border-success/40"><ShieldCheck className="h-3 w-3" />Face verified</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="outline" className="mt-1 gap-1 text-destructive border-destructive/40"><ShieldAlert className="h-3 w-3" />Face not matched</Badge>;
  }
  return <Badge variant="outline" className="mt-1 gap-1 text-muted-foreground"><ShieldAlert className="h-3 w-3" />Not checked</Badge>;
}
