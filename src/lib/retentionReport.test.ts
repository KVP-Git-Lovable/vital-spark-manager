import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  conversionCaveat, lapsedByMonth, retentionCards, retentionTotals, share,
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
  // Of the 23,110 procedures carrying a real date, 23,093 are linked. The
  // 15,836 unlinked ones are undated imports from the old system.
  procedures_dated: 23110,
  procedures_dated_unlinked: 17,
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
    expect(c["First-time patients"].value).toBe("2,948");
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

  it("gives the appointment rate its denominator, and claims nothing more", () => {
    // It used to say "a floor, see note below" - a hedge based on a
    // miscount, pointing at a note the page could not render.
    const c = cards([row()]);
    expect(c["Appointments that led to a procedure"].value).toBe("39.2%");
    expect(c["Appointments that led to a procedure"].hint).toContain("22,916");
    expect(c["Appointments that led to a procedure"].hint).toContain("58,428");
    expect(c["Appointments that led to a procedure"].hint).not.toMatch(/floor/i);
  });

  it("says nothing it cannot support when there are no rows", () => {
    const c = cards([]);
    expect(c["First-time patients"].value).toBe("0");
    expect(c["Never came back"].hint).toContain("—");
  });
});

describe("the caveat", () => {
  it("explains the unlinked records instead of calling the rate a guess", () => {
    // The old version said 40.7% of procedures carry no appointment, so the
    // rate was "a floor" - counting 15,836 undated imports that no dated
    // figure should include. Among DATED procedures, 23,093 of 23,110 are
    // linked, so the honest note is a reassuring one.
    const text = conversionCaveat([row()]);
    expect(text).toContain("38,936");
    expect(text).toContain("15,826");   // imported without a date
    expect(text).toContain("23,110");
    expect(text).toContain("99.9%");
    expect(text).not.toMatch(/floor/i);
    expect(text).toMatch(/cancellations and no-shows are excluded/i);
  });

  it("says nothing when every procedure carries a date", () => {
    expect(conversionCaveat([row({ totals: { ...TOTALS, procedures_dated: TOTALS.procedures } })])).toBe("");
    expect(conversionCaveat([])).toBe("");
  });
});

describe("the note actually reaches the page", () => {
  const report = REPORTS.find((r) => r.key === "retention_conversion")!;

  it("is wired to footnotes, not left dangling", () => {
    // The whole defect: a card said "see note below" while conversionCaveat
    // was imported and never called, and ReportConfig had no field for it.
    expect(typeof report.footnotes).toBe("function");
    const notes = report.footnotes!([row() as unknown as Record<string, unknown>]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("23,110");
  });

  it("drops an empty note rather than printing a blank line", () => {
    expect(report.footnotes!([])).toEqual([]);
  });

  it("no card promises a note that is not there", () => {
    for (const card of retentionCards([row()])) {
      expect(card.hint ?? "").not.toMatch(/see note below/i);
    }
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

describe("the migration that stops it depending on the service field", () => {
  const sql = readFileSync("supabase/migrations/20261127190000_retention_without_the_broken_service_field.sql", "utf8")
    .replace(/^\s*--.*$/gm, "");

  it("no longer discards a patient because the service box was left empty", () => {
    // appointments.service is blank on 79% of Oct 2026 bookings and 97% of
    // Nov's. Requiring it to say "consult" made those months look like a
    // collapse in new patients that was really a collapse in typing.
    expect(sql).not.toMatch(/service ilike/i);
    expect(sql).toMatch(/where fi\.start_time >= v_from\s+and fi\.start_time < v_to\s*\)/);
  });

  it("still returns the service as something to look at", () => {
    expect(sql).toMatch(/s\.service,/);
  });

  it("counts linkage among DATED procedures, which is the only honest denominator", () => {
    expect(sql).toMatch(/'procedures_dated',\s*\(\s*select count\(\*\) from public\.procedures p where not p\.date_not_recorded\)/);
    // Both halves, or the unlinked count silently becomes 15,853 again -
    // the very figure that produced the misleading "floor" caveat.
    expect(sql).toMatch(/not p\.date_not_recorded and p\.appointment_id is null/);
  });

  it("keeps every totals key the published build may read", () => {
    for (const key of [
      "new_consult_patients", "never_returned", "never_returned_no_procedure",
      "patients_on_file", "patients_attended", "patients_with_procedure",
      "appointments", "appointments_with_procedure", "procedures",
      "procedures_unlinked", "window_appointments", "window_appointments_no_service",
    ]) {
      expect(sql).toContain(`'${key}',`);
    }
  });

  it("keeps the staff gate and the clinic's own day", () => {
    expect(sql).toMatch(/if not public\.is_active_staff\(\) then/);
    expect(sql).toMatch(/raise exception/i);
    expect(sql).toMatch(/at time zone 'Asia\/Kolkata'/);
    expect(sql).toMatch(/\bstable\b/i);
    expect(sql).toMatch(/revoke all on function[\s\S]*from public, anon/i);
  });

  it("changes no signature, so the published build is untouched", () => {
    expect(sql).toMatch(/create or replace function public\.clinic_retention_conversion\(\s*p_from date,\s*p_to date\s*\)/);
    expect(sql).not.toMatch(/drop function/i);
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
