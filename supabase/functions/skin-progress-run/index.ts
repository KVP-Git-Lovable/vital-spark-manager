import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * The Skin Tracker, run without a clinician clicking.
 *
 * It picks its own work, compares two photos per measure through the Lovable
 * gateway, and writes the improvement % into skin_progress - first photo to
 * latest, and previous photo to latest.
 *
 * ── The one thing this function exists to get right ──
 *
 * Nothing in the photo table says what part of a person a photo shows:
 * photo_type is 'before' on all 91,530 rows, only 808 have a perceptual hash,
 * 94% have no appointment, and a patient averages fifteen photos. So an
 * automatic "first versus latest" will often be a face against a leg, and a
 * confident improvement percentage computed across those would be a made-up
 * number in a medical record.
 *
 * The model is therefore asked to JUDGE THE PAIR BEFORE SCORING IT, and a
 * pair it will not vouch for is written with comparable = false, the reason it
 * gave, and improvement left NULL. Nothing here will write a score the model
 * did not vouch for - see readVerdict.
 *
 * ── Why it takes no instructions from its caller ──
 *
 * The nightly job authenticates through public.sf_fire_function, which carries
 * the public anon key, exactly as the three Salesforce jobs do. So this
 * function accepts NO caller-supplied parameters at all: it chooses its own
 * patients from skin_progress_queue and is bounded by its own cap. The worst
 * an outsider who finds the URL can do is make tonight's batch run early.
 *
 * ── Why it stops before it is finished ──
 *
 * Twenty-five patients is up to fifty gateway calls, and a vision call with
 * two clinic photos is not quick. Measured against the real queue, the first
 * 25 patients need 49 calls - several minutes, well past both the platform's
 * invocation limit and sf_fire_function's own 150-second timeout. So this
 * follows the deadline pattern the sf-import-* functions and
 * fix-photo-content-types already use: stop STARTING work at 90 seconds, say
 * so in the reply, and let the next call continue. The queue is what makes
 * that safe - it hands back whatever is still unfinished.
 *
 * One deliberate difference from skin-analysis: no retry loop on a 503. That
 * function tries three times per click, which is right for a clinician waiting
 * at a screen and wrong in a batch, where it triples the bill for nothing.
 * Here a failure writes nothing, so the queue returns the pair next time.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Patients per invocation. A cap, not a cursor: the queue drains itself. */
const PATIENTS_PER_RUN = 25;

/**
 * Stop starting new pairs after this long. The same 90 seconds the other
 * batch functions here use, chosen so the reply still arrives inside
 * sf_fire_function's 150-second timeout.
 */
const RUN_BUDGET_MS = 90_000;

/**
 * Gateway calls in flight at once. These are I/O bound - the work happens at
 * the model - so a small pool turns five minutes into two. Deliberately
 * small: a 429 from the gateway wastes the call, and at three the queue is
 * never more than three pairs ahead of what has been written.
 */
const POOL = 3;

const MODEL = "google/gemini-2.5-flash";

const INSTRUCTIONS = `You are a dermatology AI comparing two clinical photographs of the same patient from The Skin Clinic.

STEP 1 - DECIDE WHETHER THE TWO PHOTOS CAN BE COMPARED AT ALL. This is the most important part of your job. These photos were picked automatically by date, with no record of what they show, so they are frequently NOT a valid pair. Refuse the comparison if ANY of these is true:
- they show different body areas (a face and an arm, a scalp and a back)
- they show the same area from views too different to compare (full face vs close-up of one cheek, front vs profile)
- either image is not a clinical skin photograph (a document, a prescription, a report, a screenshot, a product, a room)
- either image is too blurred, too dark or too obstructed to assess
- they do not plausibly show the same person

If you refuse, respond ONLY with:
{"comparable": false, "reason": "<one short sentence saying what the two photos actually show>"}

Do not score a pair you have refused. An improvement percentage across two different body parts is worse than no answer, because it goes into a patient's record.

STEP 2 - ONLY IF the two photos show the same area of the same person in comparable views, respond ONLY with:
{
  "comparable": true,
  "overallImprovement": <number 0-100>,
  "summary": "<2-3 sentence summary of the change>",
  "metrics": [{ "name": "<metric>", "before": <0-10>, "after": <0-10>, "change": "<improved/worsened/unchanged>" }],
  "details": "<detailed paragraph on the skin changes observed>"
}

Cover at least Texture, Tone Evenness, Pigmentation, Hydration, Pore Visibility and Fine Lines. Scores run 1 (worst) to 10 (best). overallImprovement is 0 for no improvement and 100 for complete resolution; it must never exceed 100.

Respond with raw JSON only - no markdown, no code fences, no commentary.`;

interface Photo { id: string; photo_url: string; taken_at: string }
type Measure = "overall" | "since_last";
interface Pair { measure: Measure; before: Photo; after: Photo }
interface Job { patientId: string; pair: Pair }

