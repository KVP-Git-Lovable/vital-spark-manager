import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  datesInRange, datesWithNotes, noteCoversDate, noteDateLabel, parseNoteDate,
} from "./noteDates";

/**
 * Reading a note's day back out of its own prose.
 *
 * This ran once, over the clinic's seventeen real notes, to fill a column
 * that did not exist when they were written. Getting it wrong would file a
 * doctor's leave under the wrong day, which is worse than leaving it undated
 * - so the parser checks itself against the weekday the writer put in
 * brackets, and these hold that bargain.
 *
 * The cases below are the clinic's actual notes, verbatim.
 */

/** When they were typed: a Tuesday. */
const TYPED = "2026-11-24T07:17:00Z";

describe("the date at the head of a note", () => {
  it("reads the plain one-day shape", () => {
    expect(parseNoteDate("1st Dec (Tuesday) - Vindhya ma'am on leave", TYPED))
      .toEqual({ start: "2026-12-01", end: "2026-12-01" });
    expect(parseNoteDate("18th Dec (Friday) - Vindhya ma'am 10:30am - 1:30pm only", "2026-11-25T08:20:00Z"))
      .toEqual({ start: "2026-12-18", end: "2026-12-18" });
  });

  it("reads a run of days, so each one can carry the note", () => {
    expect(parseNoteDate("26th - 28th Dec (Saturday) - Ashwini ma'am on leave", TYPED))
      .toEqual({ start: "2026-12-26", end: "2026-12-28" });
  });

  it("carries a note that crosses new year into the next year", () => {
    // Typed in November 2026. "1st Jan" is January 2027, not eleven months
    // in the past - and the weekdays they wrote confirm it.
    expect(parseNoteDate("31st Dec and 1st Jan (Thursday and Friday) - Punya ma'am on leave", TYPED))
      .toEqual({ start: "2026-12-31", end: "2027-01-01" });
  });

  it("takes the date from the first line only", () => {
    const body = "9th Dec (Wednesday) -  Vindhya ma'am on leave\nPunya ma'am 3:15pm - 7pm only";
    expect(parseNoteDate(body, TYPED)).toEqual({ start: "2026-12-09", end: "2026-12-09" });
  });

  it("does not mistake a clinic time for a date", () => {
    // "3:15pm - 7pm" is the shape that would most easily be read as 3rd–7th.
    expect(parseNoteDate("16th Dec (Wednesday) - Punya ma'am 3:15pm - 7pm only", TYPED))
      .toEqual({ start: "2026-12-16", end: "2026-12-16" });
    expect(parseNoteDate("30th Nov (Monday) - All the doctors have to be free 4-4:45pm", TYPED))
      .toEqual({ start: "2026-11-30", end: "2026-11-30" });
  });

  it("reads a month that has already gone as next year's", () => {
    // Typed in November 2026. "5th Jan" is 2027 - and 5 Jan 2027 is the
    // Tuesday they wrote, where 5 Jan 2026 was a Monday.
    expect(parseNoteDate("5th Jan (Tuesday) - clinic reopens", TYPED))
      .toEqual({ start: "2027-01-05", end: "2027-01-05" });
  });

  it("never hands back a range that runs backwards", () => {
    // Written up on 5 Jan about the turn of the year: the second date must
    // not land eleven months before the first, which would be a range the
    // calendar could not draw.
    const r = parseNoteDate("31st Dec and 1st Jan - Punya ma'am on leave", "2026-01-05T09:00:00Z");
    expect(r).not.toBeNull();
    expect(r!.start <= r!.end).toBe(true);
  });

  it("does not stretch a note to a date mentioned later in the sentence", () => {
    // "back 5th Jan" is part of the sentence, not a second subject - taking
    // it would dot every day from December to January.
    expect(parseNoteDate("1st Dec (Tuesday) - Vindhya ma'am on leave, back 5th Jan", TYPED))
      .toEqual({ start: "2026-12-01", end: "2026-12-01" });
  });

  it("refuses when the weekday the writer gave does not match the date", () => {
    // 1 Dec 2026 is a Tuesday. A note calling it Friday is one of the two
    // that is wrong, and this cannot tell which - so it files neither.
    expect(parseNoteDate("1st Dec (Friday) - Vindhya ma'am on leave", TYPED)).toBeNull();
  });

  it("refuses a day that does not exist", () => {
    expect(parseNoteDate("31st Nov - stocktake", TYPED)).toBeNull();
  });

  it("gives nothing for a note that names no date", () => {
    expect(parseNoteDate("Order gloves and gauze", TYPED)).toBeNull();
    expect(parseNoteDate("test", TYPED)).toBeNull();
    expect(parseNoteDate("djsdksjksjdksjd", TYPED)).toBeNull();
    expect(parseNoteDate("", TYPED)).toBeNull();
  });

  it("gives nothing when it does not know when the note was written", () => {
    expect(parseNoteDate("1st Dec (Tuesday) - on leave", "not a date")).toBeNull();
  });
});

