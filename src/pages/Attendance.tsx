import { useState } from "react";
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
  attendancePhotoPath,
  dayButtons,
  faceVerdict,
  hoursWorked,
  MAX_FACE_ATTEMPTS,
  DEFAULT_ATTENDANCE_CONFIG,
  type AttendanceRecord,
  type FaceResult,
} from "@/lib/attendance";
import { stampPhotoOrOriginal } from "@/lib/stampPhoto";
import { currentPosition, reverseGeocode, type Fix } from "@/lib/geo";
import { nonWorkingReason } from "@/lib/workingDays";
import { useAttendanceSettings } from "@/hooks/useAttendanceSettings";
import { uploadStaffPhoto } from "@/lib/staffPhoto";
import { TeamAttendance } from "@/components/attendance/TeamAttendance";
import { AttendancePolicyTab, HolidaysTab, WeekOffsTab } from "@/components/attendance/AttendanceSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Starting and ending a working day.
 *
 * Both buttons are always on screen, as the Bharath Builders app shows them,
 * with the unavailable one greyed out and naming what already happened. The
 * first version had a single button that swapped its own label, and the
 * clinic reported the page had no day-start or day-end option at all.
 *
 * Somebody with no profile photo registers their face HERE and carries
 * straight on into the action they pressed. Sending them to /profile is a
 * dead end at nine in the morning when they are trying to start work.
 *
 * The decisions - which button is live, what a face result means - live in
 * src/lib/attendance.ts so they can be tested without a camera, storage and
 * an edge function all mocked.
 */
const today = () => format(new Date(), "yyyy-MM-dd");

type Step = "idle" | "registering" | "locating" | "photo" | "verifying" | "saving";

