import { describe, expect, it } from "vitest";
import { patientHandoutHtml, UNPUBLISHED_HANDOUT_ERROR } from "./patientHandout";

/**
 * The handout a patient takes home.
 *
 * It leaves the building, so two things matter more than layout: it must never
 * be printable from an unpublished article, and every piece of text in it is
 * written by a person into a form and must be escaped on the way into the HTML.
 * A title is the obvious injection point because it is the one field with no
 * length limit worth speaking of and it lands in both the <title> and the <h1>.
 */

const article = (over: Record<string, unknown> = {}) => ({
  title: "Laser hair reduction",
  status: "published",
  is_active: true,
  patient_summary: "Laser treatment makes hair grow back finer and slower.\n\nYou will need a few visits.",
  patient_facts: {
    sessions: "6 to 8 sessions", downtime: "None",
    dos: ["Use sunscreen every day"],
    donts: ["Do not wax between sessions"],
    timeline: [{ when: "Before", what: "Shave the area the day before" }],
  },
  ...over,
} as Parameters<typeof patientHandoutHtml>[0]);

describe("what gets printed", () => {
  it("carries the summary, the cards, the lists and the timeline", () => {
    const html = patientHandoutHtml(article());
    expect(html).toContain("Laser treatment makes hair grow back finer");
    expect(html).toContain("6 to 8 sessions");
    expect(html).toContain("Use sunscreen every day");
    expect(html).toContain("Do not wax between sessions");
    expect(html).toContain("Shave the area the day before");
  });

  it("splits blank-line separated text into paragraphs", () => {
    const html = patientHandoutHtml(article());
    expect(html).toContain("<p>Laser treatment makes hair grow back finer and slower.</p>");
    expect(html).toContain("<p>You will need a few visits.</p>");
  });

  it("says it is not personal medical advice", () => {
    expect(patientHandoutHtml(article())).toMatch(/not personal medical advice/i);
  });

  it("marks Do and Don't with a tick and a cross, not only colour", () => {
    // A clinic printer is usually monochrome. If colour were the only
    // difference, the two lists would print identically.
    const html = patientHandoutHtml(article());
    expect(html).toContain("✓");
    expect(html).toContain("✗");
  });

  it("prefers the service name over the article's own title as the heading", () => {
    // The clinic's real titles read "FACE HAIR REDUCTION - All ages - All
    // genders": a filing label, not something to hand to a patient. The two
    // must differ here or this proves nothing.
    const html = patientHandoutHtml(
      article({ title: "FACE HAIR REDUCTION - All ages - All genders" }),
      { serviceName: "Laser hair reduction" },
    );
    expect(html).toContain("<h1>Laser hair reduction</h1>");
    expect(html).not.toContain("All ages - All genders");
  });

  it("falls back to the article title when no service name is given", () => {
    const html = patientHandoutHtml(article({ title: "Laser hair reduction" }));
    expect(html).toContain("<h1>Laser hair reduction</h1>");
  });

  it("leaves out a section nobody filled in, rather than printing an empty heading", () => {
    const html = patientHandoutHtml(article({ patient_facts: { sessions: "6 sessions" } }));
    expect(html).not.toContain("Please do");
    expect(html).not.toContain("What happens, and when");
    expect(html).toContain("6 sessions");
  });
});

describe("nothing unreviewed reaches a patient's hand", () => {
  it("refuses a draft", () => {
    expect(() => patientHandoutHtml(article({ status: "draft" }))).toThrow(UNPUBLISHED_HANDOUT_ERROR);
  });

  it("refuses an article that is published but deactivated", () => {
    expect(() => patientHandoutHtml(article({ is_active: false }))).toThrow(UNPUBLISHED_HANDOUT_ERROR);
  });

  it("refuses an article with nothing written for the patient", () => {
    expect(() => patientHandoutHtml(article({ patient_summary: "", patient_facts: {} })))
      .toThrow(UNPUBLISHED_HANDOUT_ERROR);
  });
});

describe("escaping", () => {
  it("escapes a title containing markup, in both places it appears", () => {
    const html = patientHandoutHtml(article({ title: `<script>alert(1)</script>` }));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes the summary and every list item", () => {
    const html = patientHandoutHtml(article({
      patient_summary: `5 > 3 & "quoted"`,
      patient_facts: { dos: ["<b>bold</b>"], sessions: `<i>six</i>` },
    }));
    expect(html).toContain("5 &gt; 3 &amp; &quot;quoted&quot;");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;six&lt;/i&gt;");
    expect(html).not.toContain("<b>bold</b>");
  });

  it("escapes a timeline step", () => {
    const html = patientHandoutHtml(article({
      patient_facts: { timeline: [{ when: "<em>Before</em>", what: "<img src=x>" }] },
    }));
    expect(html).toContain("&lt;em&gt;Before&lt;/em&gt;");
    expect(html).not.toContain("<img src=x>");
  });

  it("keeps a single newline inside a paragraph as a line break, still escaped", () => {
    const html = patientHandoutHtml(article({ patient_summary: "One line\n<b>next</b>" }));
    expect(html).toContain("One line<br>&lt;b&gt;next&lt;/b&gt;");
  });
});
