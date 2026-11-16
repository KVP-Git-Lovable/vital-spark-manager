import { reserveTab, type PendingTab } from "./newTab";
import type { KnowledgeArticle } from "@/lib/knowledge";
import {
  factCards, patientFacts, patientSummaryIsPublic, PATIENT_SUMMARY_DISCLAIMER,
} from "@/lib/patientSummary";
import { CLINIC_ADDRESS_LINES, CLINIC_PHONES } from "@/lib/clinicContact";

/**
 * The patient summary, on paper.
 *
 * The clinic explains a treatment, the patient nods, and by the time they are
 * home half of it is gone - particularly the aftercare, which is the part that
 * changes the result. A handout is the oldest fix there is and it needs no
 * login, which matters here: the patient portal has had fifteen sign-ins in its
 * life against twenty-seven thousand patients.
 *
 * Built as a self-contained HTML document and handed to the browser's own print
 * dialogue, the same way printAppointments.ts does the day sheet. No PDF
 * service, no new dependency, and the clinic can "print" to PDF from the same
 * dialogue if they want to send the file instead.
 *
 * ── Black and white is the design constraint ──
 *
 * A clinic printer is usually monochrome, so colour can decorate but must never
 * be the only thing carrying a meaning. Do and Don't are a tick and a cross and
 * the words themselves, not a green box and a red box; the cards have borders
 * rather than fills. print-color-adjust is set where a fill genuinely helps on
 * a colour printer, and the page is still right without it.
 */

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Paragraphs from plain text, blank-line separated, each one escaped. */
function paragraphs(text: string): string {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export const UNPUBLISHED_HANDOUT_ERROR =
  "This article is not published yet, so it cannot be printed for a patient.";

/**
 * The document itself, as a string.
 *
 * Separate from the printing so it can be read in a test without a browser:
 * the escaping and the published-only rule are the two things here worth
 * proving, and neither needs a window.
 */
export function patientHandoutHtml(
  article: Pick<KnowledgeArticle, "title" | "status" | "is_active" | "patient_summary" | "patient_facts">,
  opts: { serviceName?: string; clinicName?: string } = {},
): string {
  // The same gate as the screen, repeated here rather than trusted from the
  // caller: this function's output is the thing that ends up in a patient's
  // hand, so it decides for itself.
  if (!patientSummaryIsPublic(article)) throw new Error(UNPUBLISHED_HANDOUT_ERROR);

  const facts = patientFacts(article.patient_facts);
  const cards = factCards(facts);
  const clinic = opts.clinicName || "The Skin Clinic";
  const heading = opts.serviceName || article.title;

  const list = (items: string[] | undefined, mark: string, title: string) =>
    items?.length
      ? `<section class="list"><h2><span class="mark">${mark}</span>${esc(title)}</h2><ul>${items
          .map((i) => `<li>${esc(i)}</li>`)
          .join("")}</ul></section>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(heading)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; margin: 0; line-height: 1.5; font-size: 12pt; }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px; }
  .clinic { font-size: 10pt; letter-spacing: .06em; text-transform: uppercase; }
  h1 { font-size: 19pt; margin: 6px 0 2px; }
  .kicker { font-size: 10pt; color: #555; }
  p { margin: 0 0 9px; }
  /* Cards: a border, not a fill, so a monochrome printer still shows the box. */
  .cards { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
  .card { border: 1px solid #999; border-radius: 6px; padding: 7px 10px; min-width: 110px; flex: 1 1 110px; }
  .card .label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; color: #555; }
  .card .value { font-size: 11.5pt; font-weight: 600; margin-top: 2px; }
  .list { margin: 12px 0; break-inside: avoid; }
  /* Both headings together: the timeline's used to fall through to the
     browser's default h2 and printed half again as large as the others. */
  .list h2, .timeline h2 { font-size: 12pt; margin: 0 0 5px; display: flex; align-items: baseline; gap: 6px; }
  /* The tick and the cross carry Do vs Don't without any colour at all. */
  .mark { font-weight: 700; }
  ul { margin: 0; padding-left: 20px; }
  li { margin-bottom: 3px; }
  .timeline { margin: 12px 0; break-inside: avoid; }
  .step { display: flex; gap: 10px; padding: 5px 0; border-top: 1px solid #ddd; }
  .step .when { min-width: 110px; font-weight: 600; }
  footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 9pt; color: #555; }
  .note { font-style: italic; margin-bottom: 5px; }
</style></head><body>
<header>
  <div class="clinic">${esc(clinic)}</div>
  <h1>${esc(heading)}</h1>
  <div class="kicker">What this treatment involves</div>
</header>
${paragraphs(article.patient_summary)}
${cards.length ? `<div class="cards">${cards
    .map((c) => `<div class="card"><div class="label">${esc(c.label)}</div><div class="value">${esc(c.value)}</div></div>`)
    .join("")}</div>` : ""}
${list(facts.dos, "✓", "Please do")}
${list(facts.donts, "✗", "Please don't")}
${facts.timeline?.length ? `<section class="timeline"><h2>What happens, and when</h2>${facts.timeline
    .map((s) => `<div class="step"><div class="when">${esc(s.when)}</div><div>${esc(s.what)}</div></div>`)
    .join("")}</section>` : ""}
<footer>
  <p class="note">${esc(PATIENT_SUMMARY_DISCLAIMER)}</p>
  <p>${esc(clinic)} · ${CLINIC_ADDRESS_LINES.map(esc).join(", ")} · ${CLINIC_PHONES.map((p) => esc(p.label)).join(" · ")}</p>
</footer>
</body></html>`;
}

/**
 * Print it.
 *
 * `tab` must be reserved in the click handler itself - a browser only honours
 * window.open while it is handling the gesture, so a tab opened after any await
 * is blocked as a pop-up. See src/lib/newTab.ts.
 */
export function printPatientHandout(
  article: Parameters<typeof patientHandoutHtml>[0],
  opts: Parameters<typeof patientHandoutHtml>[1] = {},
  tab: PendingTab = reserveTab(),
): void {
  const html = patientHandoutHtml(article, opts);
  if (tab.blocked) throw new Error("Please allow pop-ups to print this handout.");
  tab.write(html);
  tab.print(400);
}
