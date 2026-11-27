import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkinAnalysisResults, SkinNotComparable, type SkinAnalysis } from "./SkinAnalysisResults";

/**
 * The last place a bad number could still reach a doctor's eye.
 *
 * SkinTracker checks the AI's reply before it gets here, so this component
 * should never see an impossible figure. It clamps anyway: it is also rendered
 * from the AI repository, where records written by the older, ungated function
 * are already stored, and an archived "160%" must not print either.
 */

const analysis = (over: Partial<SkinAnalysis> = {}): SkinAnalysis => ({
  overallImprovement: 42,
  summary: "Texture is smoother.",
  metrics: [{ name: "Texture", before: 4, after: 7, change: "improved" }],
  details: "A paragraph.",
  recommendations: ["Keep going"],
  ...over,
});

describe("the improvement figure", () => {
  it("prints a real one as it is", () => {
    render(<SkinAnalysisResults analysis={analysis()} />);
    expect(screen.getByText("42%")).toBeTruthy();
  });

  it("never prints a figure above 100", () => {
    render(<SkinAnalysisResults analysis={analysis({ overallImprovement: 160 })} />);
    expect(document.body.textContent).not.toContain("160%");
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("never prints a negative one", () => {
    render(<SkinAnalysisResults analysis={analysis({ overallImprovement: -20 })} />);
    expect(document.body.textContent).not.toContain("-20%");
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("shows nothing rather than NaN when the figure is unreadable", () => {
    render(<SkinAnalysisResults analysis={analysis({ overallImprovement: Number.NaN })} />);
    expect(document.body.textContent).not.toContain("NaN");
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("keeps both ends of the scale", () => {
    const { unmount } = render(<SkinAnalysisResults analysis={analysis({ overallImprovement: 0 })} />);
    expect(screen.getByText("0%")).toBeTruthy();
    unmount();
    render(<SkinAnalysisResults analysis={analysis({ overallImprovement: 100 })} />);
    expect(screen.getByText("100%")).toBeTruthy();
  });
});

describe("the refusal card", () => {
  it("gives the reason and no figure at all", () => {
    render(<SkinNotComparable reason="One photo is of the face, the other a forearm." />);
    expect(screen.getByText(/cannot be compared/i)).toBeTruthy();
    expect(screen.getByText("One photo is of the face, the other a forearm.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+%/);
  });

  it("says what to do next", () => {
    render(<SkinNotComparable reason="Different areas." />);
    expect(screen.getByText(/same area/i)).toBeTruthy();
  });
});
