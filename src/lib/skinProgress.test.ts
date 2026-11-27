import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  measureLabel, orderedPhotos, progressLabel, readVerdict, skinPairs,
  type PhotoForPairing, type SkinProgressRow,
} from "./skinProgress";

/**
 * The Skin Tracker's automatic figure.
 *
 * This writes an improvement percentage into a patient's record without a
 * clinician choosing the photos, so the tests are about what it REFUSES to
 * write. The clinic's photo table gives automatic pairing nothing to go on -
 * photo_type is 'before' on all 91,530 rows, 94% have no appointment, and a
 * patient averages fifteen photos of different body parts - so the gate that
 * stops a face being compared to a leg is the whole design.
 */

const photo = (id: string, taken_at: string | null): PhotoForPairing =>
  ({ id, photo_url: `https://example.test/${id}.jpg`, taken_at });

describe("ordering the photos", () => {
  it("puts the oldest first, whatever order they arrive in", () => {
    const out = orderedPhotos([
      photo("c", "2026-11-01T10:00:00Z"),
      photo("a", "2026-01-05T10:00:00Z"),
      photo("b", "2026-06-09T10:00:00Z"),
    ]);
    expect(out.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("drops a row with no id or no url rather than pairing against nothing", () => {
    const out = orderedPhotos([
      photo("a", "2026-01-05T10:00:00Z"),
      { id: "", photo_url: "x", taken_at: "2026-02-01T10:00:00Z" },
      { id: "b", photo_url: "", taken_at: "2026-03-01T10:00:00Z" },
    ]);
    expect(out.map((p) => p.id)).toEqual(["a"]);
  });

  it("sorts an undated photo last instead of treating it as the first", () => {
    // taken_at is NOT NULL in the database, so this is a belt-and-braces
    // case - but "first photo" is the baseline of the overall figure, and a
    // null sorting to the front would silently become that baseline.
    const out = orderedPhotos([
      photo("undated", null),
      photo("a", "2026-01-05T10:00:00Z"),
      photo("b", "2026-06-09T10:00:00Z"),
    ]);
    expect(out.map((p) => p.id)).toEqual(["a", "b", "undated"]);
  });
});

describe("choosing the two pairs", () => {
  it("compares first to latest, and previous to latest", () => {
    const pairs = skinPairs([
      photo("first", "2026-01-05T10:00:00Z"),
      photo("mid", "2026-04-02T10:00:00Z"),
      photo("prev", "2026-08-18T10:00:00Z"),
      photo("latest", "2026-11-20T10:00:00Z"),
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({ measure: "overall" });
    expect([pairs[0].before.id, pairs[0].after.id]).toEqual(["first", "latest"]);
    expect(pairs[1]).toMatchObject({ measure: "since_last" });
    expect([pairs[1].before.id, pairs[1].after.id]).toEqual(["prev", "latest"]);
  });

  it("makes one pair, not two identical ones, when there are only two photos", () => {
    // With two photos, first->latest and previous->latest are the same pair.
    // Asking the model twice would pay twice for the same answer, and across
    // 5,678 patients that is a real bill.
    const pairs = skinPairs([
      photo("a", "2026-02-01T10:00:00Z"),
      photo("b", "2026-09-01T10:00:00Z"),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].measure).toBe("overall");
    expect([pairs[0].before.id, pairs[0].after.id]).toEqual(["a", "b"]);
  });

  it("makes nothing at all from one photo, or none", () => {
    expect(skinPairs([photo("only", "2026-02-01T10:00:00Z")])).toEqual([]);
    expect(skinPairs([])).toEqual([]);
  });

  it("uses the dates, not the order the rows arrived in", () => {
    const pairs = skinPairs([
      photo("latest", "2026-11-20T10:00:00Z"),
      photo("first", "2026-01-05T10:00:00Z"),
      photo("prev", "2026-08-18T10:00:00Z"),
    ]);
    expect([pairs[0].before.id, pairs[0].after.id]).toEqual(["first", "latest"]);
    expect([pairs[1].before.id, pairs[1].after.id]).toEqual(["prev", "latest"]);
  });
});

describe("reading what the AI said", () => {
  const vouched = { comparable: true, overallImprovement: 42.37, summary: "Clearer", metrics: [{ name: "Texture" }] };

  it("keeps a vouched figure, to one decimal place", () => {
    const v = readVerdict(vouched);
    expect(v.comparable).toBe(true);
    expect(v.improvement).toBe(42.4);
    expect(v.reason).toBeNull();
    expect(v.summary).toBe("Clearer");
    expect(v.metrics).toHaveLength(1);
  });

  it("writes no figure when the AI refuses the pair, and keeps its reason", () => {
    const v = readVerdict({
      comparable: false,
      reason: "The first photo shows a face, the second a forearm.",
      overallImprovement: 80,
    });
    expect(v.comparable).toBe(false);
    // The number that arrived anyway is discarded. This is the assertion the
    // whole feature rests on: a score across two body parts never gets stored.
    expect(v.improvement).toBeNull();
    expect(v.reason).toBe("The first photo shows a face, the second a forearm.");
  });

  it("refuses the pair when the AI simply did not vouch for it", () => {
    // Silence is not consent. A reply with a score and no verdict is the
    // shape today's prompt produces, and it must not be stored as a finding.
    for (const raw of [
      { overallImprovement: 55 },
      { comparable: "yes", overallImprovement: 55 },
      { comparable: null, overallImprovement: 55 },
    ]) {
      const v = readVerdict(raw);
      expect(v.comparable).toBe(false);
      expect(v.improvement).toBeNull();
      expect(v.reason).toMatch(/did not confirm/i);
    }
  });

  it("refuses a vouched reply that carries no usable number", () => {
    for (const raw of [
      { comparable: true },
      { comparable: true, overallImprovement: "quite a lot" },
      { comparable: true, overallImprovement: null },
    ]) {
      const v = readVerdict(raw);
      expect(v.comparable).toBe(false);
      expect(v.improvement).toBeNull();
      expect(v.reason).toMatch(/no improvement figure/i);
    }
  });

  it("refuses a percentage off the scale it asked for", () => {
    // The existing dialog renders whatever the model emits, unclamped: a
    // "160% improvement" would print on screen today.
    expect(readVerdict({ comparable: true, overallImprovement: 160 }).improvement).toBeNull();
    expect(readVerdict({ comparable: true, overallImprovement: 160 }).reason).toContain("160");
    expect(readVerdict({ comparable: true, overallImprovement: -5 }).improvement).toBeNull();
    // ...and keeps the two legitimate ends of it.
    expect(readVerdict({ comparable: true, overallImprovement: 0 }).improvement).toBe(0);
    expect(readVerdict({ comparable: true, overallImprovement: 0 }).comparable).toBe(true);
    expect(readVerdict({ comparable: true, overallImprovement: 100 }).improvement).toBe(100);
  });

  it("gives a reason of its own when the refusal came with none", () => {
    expect(readVerdict({ comparable: false }).reason).toMatch(/same area/i);
    expect(readVerdict({ comparable: false, reason: "   " }).reason).toMatch(/same area/i);
  });

  it("refuses something that is not an object at all", () => {
    for (const raw of [null, undefined, "", "not json", 7, false]) {
      const v = readVerdict(raw);
      expect(v.comparable).toBe(false);
      expect(v.improvement).toBeNull();
      expect(v.reason).toMatch(/nothing readable/i);
    }
  });

  it("never returns a non-empty metrics list it was not given", () => {
    expect(readVerdict({ comparable: true, overallImprovement: 10, metrics: "nope" }).metrics).toEqual([]);
  });
});

describe("the line on the patient's record", () => {
  const row = (over: Partial<SkinProgressRow> = {}): SkinProgressRow => ({
    measure: "overall", improvement: 42.4, comparable: true,
    not_comparable_reason: null, computed_at: "2026-11-27T04:00:00Z", ...over,
  });

  it("prints the figure as a percentage", () => {
    expect(progressLabel(row())).toBe("42.4% improvement");
    expect(progressLabel(row({ improvement: "0" }))).toBe("0% improvement");
  });

  it("says why it is not comparable, never 0%", () => {
    // A 0% here would be a lie about the same two photos.
    const label = progressLabel(row({
      comparable: false, improvement: null,
      not_comparable_reason: "One photo is of the face, the other a forearm.",
    }));
    expect(label).toBe("One photo is of the face, the other a forearm.");
    expect(label).not.toContain("0%");
  });

  it("falls back to plain words when there is no reason and no figure", () => {
    expect(progressLabel(row({ comparable: false, improvement: null, not_comparable_reason: null })))
      .toBe("Not comparable");
    expect(progressLabel(row({ comparable: true, improvement: null }))).toBe("Not measured yet");
    expect(progressLabel(null)).toBe("Not measured yet");
    expect(progressLabel(undefined)).toBe("Not measured yet");
  });

  it("names the two measures in words a clinician reads", () => {
    expect(measureLabel("overall")).toBe("First photo to latest");
    expect(measureLabel("since_last")).toBe("Since the previous photo");
  });
});

describe("the runner, as a piece of source", () => {
  // The edge function cannot be imported here (Deno, remote imports), and it
  // is the thing that actually spends money and writes to a patient record.
  // These assertions hold its safety properties down by reading it.
  const src = readFileSync("supabase/functions/skin-progress-run/index.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("asks the model to judge the pair before scoring it", () => {
    expect(src).toMatch(/"comparable": false/);
    expect(src).toMatch(/different body areas/i);
    expect(src).toMatch(/Do not score a pair you have refused/i);
  });

  it("carries the same verdict reader the tests above pin", () => {
    expect(src).toMatch(/r\.comparable !== true/);
    expect(src).toMatch(/value < 0 \|\| value > 100/);
    expect(src).toMatch(/improvement: verdict\.improvement/);
    expect(src).toMatch(/comparable: verdict\.comparable/);
  });

  it("checks the billing latch before the run and between calls", () => {
    expect((src.match(/from\("skin_ai_state"\)\s*\.select/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // ...and trips it itself when the gateway refuses, so a backfill of
    // thousands of calls stops instead of failing thousands of times.
    expect(src).toMatch(/status === 402 \|\| response\.status === 403/);
    expect(src).toMatch(/from\("skin_ai_state"\)\.upsert/);
  });

  it("caps each run and takes no instruction from its caller", () => {
    // The nightly job authenticates with the public anon key, so anything the
    // caller could name would be namable by anyone who finds the URL.
    expect(src).toMatch(/PATIENTS_PER_RUN = \d+/);
    expect(src).toMatch(/p_limit: PATIENTS_PER_RUN/);
    expect(src).not.toMatch(/req\.json\(\)/);
    const params = src.match(/searchParams\.get\("[a-z_]+"\)/g) ?? [];
    expect(params).toEqual(['searchParams.get("today")']);
  });

  it("is declared as needing a JWT, rather than inheriting it", () => {
    // This file is full of verify_jwt = false for webhooks. An absence here
    // would later read as "no JWT needed" on a function that spends credits.
    const toml = readFileSync("supabase/config.toml", "utf8");
    expect(toml).toMatch(/\[functions\.skin-progress-run\]\s*\n\s*verify_jwt = true/);
  });

  it("does not retry a 503 the way the interactive function does", () => {
    // skin-analysis retries three times per click, which is right for a
    // clinician waiting and triples the bill in a batch of 11,400 calls.
    expect(src).not.toMatch(/attempt/);
    expect(src).not.toMatch(/for \(let attempt/);
  });

  it("stops starting work before the platform stops it, and says so", () => {
    // The real queue needs 49 gateway calls for its first 25 patients -
    // minutes of work, past both the invocation limit and sf_fire_function's
    // 150s timeout. Same deadline pattern as the sf-import-* functions.
    expect(src).toMatch(/RUN_BUDGET_MS = 90_000/);
    expect(src).toMatch(/const deadline = Date\.now\(\) \+ RUN_BUDGET_MS/);
    expect(src).toMatch(/if \(Date\.now\(\) > deadline\)/);
    expect(src).toMatch(/stopped_early: false/);
    expect(src).toMatch(/report\.stopped_early = true/);
  });

  it("never abandons a pair it has already paid for", () => {
    // The deadline is checked BEFORE the gateway call, never after: stopping
    // mid-call would spend the money and keep nothing, and would leave the
    // queue believing the pair was never asked.
    const beforeCall = src.slice(0, src.indexOf("await fetch("));
    expect(beforeCall).toMatch(/Date\.now\(\) > deadline/);
    const afterCall = src.slice(src.indexOf("await fetch("));
    expect(afterCall).not.toMatch(/Date\.now\(\) > deadline/);
  });

  it("does not ask again about a pair already answered", () => {
    // A patient re-enters the queue whenever ANY measure is missing, so
    // without this a resumed run pays the gateway a second time for a figure
    // already stored about the very same two photos.
    expect(src).toMatch(/const answered = new Set\(/);
    expect(src).toMatch(/answered\.has\(`\$\{patientId\}\|\$\{pair\.measure\}\|\$\{pair\.before\.id\}\|\$\{pair\.after\.id\}`\)/);
    expect(src).toMatch(/pairs_already_done \+= 1/);
  });

  it("runs a few gateway calls at once, but only a few", () => {
    expect(src).toMatch(/const POOL = 3;/);
    expect(src).toMatch(/mapPool\(jobs, POOL,/);
  });

  it("writes one row per patient per measure rather than a pile of history", () => {
    expect(src).toMatch(/onConflict: "patient_id,measure"/);
  });
});

describe("the queue that decides what is still due", () => {
  const sql = readFileSync("supabase/migrations/20261127170000_the_queue_counts_both_measures.sql", "utf8")
    .replace(/^\s*--.*$/gm, "");

  it("counts the measures recorded, instead of checking only 'overall'", () => {
    // The original checked `measure = 'overall'` alone, so a patient whose
    // run stopped between the two measures looked complete, dropped out of
    // the queue, and never had 'since_last' computed at all.
    expect(sql).toMatch(/select count\(\*\)[\s\S]*?from public\.skin_progress sp/);
    expect(sql).toMatch(/case when pp\.photo_count >= 3 then 2 else 1 end/);
    expect(sql).not.toMatch(/and sp\.measure = 'overall'/);
  });

  it("still measures against the patient's CURRENT latest photo", () => {
    // Otherwise a patient photographed again would never be re-measured.
    expect(sql).toMatch(/sp\.after_photo_id = pp\.latest_photo_id/);
  });

  it("keeps every guard the first version had", () => {
    expect(sql).toMatch(/revoke all on function public\.skin_progress_queue\(integer, boolean\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.skin_progress_queue\(integer, boolean\) to service_role/);
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).toMatch(/limit greatest\(1, least\(coalesce\(p_limit, 25\), 200\)\)/);
    expect(sql).toMatch(/at time zone 'Asia\/Kolkata'/);
  });

  it("changes no signature, so the published build is untouched", () => {
    expect(sql).toMatch(/create or replace function public\.skin_progress_queue\(\s*p_limit integer default 25,\s*p_only_today boolean default false\s*\)/);
    expect(sql).not.toMatch(/drop function/i);
  });
});

describe("the migration behind it", () => {
  const sql = readFileSync("supabase/migrations/20261127140000_keep_the_skin_tracker_number.sql", "utf8")
    .replace(/^\s*--.*$/gm, "");

  it("gives every new table the restrictive staff gate", () => {
    for (const table of ["skin_progress", "skin_ai_state"]) {
      expect(sql).toMatch(new RegExp(`create policy signed_in_must_be_staff on public\\.${table}\\s+as restrictive`));
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
    }
    // ...and its own policies ask the same question rather than USING (true).
    expect(sql).not.toMatch(/using \(true\)/i);
    expect((sql.match(/\(select public\.is_active_staff\(\)\)/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("gives the app no way to write or edit a figure", () => {
    // These rows record what an AI said about two specific photos. A
    // clinician editing the number by hand would make it mean nothing.
    // Every non-restrictive policy on the table must be SELECT. "for all"
    // would quietly grant the writes too, which is how this assertion first
    // passed while an all-verbs policy sat on the table.
    const policies = [...sql.matchAll(/create policy\s+(?:"[^"]+"|\S+)\s+on public\.skin_progress\s+(as restrictive\s+)?for (\w+)/gi)];
    expect(policies.length).toBeGreaterThanOrEqual(2);
    for (const [, restrictive, verb] of policies) {
      if (!restrictive) expect(verb.toLowerCase()).toBe("select");
    }
  });

  it("keeps one row per patient per measure", () => {
    expect(sql).toMatch(/unique \(patient_id, measure\)/);
    expect(sql).toMatch(/check \(measure in \('overall', 'since_last'\)\)/);
  });

  it("lets the improvement be NULL, and nothing outside 0-100", () => {
    // NULL is "no answer". A default of 0 would read as "no improvement" on
    // every pair the AI refused.
    expect(sql).toMatch(/improvement numeric check \(improvement is null or \(improvement >= 0 and improvement <= 100\)\)/);
    expect(sql).not.toMatch(/improvement[^,\n]*\bdefault\b/);
  });

  it("keeps the currently published build working, with no deploy", () => {
    // The clinic runs clinic.quickapp.ai, which only changes on a publish,
    // while a migration reaches the same database the moment it is applied.
    expect(sql).not.toMatch(/\balter table\b[\s\S]*?\bdrop column\b/i);
    expect(sql).not.toMatch(/\brename\b/i);
    expect(sql).not.toMatch(/\bdrop table\b/i);
    for (const m of sql.match(/add column[^;]*/gi) ?? []) {
      expect(m).not.toMatch(/not null/i);
    }
  });

  it("hands the queue to the runner alone, and not through a definer", () => {
    expect(sql).toMatch(/revoke all on function public\.skin_progress_queue\(integer, boolean\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.skin_progress_queue\(integer, boolean\) to service_role/);
    // The service key bypasses RLS on its own; a definer here would be a hole
    // through the policies for no benefit.
    expect(sql).not.toMatch(/security definer/i);
  });

  it("schedules the nightly job switched off, because the function is not deployed yet", () => {
    // The journeys scheduler in this codebase was built schedule-ready and
    // left off and forgotten; an active job here would fire nightly at a URL
    // that does not exist until somebody deploys the function from Lovable.
    expect(sql).toMatch(/cron\.schedule\('skin-progress-nightly', '30 21 \* \* \*'/);
    // cron.alter_job, not a direct UPDATE on cron.job: this database refuses
    // that outright, so the obvious statement would fail on apply.
    expect(sql).toMatch(/cron\.alter_job\(\s*job_id := \(select jobid from cron\.job where jobname = 'skin-progress-nightly'\),\s*active := false\)/);
    expect(sql).not.toMatch(/update cron\.job set/);
    // It asks for the day's patients, and passes nothing else.
    expect(sql).toMatch(/sf_fire_function\('skin-progress-run\?today=1'\)/);
  });

  it("caps the queue in the database too, and reads the clinic's day", () => {
    expect(sql).toMatch(/limit greatest\(1, least\(coalesce\(p_limit, 25\), 200\)\)/);
    expect(sql).toMatch(/at time zone 'Asia\/Kolkata'/);
  });
});
