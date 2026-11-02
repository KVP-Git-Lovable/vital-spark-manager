/**
 * Staff attendance: what the button does, and what a face check means.
 *
 * The decisions live here rather than in the page, because the page would
 * need the camera, storage, an edge function and Supabase all mocked before
 * a single rule could be asserted.
 */

/** A row of attendance_records, as far as these decisions care. */
export interface AttendanceRow {
  check_in_time: string | null;
  check_out_time: string | null;
}

/**
 * The whole row, as it exists after migration 20261102140000.
 *
 * Declared here rather than taken from the generated Supabase types, which
 * are regenerated on sync and do not yet know the four face columns. One
 * named type beats `any` scattered across two pages - when the generated
 * types catch up, this can be swapped for `Tables<"attendance_records">`.
 */
export interface AttendanceRecord extends AttendanceRow {
  id: string;
  staff_id: string;
  date: string;
  status: string | null;
  check_in_photo: string | null;
  check_out_photo: string | null;
  check_in_face_status: string | null;
  check_in_face_confidence: number | null;
  check_out_face_status: string | null;
  check_out_face_confidence: number | null;
}

export type AttendanceAction = "check_in" | "check_out" | "done";

/**
 * Which of the two things the one button does today.
 *
 * One row per staff member per day, enforced by a unique constraint, so the
 * state is just: nothing yet, in but not out, or finished.
 */
export function attendanceAction(row: AttendanceRow | null | undefined): AttendanceAction {
  if (!row || !row.check_in_time) return "check_in";
  if (!row.check_out_time) return "check_out";
  return "done";
}

/**
 * Why this person cannot start, or empty when they can.
 *
 * The face check compares the selfie against the photo on their staff record,
 * so without one there is nothing to compare and the check would pass
 * vacuously - which is the same as having no check at all.
 */
export function checkInBlockedReason(profilePhotoUrl: string | null | undefined): string {
  return String(profilePhotoUrl ?? "").trim()
    ? ""
    : "Set your profile photo before checking in - it is what your selfie is matched against.";
}

/** What the verifier came back with. */
export type FaceStatus = "verified" | "failed" | "bypassed";
export interface FaceResult {
  status: FaceStatus;
  confidence: number;
}

/** Attempts a person gets before they are told to find an admin. */
export const MAX_FACE_ATTEMPTS = 3;

export interface FaceVerdict {
  /** Save the attendance row? */
  proceed: boolean;
  /** Let them try again? */
  retry: boolean;
  /** What goes in the toast. Empty when it simply worked. */
  message: string;
  /** Recorded on the row, so an admin can see how it was decided. */
  recordStatus: FaceStatus;
}

/**
 * What to do with a face comparison.
 *
 * The clinic's rule is "no match, no attendance", and a real mismatch is
 * exactly that - blocked, with the attempt counted.
 *
 * A SERVICE ERROR is not a mismatch, and the two must not be collapsed. The
 * verifier answers "bypassed" when the AI gateway failed, the images could
 * not be fetched, or the key is missing; nothing was compared at all. The
 * reference app this follows treated that as confidence 0, told people their
 * face did not match, and after three tries locked them out of ending their
 * day - and then had to fix it. So a service error gets the same retries, and
 * when those are gone the attendance is SAVED and flagged `bypassed` for an
 * admin to look at. A broken gateway must never cost somebody their day's
 * attendance; a wrong face must always cost them the check-in.
 *
 * @param attempt 1-based: the attempt that just happened.
 */
export function faceVerdict(result: FaceResult, attempt: number): FaceVerdict {
  if (result.status === "verified") {
    return { proceed: true, retry: false, message: "", recordStatus: "verified" };
  }

  const last = attempt >= MAX_FACE_ATTEMPTS;

  if (result.status === "bypassed") {
    if (!last) {
      return {
        proceed: false,
        retry: true,
        message: `Face verification service error. Attempt ${attempt}/${MAX_FACE_ATTEMPTS}. Please try again.`,
        recordStatus: "bypassed",
      };
    }
    // Out of retries on a service fault - record it rather than strand them.
    return {
      proceed: true,
      retry: false,
      message: "Face verification is unavailable. Your attendance is recorded and flagged for review.",
      recordStatus: "bypassed",
    };
  }

  // A genuine mismatch. Never proceeds, at any attempt.
  if (!last) {
    return {
      proceed: false,
      retry: true,
      message: `Face verification failed - this does not match your profile photo (${result.confidence}% confidence). Attempt ${attempt}/${MAX_FACE_ATTEMPTS}. Please try again.`,
      recordStatus: "failed",
    };
  }
  return {
    proceed: false,
    retry: false,
    message: `Face verification failed after ${MAX_FACE_ATTEMPTS} attempts. Your face does not match the registered profile photo. Please contact your admin.`,
    recordStatus: "failed",
  };
}

/**
 * Hours between checking in and out, to two decimals.
 *
 * Null until both ends exist. A check-out before the check-in is a clock or
 * data fault, not negative work, so it reads as 0 rather than a minus figure
 * in the admin's totals.
 */
export function hoursWorked(
  checkIn: string | Date | null | undefined,
  checkOut: string | Date | null | undefined,
): number | null {
  const a = toDate(checkIn);
  const b = toDate(checkOut);
  if (!a || !b) return null;
  const hours = (b.getTime() - a.getTime()) / 3_600_000;
  return hours <= 0 ? 0 : Math.round(hours * 100) / 100;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Where a check-in photo is stored.
 *
 * Under the staff member's own id, because the bucket policy lets a person
 * write only inside their own folder - the path IS the permission.
 */
export function attendancePhotoPath(
  staffId: string,
  kind: "check_in" | "check_out",
  now: Date = new Date(),
): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
  const unique = Math.random().toString(36).slice(2, 8);
  return `${staffId}/${date}_${kind}_${now.getTime()}-${unique}.jpg`;
}
