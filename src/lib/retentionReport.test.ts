import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  conversionCaveat, lapsedByMonth, recordingCaveat, retentionCards, retentionTotals, share,
  treatedOnceThenGone, type RetentionRow, type RetentionTotals,
} from "./retentionReport";
import { REPORTS } from "./reportsCatalog";

/**
 * The retention and conversion figures.
 *
 * These are numbers a doctor will act on - who to ring, and whether the
 * clinic converts - so the arithmetic is held down here rather than trusted
 * to a glance at the screen. The totals below are the clinic's real ones on
 * 27 Nov 2026, which is what makes a wrong denominator visible.
 */

const TOTALS: RetentionTotals = {
  new_consult_patients: 2948,
  never_returned: 1861,
  never_returned_no_procedure: 413,
  patients_on_file: 27891,
  patients_attended: 20649,
  patients_with_procedure: 15706,
  appointments: 58428,
  appointments_with_procedure: 22916,
  procedures: 38936,
  procedures_unlinked: 15853,
  window_appointments: 11732,
  window_appointments_no_service: 2146,
};

const row = (over: Partial<RetentionRow> = {}): RetentionRow => ({
  patient_id: "p1", patient_name: "A Patient", phone: "99", consult_date: "2026-03-04",
  doctor: "Dr Vindhya", service: "Consultation", had_procedure: false, returned: false,
  days_since: 100, totals: TOTALS, ...over,
});

describe("share", () => {
  it("reads as a percentage to one place", () => {
    expect(share(1861, 2948)).toBe("63.1%");
    expect(share(15706, 20649)).toBe("76.1%");
    expect(share(22916, 58428)).toBe("39.2%");
  });

  it("refuses to divide by nothing rather than printing NaN", () => {
    // A window with no first consultations is a real answer - a quiet month.
    expect(share(0, 0)).toBe("—");
    expect(share(5, 0)).toBe("—");
    expect(share(Number.NaN, 10)).toBe("—");
  });
});

describe("reading the totals off the rows", () => {
  it("takes them from whichever row carries them", () => {
    const rows = [row({ totals: null }), row({ totals: TOTALS })];
    expect(retentionTotals(rows).new_consult_patients).toBe(2948);
  });

  it("gives zeros, not undefined, when nothing came back", () => {
    const t = retentionTotals([]);
    expect(t.new_consult_patients).toBe(0);
    expect(t.procedures_unlinked).toBe(0);
    expect(Object.values(t).every((v) => typeof v === "number")).toBe(true);
  });
});

describe("treated once, then gone", () => {
  it("counts only those who had a procedure and did not return", () => {
    const rows = [
      row({ had_procedure: true, returned: false }),   // counted
      row({ had_procedure: true, returned: true }),    // came back
      row({ had_procedure: false, returned: false }),  // nothing done
      row({ had_procedure: false, returned: true }),
    ];
    expect(treatedOnceThenGone(rows)).toBe(1);
  });

  it("never counts somebody who came back as lost", () => {
    const rows = Array.from({ length: 20 }, () => row({ had_procedure: true, returned: true }));
    expect(treatedOnceThenGone(rows)).toBe(0);
  });
});

describe("the cards above the table", () => {
  const cards = (rows: RetentionRow[]) => {
    const out: Record<string, { value: string; hint?: string }> = {};
    for (const c of retentionCards(rows)) out[c.label] = { value: c.value, hint: c.hint };
    return out;
  };

  it("gives the clinic's two answers with their denominators", () => {
    const c = cards([row({ had_procedure: true, returned: false })]);
    expect(c["First consultations"].value).toBe("2,948");
    expect(c["Never came back"].value).toBe("1,861");
    expect(c["Never came back"].hint).toContain("63.1%");
    expect(c["Patients who ever had a procedure"].value).toBe("15,706");
    // Both denominators, because the two true numbers are far apart.
    expect(c["Patients who ever had a procedure"].hint).toContain("76.1%");
    expect(c["Patients who ever had a procedure"].hint).toContain("56.3%");
  });

  it("separates the ones who were treated from the ones who were not", () => {
    const rows = [
      row({ had_procedure: true, returned: false }),
      row({ had_procedure: true, returned: false }),
      row({ had_procedure: false, returned: false }),
    ];
    const c = cards(rows);
    expect(c["Treated once, then gone"].value).toBe("2");
    expect(c["Consulted, nothing done, gone"].value).toBe("413");
  });

  it("calls the appointment rate a floor on the card itself", () => {
    const c = cards([row()]);
    expect(c["Appointments that led to a procedure"].value).toBe("39.2%");
    expect(c["Appointments that led to a procedure"].hint).toContain("floor");
  });

  it("says nothing it cannot support when there are no rows", () => {
    const c = cards([]);
    expect(c["First consultations"].value).toBe("0");
    expect(c["Never came back"].hint).toContain("—");
  });
});

