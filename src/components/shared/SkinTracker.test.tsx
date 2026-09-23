import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkinTracker } from "./SkinTracker";

/**
 * Zoom and tilt on the before/after comparison.
 *
 * The rule these guard: zoom moves BOTH photos and tilt moves ONE. A doctor
 * reads these two images as the same piece of skin at two dates, so zooming
 * one alone would put two different crops next to each other and invite the
 * wrong conclusion - while tilt has to be per photo, because straightening one
 * against the other is the whole reason it exists.
 */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const photos = [
  { id: "p1", photo_url: "https://example.test/before.jpg", photo_type: "before", taken_at: "2026-01-05T10:00:00Z" },
  { id: "p2", photo_url: "https://example.test/after.jpg", photo_type: "after", taken_at: "2026-06-05T10:00:00Z" },
];

/**
 * Opens the tracker with both photos chosen, which is when the controls appear.
 * The picker thumbnails carry alt="", so they are not exposed as images to a
 * screen reader and have to be found by src.
 */
function renderCompared() {
  render(<SkinTracker open onOpenChange={() => {}} photos={photos} patientName="Test Patient" />);
  const pick = (src: string) => {
    const img = document.body.querySelector(`img[src*="${src}"]`);
    if (!img) throw new Error(`no thumbnail for ${src}`);
    fireEvent.click(img);
  };
  fireEvent.click(screen.getAllByText("Select Photo")[0]);
  pick("before");
  fireEvent.click(screen.getByText("Select Photo"));
  pick("after");
}

/** The transforms actually applied to every rendered copy of one photo. */
const transforms = (src: string) =>
  Array.from(document.body.querySelectorAll<HTMLElement>(`img[src*="${src}"]`))
    .map((i) => i.style.transform)
    .filter(Boolean);

beforeEach(() => vi.clearAllMocks());

describe("zoom", () => {
  it("starts at 1x with zoom out unavailable", () => {
    renderCompared();
    expect(screen.getByText("1.0×")).toBeTruthy();
    expect(screen.getByLabelText("Zoom out").hasAttribute("disabled")).toBe(true);
  });

  it("moves both photos together, never one alone", () => {
    renderCompared();
    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("1.3×")).toBeTruthy();
    // Every rendered comparison image carries the same scale.
    const all = [...transforms("before"), ...transforms("after")];
    expect(all.length).toBeGreaterThan(0);
    for (const t of all) expect(t).toContain("scale(1.25)");
  });

  it("stops at the ends rather than running away", () => {
    renderCompared();
    for (let i = 0; i < 40; i++) fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("6.0×")).toBeTruthy();
    expect(screen.getByLabelText("Zoom in").hasAttribute("disabled")).toBe(true);
  });
});

describe("tilt", () => {
  it("turns one photo without touching the other", () => {
    renderCompared();
    fireEvent.click(screen.getByLabelText("Tilt photo 1 right"));
    for (const t of transforms("before")) expect(t).toContain("rotate(1deg)");
    for (const t of transforms("after")) expect(t).toContain("rotate(0deg)");
  });

  it("turns both ways", () => {
    renderCompared();
    fireEvent.click(screen.getByLabelText("Tilt photo 2 left"));
    fireEvent.click(screen.getByLabelText("Tilt photo 2 left"));
    for (const t of transforms("after")) expect(t).toContain("rotate(-2deg)");
  });
});

describe("reset view", () => {
  it("is offered only once something has been changed, and undoes all of it", () => {
    renderCompared();
    const resetButton = () => screen.getByRole("button", { name: /reset view/i });
    expect(resetButton().hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByLabelText("Zoom in"));
    fireEvent.click(screen.getByLabelText("Tilt photo 1 right"));
    expect(resetButton().hasAttribute("disabled")).toBe(false);

    fireEvent.click(resetButton());
    expect(screen.getByText("1.0×")).toBeTruthy();
    for (const t of [...transforms("before"), ...transforms("after")]) {
      expect(t).toContain("scale(1)");
      expect(t).toContain("rotate(0deg)");
    }
  });
});

describe("side by side", () => {
  it("carries the same zoom and tilt as the slider", () => {
    renderCompared();
    fireEvent.click(screen.getByLabelText("Zoom in"));
    fireEvent.click(screen.getByLabelText("Tilt photo 1 right"));
    fireEvent.click(screen.getByRole("tab", { name: /side by side/i }));

    // Whichever layout is showing, the same view settings apply - switching
    // between them must not quietly reset or double-apply anything.
    for (const t of transforms("before")) {
      expect(t).toContain("scale(1.25)");
      expect(t).toContain("rotate(1deg)");
    }
    for (const t of transforms("after")) expect(t).toContain("rotate(0deg)");
  });
});
