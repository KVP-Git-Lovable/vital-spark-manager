import { describe, it, expect } from "vitest";
import {
  dayButtons,
  faceVerdict,
  hoursWorked,
  attendancePhotoPath,
  MAX_FACE_ATTEMPTS,
} from "./attendance";

/**
 * The clinic opened the attendance screen and reported that it had no
 * day-start or day-end option. It had one button that swapped its own label.
 * Both are on screen now, as the reference app shows them, and these tests
 * exist so that never silently becomes one button again.
 */
describe("dayButtons", () => {
  const notStarted = { check_in_time: null, check_out_time: null };
  const working = { check_in_time: "2026-11-03T09:00:00Z", check_out_time: null };
  const finished = { check_in_time: "2026-11-03T09:00:00Z", check_out_time: "2026-11-03T18:00:00Z" };

  it("offers Start My Day, and refuses End My Day, before the day begins", () => {
    const b = dayButtons(notStarted);
    expect(b.start.label).toBe("Start My Day");
    expect(b.start.disabled).toBe(false);
    expect(b.end.label).toBe("End My Day");
    // Nobody ends a day they never started.
    expect(b.end.disabled).toBe(true);
  });

  it("treats no record at all the same as a day not yet begun", () => {
    for (const empty of [null, undefined]) {
      const b = dayButtons(empty);
      expect(b.start.disabled).toBe(false);
      expect(b.end.disabled).toBe(true);
    }
  });

  it("swaps to Day Started and opens End My Day once they are in", () => {
    const b = dayButtons(working);
    expect(b.start.label).toBe("Day Started");
    // There is nothing left to start - and pressing it again would try to
    // insert a second row for the same day.
    expect(b.start.disabled).toBe(true);
    expect(b.end.label).toBe("End My Day");
    expect(b.end.disabled).toBe(false);
  });

  it("closes both once the day is done", () => {
    const b = dayButtons(finished);
    expect(b.start.label).toBe("Day Ended");
    expect(b.end.label).toBe("Day Ended");
    expect(b.start.disabled).toBe(true);
    expect(b.end.disabled).toBe(true);
  });

  it("never leaves both buttons live at once", () => {
    for (const row of [notStarted, working, finished]) {
      const b = dayButtons(row);
      expect(b.start.disabled && b.end.disabled ? 0 : b.start.disabled || b.end.disabled ? 1 : 2)
        .toBeLessThanOrEqual(1);
    }
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

  it("honours an attempt cap the clinic configured, not a hardcoded three", () => {
    // attendance_config.face_max_attempts. The reference hardcodes 3.
    const first = faceVerdict(mismatch, 1, 2);
    expect(first.retry).toBe(true);
    expect(first.message).toContain("1/2");
    const last = faceVerdict(mismatch, 2, 2);
    expect(last.retry).toBe(false);
    expect(last.message).toMatch(/after 2 attempts/);
  });

  it("falls back to three when the setting is nonsense, rather than nought or endless", () => {
    // A zero cap would refuse everybody on their first try; a NaN would let
    // somebody retry for ever.
    for (const bad of [0, -1, Number.NaN, Infinity]) {
      expect(faceVerdict(mismatch, 3, bad).retry).toBe(false);
      expect(faceVerdict(mismatch, 1, bad).retry).toBe(true);
    }
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