export default function Attendance() {
  const { staffProfile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const staffId = staffProfile?.id;

  const [cameraOpen, setCameraOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [attempt, setAttempt] = useState(0);
  /** Which end of the day the open camera is for. */
  const [mode, setMode] = useState<"check_in" | "check_out">("check_in");
  /**
   * Set when the camera is collecting a FACE REGISTRATION rather than an
   * attendance selfie. Holds what they pressed, so that once the photo is
   * saved the check-in continues by itself - the reference's pendingAction.
   */
  const [registering, setRegistering] = useState<null | "check_in" | "check_out">(null);

  const { config, weekOffs, holidays } = useAttendanceSettings();
  const closedToday = nonWorkingReason(new Date(), weekOffs, holidays);

  const { data: staff, refetch: refetchStaff } = useQuery({
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

  const buttons = dayButtons(record);
  const hasPhoto = !!String(staff?.photo_url ?? "").trim();
  const busy = step !== "idle";

  const stepLabel =
    step === "locating" ? "Getting location…"
    : step === "registering" || step === "photo" ? "Uploading photo…"
    : step === "verifying" ? "Verifying face match…"
    : step === "saving" ? "Saving attendance…"
    : "";

  /**
   * Pressing Start My Day or End My Day.
   *
   * With no photo on file the camera opens to REGISTER the face first; the
   * action is remembered and resumed the moment it is saved.
   */
  const press = (kind: "check_in" | "check_out") => {
    setMode(kind);
    setAttempt(0);
    // Selfie switched off in settings: record the day without a camera, a
    // photo or a face call, and mark it unverified so it is never mistaken
    // for a checked one. The reference's doDirectAttendance.
    if (!config.require_selfie) {
      void submit(null, kind);
      return;
    }
    setRegistering(hasPhoto ? null : kind);
    setCameraOpen(true);
  };

  /** The face-registration half: save the photo, then carry straight on. */
  const register = async (file: File, kind: "check_in" | "check_out") => {
    if (!staffId) return;
    setStep("registering");
    try {
      await uploadStaffPhoto(staffId, file);
      await refetchStaff();
      setRegistering(null);
      toast.success("Face registered. Now take your selfie.");
      setStep("idle");
      // Straight back into the camera for the action they actually pressed.
      setMode(kind);
      setCameraOpen(true);
    } catch (e) {
      setStep("idle");
      toast.error(e instanceof Error ? e.message : "Could not save your photo");
    }
  };

  /**
   * The whole check-in, from a captured selfie to a saved row.
   *
   * Order is deliberate: the photo is stamped and stored BEFORE the face is
   * checked, because the verifier reads it out of storage - and because a
   * refused attempt should still leave the photo behind for an admin to look
   * at when somebody says the check was wrong.
   */
  const submit = async (file: File | null, kind: "check_in" | "check_out") => {
    if (!staffId) return;
    const now = new Date();
    const thisAttempt = attempt + 1;
    setAttempt(thisAttempt);

    try {
      // Where they are. Best-effort throughout: a denied permission or a
      // phone that cannot see the sky must never cost somebody their day.
      let fix: Fix | null = null;
      let address: string | null = null;
      if (config.capture_location) {
        setStep("locating");
        fix = await currentPosition();
        if (fix) address = await reverseGeocode(fix.latitude, fix.longitude);
      }

      let path: string | null = null;
      if (file) {
        setStep("photo");
        // Never costs the check-in: on any failure the unstamped photo is used.
        const stamped = await stampPhotoOrOriginal(file, {
          at: now,
          address,
          lat: fix?.latitude ?? null,
          lng: fix?.longitude ?? null,
        });
        path = attendancePhotoPath(staffId, kind, now);
        const { error: upErr } = await supabase.storage
          .from("attendance-photos").upload(path, stamped, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
      }

      setStep("verifying");
      // The selfie's PATH, not a URL: the function looks up the caller's own
      // baseline photo server-side, so nobody can ask it to compare a selfie
      // against somebody else's face.
      let result: FaceResult = { status: "bypassed", confidence: 0 };
      if (path) try {
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

      const verdict = faceVerdict(result, thisAttempt, config.face_max_attempts);
      if (!verdict.proceed) {
        setStep("idle");
        toast.error(verdict.message, { duration: 8000 });
        if (verdict.retry) { setMode(kind); setCameraOpen(true); }
        return;
      }

      setStep("saving");
      let photoRef: string | null = null;
      if (path) {
        const { data: signed } = await supabase.storage
          .from("attendance-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
        photoRef = signed?.signedUrl ?? path;
      }

      // The caption is burned into the photo; these are the same facts in a
      // form a query can reach. The reference declares these columns and
      // never writes them, so its admin screen only ever shows coordinates.
      if (kind === "check_in") {
        const { error } = await supabase.from("attendance_records").insert({
          staff_id: staffId, date: today(), check_in_time: now.toISOString(),
          check_in_photo: photoRef, check_in_face_status: verdict.recordStatus,
          check_in_face_confidence: result.confidence, status: "present",
          check_in_location: fix, check_in_address: address,
        } as never);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_records").update({
          check_out_time: now.toISOString(), check_out_photo: photoRef,
          check_out_face_status: verdict.recordStatus,
          check_out_face_confidence: result.confidence,
          check_out_location: fix, check_out_address: address,
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
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex items-center gap-2">
        <CalendarCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold font-display">Attendance</h1>
      </header>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">{format(new Date(), "EEEE, d MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Slot label="Started" time={record?.check_in_time} status={record?.check_in_face_status} />
            <Slot label="Ended" time={record?.check_out_time} status={record?.check_out_face_status} />
          </div>
          {hours !== null && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />{hours} hours recorded
            </p>
          )}

          {/* Both, always. The greyed-out one names what already happened,
              which is what tells somebody where they are in their day. */}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              disabled={busy || buttons.start.disabled}
              onClick={() => press("check_in")}
              data-testid="start-my-day"
            >
              {busy && mode === "check_in"
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{stepLabel}</>
                : <><Camera className="h-4 w-4 mr-2" />{buttons.start.label}</>}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={busy || buttons.end.disabled}
              onClick={() => press("check_out")}
              data-testid="end-my-day"
            >
              {busy && mode === "check_out"
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{stepLabel}</>
                : <><Camera className="h-4 w-4 mr-2" />{buttons.end.label}</>}
            </Button>
          </div>

          {buttons.start.disabled && buttons.end.disabled && (
            <p className="text-sm flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4" />Your day is complete. See you tomorrow.
            </p>
          )}

          {/* Labelling, not blocking: people do work on days off, and a doctor
              coming in on a Sunday for one procedure still has to record it. */}
          {closedToday && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Today is {closedToday === "Week off" ? "a week off" : closedToday}. You can still record your day.
            </p>
          )}

          {!hasPhoto && config.require_selfie && (
            <p className="text-xs text-muted-foreground">
              You have no photo on file yet. The first time you press a button above you will be
              asked to take one — your selfie is matched against it each day.
            </p>
          )}

          {attempt > 0 && attempt < MAX_FACE_ATTEMPTS && (
            <p className="text-xs text-muted-foreground">
              Attempt {attempt} of {MAX_FACE_ATTEMPTS}. Face a window and look straight at the camera.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Admins get everyone else's below their own, and the settings beside
          them. One page called Attendance, which is where the clinic kept
          looking - nothing new in the sidebar. */}
      {isAdmin && (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All staff</TabsTrigger>
            <TabsTrigger value="policy">Policy</TabsTrigger>
            <TabsTrigger value="week-offs">Week offs</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4"><TeamAttendance /></TabsContent>
          <TabsContent value="policy" className="mt-4"><AttendancePolicyTab /></TabsContent>
          <TabsContent value="week-offs" className="mt-4"><WeekOffsTab /></TabsContent>
          <TabsContent value="holidays" className="mt-4"><HolidaysTab /></TabsContent>
        </Tabs>
      )}

      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title={
          registering ? "Register your face"
          : mode === "check_out" ? "Selfie to end your day"
          : "Selfie to start your day"
        }
        defaultFacing="user"
        faceGuide
        onCapture={(file) => {
          setCameraOpen(false);
          const pending = registering;
          if (pending) void register(file, pending);
          else void submit(file, mode);
        }}
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