/**
 * Run a list of jobs a few at a time.
 *
 * The same ten-line helper fix-photo-content-types uses; it is written per
 * function in this repo rather than shared, so it is copied rather than
 * imported.
 */
async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

/** Oldest first, matching the ordering skin_progress_queue uses for "latest". */
function ordered(photos: Photo[]): Photo[] {
  return [...photos]
    .filter((p) => p?.id && p?.photo_url)
    .sort((a, b) => {
      const d = Date.parse(a.taken_at) - Date.parse(b.taken_at);
      return d !== 0 ? d : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
}

/**
 * The two comparisons the clinic asked for.
 *
 * With exactly two photos both measures are the same pair, so only 'overall'
 * is made: running the model twice over one pair would pay twice for an
 * identical answer.
 */
function pairs(photos: Photo[]): Pair[] {
  const list = ordered(photos);
  if (list.length < 2) return [];
  const first = list[0];
  const latest = list[list.length - 1];
  const previous = list[list.length - 2];
  const out: Pair[] = [{ measure: "overall", before: first, after: latest }];
  if (previous.id !== first.id) out.push({ measure: "since_last", before: previous, after: latest });
  return out;
}

interface Verdict {
  comparable: boolean;
  improvement: number | null;
  reason: string | null;
  metrics: unknown[];
  summary: string | null;
}

const refused = (reason: string): Verdict =>
  ({ comparable: false, improvement: null, reason, metrics: [], summary: null });

/**
 * What the model said, taken only as far as it can be trusted.
 *
 * Mirrors src/lib/skinProgress.ts, which the unit tests pin. Three ways a
 * reply is refused, and a vision model produces all three: it says the photos
 * are not comparable (the point of the gate); it vouches for them but gives no
 * usable number; or it gives a number off the scale it was asked for. The
 * existing dialog renders whatever arrives, unclamped - "160% improvement"
 * would print today.
 */
function readVerdict(raw: unknown): Verdict {
  if (!raw || typeof raw !== "object") return refused("The AI sent nothing readable back.");
  const r = raw as Record<string, unknown>;
  if (r.comparable === false) {
    const why = typeof r.reason === "string" && r.reason.trim() ? r.reason.trim() : "The two photos do not show the same area.";
    return refused(why);
  }
  // No vouch, no score. Silence is not consent here.
  if (r.comparable !== true) return refused("The AI did not confirm the photos show the same area.");
  // Number(null) and Number("") are 0 - a finite, real-looking score. A reply
  // that vouched for the pair and gave no figure must not become "0%".
  const raw0 = r.overallImprovement;
  if (raw0 === null || raw0 === undefined || raw0 === "") return refused("The AI gave no improvement figure.");
  const value = Number(raw0);
  if (!Number.isFinite(value)) return refused("The AI gave no improvement figure.");
  if (value < 0 || value > 100) return refused(`The AI gave an improvement of ${value}, which is outside 0-100.`);
  return {
    comparable: true,
    improvement: Math.round(value * 10) / 10,
    reason: null,
    metrics: Array.isArray(r.metrics) ? r.metrics : [],
    summary: typeof r.summary === "string" ? r.summary : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const deadline = Date.now() + RUN_BUDGET_MS;

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !serviceKey) return json({ error: "Supabase is not configured" }, 500);
  if (!apiKey) return json({ error: "Lovable AI is not configured" }, 401);

  const admin = createClient(url, serviceKey);

  // The brake, checked before any work is chosen as well as before every call.
  const { data: latched } = await admin
    .from("skin_ai_state").select("reason,status_code").eq("id", "skin").maybeSingle();
  if (latched) return json({ error: latched.reason, latched: true }, latched.status_code ?? 402);

  // Scope comes from the path, never from a body: ?today=1 is what the nightly
  // job calls, and it only narrows the work. Nothing a caller sends can widen
  // the batch, name a patient, or raise the cap.
  const onlyToday = new URL(req.url).searchParams.get("today") === "1";

  const { data: queue, error: queueError } = await admin
    .rpc("skin_progress_queue", { p_limit: PATIENTS_PER_RUN, p_only_today: onlyToday });
  if (queueError) return json({ error: queueError.message }, 500);

  const patientIds = ((queue ?? []) as { patient_id: string }[]).map((q) => q.patient_id);

  const report = {
    patients: patientIds.length,
    pairs_due: 0,
    pairs_already_done: 0,
    scored: 0,
    refused: 0,
    failed: 0,
    stopped_early: false,
    not_started: 0,
    latched: false,
    reasons: [] as { patient_id: string; measure: string; reason: string }[],
  };
  if (patientIds.length === 0) return json(report);

  // Two queries rather than two per patient.
  const [{ data: photoRows }, { data: existingRows }] = await Promise.all([
    admin.from("patient_photos").select("id,photo_url,taken_at,patient_id")
      .in("patient_id", patientIds).order("taken_at", { ascending: true }),
    admin.from("skin_progress").select("patient_id,measure,before_photo_id,after_photo_id")
      .in("patient_id", patientIds),
  ]);

  const photosByPatient = new Map<string, Photo[]>();
  for (const row of (photoRows ?? []) as (Photo & { patient_id: string })[]) {
    const list = photosByPatient.get(row.patient_id) ?? [];
    list.push({ id: row.id, photo_url: row.photo_url, taken_at: row.taken_at });
    photosByPatient.set(row.patient_id, list);
  }

  // What has already been answered, keyed by the exact pair it was answered
  // about. A patient comes back into the queue whenever any measure is
  // missing, so without this a resumed run would ask the gateway again - and
  // pay again - for a figure already stored about the very same two photos.
  const answered = new Set(
    ((existingRows ?? []) as { patient_id: string; measure: string; before_photo_id: string | null; after_photo_id: string | null }[])
      .map((r) => `${r.patient_id}|${r.measure}|${r.before_photo_id}|${r.after_photo_id}`),
  );

  const jobs: Job[] = [];
  for (const patientId of patientIds) {
    for (const pair of pairs(photosByPatient.get(patientId) ?? [])) {
      if (answered.has(`${patientId}|${pair.measure}|${pair.before.id}|${pair.after.id}`)) {
        report.pairs_already_done += 1;
        continue;
      }
      jobs.push({ patientId, pair });
    }
  }
  report.pairs_due = jobs.length;

  let stop: string | null = null;

  await mapPool(jobs, POOL, async ({ patientId, pair }) => {
    if (stop) { report.not_started += 1; return; }
    // Out of time. A pair already in flight is always finished and written -
    // abandoning one mid-call would spend the money and keep nothing.
    if (Date.now() > deadline) {
      report.stopped_early = true;
      report.not_started += 1;
      return;
    }

    // Re-read the latch between calls: a backfill is thousands of requests and
    // the credits can run out in the middle of one.
    const { data: tripped } = await admin
      .from("skin_ai_state").select("status_code").eq("id", "skin").maybeSingle();
    if (tripped) { stop = "AI latch tripped mid-run"; report.latched = true; report.not_started += 1; return; }

    let verdict: Verdict;
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: INSTRUCTIONS },
            {
              role: "user",
              content: [
                { type: "text", text: "First photo (earlier), then second photo (later). Decide first whether they can be compared at all." },
                { type: "image_url", image_url: { url: pair.before.photo_url } },
                { type: "image_url", image_url: { url: pair.after.photo_url } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        // Out of credits or not allowed: trip the latch so the rest of the
        // backfill stops instead of burning through thousands of failures.
        if (response.status === 402 || response.status === 403) {
          await admin.from("skin_ai_state").upsert({
            id: "skin", reason: text.slice(0, 500) || "The AI gateway refused the request",
            status_code: response.status, updated_at: new Date().toISOString(),
          });
          stop = `Gateway returned ${response.status}`;
          report.latched = true;
          return;
        }
        // Anything else (429, 503, a timeout) is left for the next run: the
        // pair stays in the queue because nothing was written for it.
        report.failed += 1;
        return;
      }

      const payload = await response.json();
      let content = String(payload.choices?.[0]?.message?.content ?? "").trim();
      if (content.startsWith("```")) {
        content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      verdict = readVerdict(JSON.parse(content));
    } catch (error) {
      // A reply that is not JSON, or a network failure. Counted, not stored:
      // a parse failure is not a clinical finding.
      console.error("skin-progress-run", patientId, pair.measure, error);
      report.failed += 1;
      return;
    }

    const { error: writeError } = await admin.from("skin_progress").upsert({
      patient_id: patientId,
      measure: pair.measure,
      before_photo_id: pair.before.id,
      after_photo_id: pair.after.id,
      before_taken_at: pair.before.taken_at,
      after_taken_at: pair.after.taken_at,
      improvement: verdict.improvement,
      comparable: verdict.comparable,
      not_comparable_reason: verdict.reason,
      summary: verdict.summary,
      metrics: verdict.metrics,
      model: MODEL,
      computed_at: new Date().toISOString(),
    }, { onConflict: "patient_id,measure" });

    if (writeError) {
      console.error("skin-progress-run write", patientId, pair.measure, writeError.message);
      report.failed += 1;
      return;
    }

    if (verdict.comparable) report.scored += 1;
    else {
      report.refused += 1;
      report.reasons.push({ patient_id: patientId, measure: pair.measure, reason: verdict.reason ?? "" });
    }
  });

  return json(stop ? { ...report, stopped: stop } : report);
});