describe("which days a note lands on", () => {
  it("covers every day of a run, not just the ends", () => {
    expect(datesInRange({ start: "2026-12-26", end: "2026-12-28" }))
      .toEqual(["2026-12-26", "2026-12-27", "2026-12-28"]);
  });

  it("covers the single day when there is no run", () => {
    expect(datesInRange({ start: "2026-12-18", end: "2026-12-18" })).toEqual(["2026-12-18"]);
  });

  it("crosses a month and a year without losing a day", () => {
    expect(datesInRange({ start: "2026-12-31", end: "2027-01-02" }))
      .toEqual(["2026-12-31", "2027-01-01", "2027-01-02"]);
  });

  it("does not spin on a backwards range", () => {
    expect(datesInRange({ start: "2026-12-28", end: "2026-12-26" })).toEqual(["2026-12-28"]);
  });

  it("knows the middle day of a run belongs to the note", () => {
    const leave = { note_date: "2026-12-26", note_end_date: "2026-12-28" };
    expect(noteCoversDate(leave, "2026-12-27")).toBe(true);
    expect(noteCoversDate(leave, "2026-12-26")).toBe(true);
    expect(noteCoversDate(leave, "2026-12-28")).toBe(true);
    expect(noteCoversDate(leave, "2026-12-25")).toBe(false);
    expect(noteCoversDate(leave, "2026-12-29")).toBe(false);
  });

  it("puts an undated note on no day at all", () => {
    expect(noteCoversDate({ note_date: null }, "2026-12-27")).toBe(false);
    expect(noteCoversDate({}, "2026-12-27")).toBe(false);
  });
});

describe("the dots on the calendar", () => {
  it("marks every day a note touches, once", () => {
    const marked = datesWithNotes([
      { note_date: "2026-12-26", note_end_date: "2026-12-28" },
      { note_date: "2026-12-27" },
      { note_date: null },
      {},
    ]);
    expect([...marked].sort()).toEqual(["2026-12-26", "2026-12-27", "2026-12-28"]);
  });

  it("marks nothing when nothing is dated", () => {
    expect(datesWithNotes([{ note_date: null }, {}]).size).toBe(0);
  });
});

describe("how a date reads on screen", () => {
  it("writes a single day plainly", () => {
    expect(noteDateLabel("2026-12-18")).toBe("18 Dec 2026");
    expect(noteDateLabel("2026-12-18", "2026-12-18")).toBe("18 Dec 2026");
  });

  it("writes a run inside one month once", () => {
    expect(noteDateLabel("2026-12-26", "2026-12-28")).toBe("26–28 Dec 2026");
  });

  it("names both months when a run crosses one", () => {
    expect(noteDateLabel("2026-12-31", "2027-01-01")).toBe("31 Dec 2026 – 1 Jan 2027");
  });

  it("says nothing for an undated note", () => {
    expect(noteDateLabel(null)).toBe("");
    expect(noteDateLabel(undefined)).toBe("");
  });
});

describe("the migration that filled the column in", () => {
  const sql = readFileSync("supabase/migrations/20261126140000_a_note_knows_its_day.sql", "utf8")
    .replace(/^\s*--.*$/gm, "");

  it("adds the columns without breaking the build the clinic is running", () => {
    // AGENTS.md: a schema change must keep the CURRENTLY PUBLISHED build
    // working with no deploy.
    expect(sql).toMatch(/add column if not exists note_date date/);
    expect(sql).toMatch(/add column if not exists note_end_date date/);
    expect(sql).not.toMatch(/not null/i);
    expect(sql).not.toMatch(/\bdrop (table|column|policy)\b/i);
    expect(sql).not.toMatch(/rename/i);
  });

  it("never touches a note's words", () => {
    // The backfill may set the two new columns and nothing else. A body
    // rewritten by a migration is the one unrecoverable mistake here.
    expect(sql).not.toMatch(/set[\s\S]{0,200}\bbody\s*=/i);
    expect(sql).not.toMatch(/delete from/i);
  });

  it("can be run twice without overwriting a date set by hand", () => {
    expect(sql).toMatch(/and n\.note_date is null/);
  });
});
