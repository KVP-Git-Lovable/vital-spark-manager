import { describe, it, expect } from "vitest";
import {
  attendanceAction,
  checkInBlockedReason,
  faceVerdict,
  hoursWorked,
  attendancePhotoPath,
  MAX_FACE_ATTEMPTS,
} from "./attendance";

describe("attendanceAction", () => {
  it("offers check in when the day has not started", () => {
    expect(attendanceAction(null)).toBe("check_in");
    expect(attendanceAction(undefined)).toBe("check_in");
    expect(attendanceAction({ check_in_time: null, check_out_time: null })).toBe("check_in");
  });

  it("offers check out once they are in", () => {
    expect(attendanceAction({ check_in_time: "2026-11-02T09:00:00Z", check_out_time: null })).toBe("check_out");
  });

  it("offers nothing more once the day is closed", () => {
    expect(attendanceAction({ check_in_time: "2026-11-02T09:00:00Z", check_out_time: "2026-11-02T18:00:00Z" })).toBe("done");
  });
});

describe("checkInBlockedReason", () => {
  it("blocks somebody with no profile photo, and says why", () => {
    // Without a photo there is nothing to compare the selfie against, so the
    // check would pass vacuously - the same as having no check at all.
    expect(checkInBlockedReason(null)).toMatch(/profile photo/i);
    expect(checkInBlockedReason(undefined)).toMatch(/profile photo/i);
    expect(checkInBlockedReason("")).toMatch(/profile photo/i);
    expect(checkInBlockedReason("   ")).toMatch(/profile photo/i);
  });

  it("lets somebody with a photo through", () => {
    expect(checkInBlockedReason("https://x.test/me.jpg")).toBe("");
  });
});

/**
 * The clinic's rule is "no match, no attendance". The thing these tests exist
 * to hold is the OTHER half: a service error is not a mismatch, and must not
 * be allowed to become one. The app this follows made exactly that mistake
 * and locked people out of ending their day.
 */
describe("faceVerdict", () => {
  const verified = { status: "verified" as const, confidence: 92 };
  const mismatch = { status: "failed" as const, confidence: 31 };
  const serviceDown = { status: "bypassed" as const, confidence: 0 };

  it("saves silently when the face matches", () => {
    const v = faceVerdict(verified, 1);
    expect(v.proceed).toBe(true);
    expect(v.retry).toBe(false);
    expect(v.message).toBe("");
    expect(v.recordStatus).toBe("verified");
  });

  it("NEVER saves attendance on a real mismatch, on any attempt", () => {
    for (let attempt = 1; attempt <= MAX_FACE_ATTEMPTS + 2; attempt++) {
      expect(faceVerdict(mismatch, attempt).proceed).toBe(false);
    }
  });

  it("says the face did not match, with the confidence and the attempt", () => {
    const v = faceVerdict(mismatch, 1);
    expect(v.message).toMatch(/face verification failed/i);
    expect(v.message).toContain("31%");
    expect(v.message).toContain(`1/${MAX_FACE_ATTEMPTS}`);
    expect(v.retry).toBe(true);
  });

  it("stops offering retries after the last attempt and sends them to an admin", () => {
    const v = faceVerdict(mismatch, MAX_FACE_ATTEMPTS);
    expect(v.retry).toBe(false);
    expect(v.proceed).toBe(false);
    expect(v.message).toMatch(/contact your admin/i);
  });

  it("retries a SERVICE error without calling it a mismatch", () => {
    const v = faceVerdict(serviceDown, 1);
    expect(v.proceed).toBe(false);
    expect(v.retry).toBe(true);
    expect(v.message).toMatch(/service error/i);
    // The person's face was never compared, so saying it did not match is a lie.
    expect(v.message).not.toMatch(/does not match/i);
  });

  it("SAVES the attendance when the service is still down after the last attempt", () => {
    // The whole point: a broken gateway must not cost somebody their day.
    const v = faceVerdict(serviceDown, MAX_FACE_ATTEMPTS);
    expect(v.proceed).toBe(true);
    expect(v.retry).toBe(false);
    expect(v.recordStatus).toBe("bypassed");
    expect(v.message).toMatch(/flagged for review/i);
  });

  it("records which way it was decided, so an admin can tell them apart", () => {
    expect(faceVerdict(verified, 1).recordStatus).toBe("verified");
    expect(faceVerdict(mismatch, 1).recordStatus).toBe("failed");
    expect(faceVerdict(serviceDown, 1).recordStatus).toBe("bypassed");
  });
});

describe("hoursWorked", () => {
  it("counts the hours between the two ends", () => {
    expect(hoursWorked("2026-11-02T09:00:00Z", "2026-11-02T17:30:00Z")).toBe(8.5);
  });

  it("rounds to two decimals rather than a recurring number", () => {
    expect(hoursWorked("2026-11-02T09:00:00Z", "2026-11-02T09:50:00Z")).toBe(0.83);
  });

  it("has no answer until both ends exist", () => {
    expect(hoursWorked("2026-11-02T09:00:00Z", null)).toBeNull();
    expect(hoursWorked(null, "2026-11-02T17:00:00Z")).toBeNull();
    expect(hoursWorked(null, null)).toBeNull();
    expect(hoursWorked("not a date", "2026-11-02T17:00:00Z")).toBeNull();
  });

  it("counts a shift that runs past midnight", () => {
    expect(hoursWorked("2026-11-02T21:00:00Z", "2026-11-03T02:00:00Z")).toBe(5);
  });

  it("reads a backwards pair as zero, not as negative work", () => {
    // A clock or data fault, which must not quietly subtract from a total.
    expect(hoursWorked("2026-11-02T17:00:00Z", "2026-11-02T09:00:00Z")).toBe(0);
  });
});

describe("attendancePhotoPath", () => {
  const STAFF = "8d6be5ca-ec53-4268-a9f6-24a8764457e5";

  it("files the photo under the staff member's own id", () => {
    // The bucket policy lets a person write only inside their own folder, so
    // the path is the permission - get it wrong and the upload is refused.
    expect(attendancePhotoPath(STAFF, "check_in")).toMatch(new RegExp(`^${STAFF}/`));
  });

  it("says which end of the day it is, and when", () => {
    const at = new Date(2026, 10, 2, 9, 42);
    expect(attendancePhotoPath(STAFF, "check_in", at)).toContain("2026-11-02_check_in_");
    expect(attendancePhotoPath(STAFF, "check_out", at)).toContain("2026-11-02_check_out_");
  });

  it("never collides, even twice in the same millisecond", () => {
    const at = new Date(2026, 10, 2, 9, 42);
    expect(attendancePhotoPath(STAFF, "check_in", at)).not.toBe(attendancePhotoPath(STAFF, "check_in", at));
  });

  it("is always a .jpg, which is what the camera hands us", () => {
    expect(attendancePhotoPath(STAFF, "check_in")).toMatch(/\.jpg$/);
  });
});
