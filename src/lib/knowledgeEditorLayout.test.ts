import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The knowledge editor is a full screen, not a side panel.
 *
 * The clinic writes a clinical article in here - five sections, a cover
 * picture, an AI diff and a resource list - and it used to be written in a
 * column pinned to the right edge with the article list still showing beside
 * it. The read page at /knowledge/:id was promoted out of a drawer for the
 * same reason; this is the other half of that.
 *
 * Read from the source because the wrapper is a Radix portal rendered from a
 * component that needs Supabase, a query client and a signed-in user to
 * mount. What is worth holding here is the decision, which is three class
 * strings, and those are exactly what a tidy-up would quietly revert.
 */

const EDITOR = "src/components/knowledge/ArticleEditor.tsx";
const source = readFileSync(EDITOR, "utf8");

/** The one SheetContent line, so an assertion cannot pass on another file's
    classes or on a className further down the form. */
const surface = (): string => {
  const at = source.indexOf("<SheetContent");
  expect(at, "ArticleEditor no longer renders a SheetContent").toBeGreaterThan(-1);
  return source.slice(at, source.indexOf(">", at));
};

describe("the knowledge editor's surface", () => {
  it("covers the screen", () => {
    expect(surface()).toContain("w-screen");
    expect(surface()).toContain("max-w-none");
    expect(surface()).toContain("sm:max-w-none");
  });

  it("is not capped into a side panel", () => {
    // sm:max-w-5xl on the surface is what made it a panel: 1024px hard against
    // the right edge of the screen, list showing to its left.
    expect(surface()).not.toContain("sm:max-w-5xl");
    expect(surface()).not.toContain("sm:max-w-xl");
    expect(surface()).not.toContain("sm:max-w-2xl");
  });

  it("scrolls as one surface, because the form is far longer than a screen", () => {
    expect(surface()).toContain("overflow-y-auto");
  });
});

describe("the form inside it", () => {
  it("keeps its width and sits in the middle", () => {
    // The cap moved off the surface and onto the content: without this the
    // fields stretch the full width of a desktop monitor.
    expect(source).toContain('<SheetHeader className="mx-auto w-full min-w-0 max-w-5xl">');
    expect(source).toContain('<div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 py-5">');
  });

  it("still names itself for a screen reader", () => {
    // Radix requires a title inside the dialog; without it the editor opens
    // with no accessible name and logs a warning.
    expect(source).toContain("<SheetTitle>");
    expect(source).toContain("Edit Knowledge Article");
  });
});