describe("the caveat", () => {
  it("prints the unlinked procedures and what they mean", () => {
    const text = conversionCaveat([row()]);
    expect(text).toContain("15,853");
    expect(text).toContain("38,936");
    expect(text).toContain("40.7%");
    expect(text).toContain("floor");
  });

  it("says nothing when every procedure is linked", () => {
    expect(conversionCaveat([row({ totals: { ...TOTALS, procedures_unlinked: 0 } })])).toBe("");
    expect(conversionCaveat([])).toBe("");
  });
});

describe("the recording caveat", () => {
  it("warns that a blank service makes a month undercount", () => {
    // The finding behind it: the service field is blank on 79% of October's
    // appointments and 97% of November's, so those months look like a
    // collapse in new patients when they are a collapse in record-keeping.
    const text = recordingCaveat([row()]);
    expect(text).toContain("2,146");
    expect(text).toContain("11,732");
    expect(text).toContain("18.3%");
    expect(text).toMatch(/undercounted/);
  });

  it("says nothing when every appointment names its service", () => {
    expect(recordingCaveat([row({ totals: { ...TOTALS, window_appointments_no_service: 0 } })])).toBe("");
    expect(recordingCaveat([])).toBe("");
  });
});

describe("the monthly trend", () => {
  it("counts only the ones who never came back, oldest month first", () => {
    const rows = [
      row({ consult_date: "2026-03-04", returned: false }),
      row({ consult_date: "2026-03-19", returned: false }),
      row({ consult_date: "2026-03-20", returned: true }),   // came back
      row({ consult_date: "2026-01-09", returned: false }),
    ];
    expect(lapsedByMonth(rows)).toEqual([
      { label: "Jan 2026", value: 1 },
      { label: "Mar 2026", value: 2 },
    ]);
  });

  it("skips a row with no date rather than inventing a month", () => {
    expect(lapsedByMonth([row({ consult_date: null, returned: false })])).toEqual([]);
  });
});

describe("the report in the catalogue", () => {
  const report = REPORTS.find((r) => r.key === "retention_conversion");

  it("is listed once, under Patients", () => {
    expect(report).toBeTruthy();
    expect(report!.category).toBe("Patients");
    expect(REPORTS.filter((r) => r.key === "retention_conversion")).toHaveLength(1);
    expect(report!.title).toBe("Patient Retention & Conversion");
  });

  it("says on the report what it excludes", () => {
    // It goes out as a PDF; whoever reads it will not have this conversation.
    expect(report!.description).toMatch(/cancellations and no-shows are excluded/i);
  });

  it("offers the list the front desk needs to act on it", () => {
    const keys = report!.columns.map((c) => c.key);
    expect(keys).toContain("patient_name");
    expect(keys).toContain("phone");
    expect(keys).toContain("consult_date");
    expect(keys).toContain("returned");
    expect(report!.rowHref!({ patient_id: "abc" })).toBe("/patients/abc");
  });

  it("counts in the database, not over rows in the browser", () => {
    // 58,000 appointments: a client-side count here would repeat the bug
    // that made the dashboard stop at 1,000 rows and say nothing.
    const source = readFileSync("src/lib/reportsCatalog.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(source).toContain('supabase.rpc("clinic_retention_conversion"');
  });
});

describe("the migration behind it", () => {
  const sql = readFileSync("supabase/migrations/20261127090000_retention_and_conversion_report.sql", "utf8")
    .replace(/^\s*--.*$/gm, "");

  it("is staff-only, because a definer function walks past the policies", () => {
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/if not public\.is_active_staff\(\) then/);
    expect(sql).toMatch(/raise exception/i);
    expect(sql).toMatch(/revoke all on function[\s\S]*from public, anon/i);
  });

  it("reads and never writes", () => {
    expect(sql).toMatch(/\bstable\b/i);
    for (const forbidden of [/\binsert into\b/i, /\bupdate .*\bset\b/i, /\bdelete from\b/i, /\bdrop \b/i, /\balter table\b/i]) {
      expect(sql).not.toMatch(forbidden);
    }
  });

  it("counts the clinic's day, not UTC's", () => {
    // A bare date::timestamptz is 05:30 in the clinic and silently drops the
    // morning's first appointments - it did, until this was fixed.
    expect(sql).toMatch(/at time zone 'Asia\/Kolkata'/);
    expect(sql).not.toMatch(/p_from::timestamptz/);
  });

  it("excludes cancellations and no-shows on both sides of the question", () => {
    expect((sql.match(/not in \('Cancelled', 'No Show'\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
