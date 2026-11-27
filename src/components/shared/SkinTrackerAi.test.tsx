import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SkinTracker } from "./SkinTracker";

/**
 * What the AI button is allowed to put on screen.
 *
 * The clinic's photos are not a matched set: photo_type is 'before' on all
 * 91,530 of them and a patient averages fifteen, so two photos picked out of
 * the strip are frequently different areas or different views. An automatic
 * run over eleven patients had the model refuse eighteen pairs out of
 * twenty-one, every refusal correct on inspection.
 *
 * So the rule here is narrow and absolute: a percentage appears only when the
 * model has vouched for the pair, and otherwise the clinician is told why not.
 * The dialog used to render whatever arrived - a reply of 160 printed "160%"
 * with the progress bar run off its end - and it trusted the payload rather
 * than checking it.
 */

const invoke = vi.fn();
const saveAiRecord = vi.fn().mockResolvedValue(undefined);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/aiRepository", () => ({
  saveAiRecord: (...a: unknown[]) => saveAiRecord(...a),
}));

const photos = [
  { id: "p1", photo_url: "https://example.test/before.jpg", photo_type: "before", taken_at: "2026-01-05T10:00:00Z" },
  { id: "p2", photo_url: "https://example.test/after.jpg", photo_type: "after", taken_at: "2026-06-05T10:00:00Z" },
  { id: "p3", photo_url: "https://example.test/third.jpg", photo_type: "before", taken_at: "2026-09-05T10:00:00Z" },
];

const SCORED = {
  comparable: true,
  overallImprovement: 42,
  summary: "Texture is smoother.",
  metrics: [{ name: "Texture", before: 4, after: 7, change: "improved" }],
  details: "A paragraph.",
  recommendations: ["Keep going"],
};

function openWithPair() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SkinTracker open onOpenChange={() => {}} photos={photos} patientName="Test Patient" patientId="pat-1" />
    </QueryClientProvider>,
  );
  const pick = (src: string) => {
    const img = document.body.querySelector(`img[src*="${src}"]`);
    if (!img) throw new Error(`no thumbnail for ${src}`);
    fireEvent.click(img);
  };
  fireEvent.click(screen.getAllByText("Select Photo")[0]);
  pick("before");
  fireEvent.click(screen.getByText("Select Photo"));
  pick("after");
  return pick;
}

const analyse = () => fireEvent.click(screen.getByRole("button", { name: /ai analysis/i }));
const percentages = () =>
  Array.from(document.body.querySelectorAll("*"))
    .map((e) => (e.children.length === 0 ? e.textContent ?? "" : ""))
    .filter((t) => /^\d+(\.\d+)?%$/.test(t.trim()));

beforeEach(() => {
  vi.clearAllMocks();
  saveAiRecord.mockResolvedValue(undefined);
});

describe("when the AI will not vouch for the pair", () => {
  it("shows the reason instead of a figure", async () => {
    invoke.mockResolvedValue({
      data: {
        error: "The first photo shows a face, the second a forearm.",
        comparable: false,
        reason: "The first photo shows a face, the second a forearm.",
      },
      error: null,
    });
    openWithPair();
    analyse();

    await screen.findByText(/cannot be compared/i);
    expect(screen.getByText(/the first photo shows a face/i)).toBeTruthy();
    // The whole point: no number at all, not a zero.
    expect(percentages()).toHaveLength(0);
  });

  it("writes nothing to the AI repository", async () => {
    invoke.mockResolvedValue({
      data: { error: "Different body areas.", comparable: false, reason: "Different body areas." },
      error: null,
    });
    openWithPair();
    analyse();

    await screen.findByText(/cannot be compared/i);
    // A refusal is not a clinical finding and does not belong in the record.
    expect(saveAiRecord).not.toHaveBeenCalled();
  });

  it("refuses a reply that gives a score without vouching for the pair", async () => {
    // Silence is not consent. This is the shape the ungated function returns,
    // so an old deployment cannot sneak a score past the new dialog.
    invoke.mockResolvedValue({ data: { overallImprovement: 55, summary: "x", metrics: [] }, error: null });
    openWithPair();
    analyse();

    await screen.findByText(/cannot be compared/i);
    expect(percentages()).toHaveLength(0);
    expect(saveAiRecord).not.toHaveBeenCalled();
  });

  it("refuses a score off the 0-100 scale rather than printing it", async () => {
    invoke.mockResolvedValue({ data: { ...SCORED, overallImprovement: 160 }, error: null });
    openWithPair();
    analyse();

    await screen.findByText(/cannot be compared/i);
    expect(document.body.textContent).not.toContain("160%");
    expect(saveAiRecord).not.toHaveBeenCalled();
  });
});

describe("when the AI does vouch for the pair", () => {
  it("shows the figure and keeps it in the record", async () => {
    invoke.mockResolvedValue({ data: SCORED, error: null });
    openWithPair();
    analyse();

    await screen.findByText("42%");
    expect(screen.getByText("Texture is smoother.")).toBeTruthy();
    expect(screen.queryByText(/cannot be compared/i)).toBeNull();
    await waitFor(() => expect(saveAiRecord).toHaveBeenCalledTimes(1));
  });

  it("keeps the two ends of the scale", async () => {
    invoke.mockResolvedValue({ data: { ...SCORED, overallImprovement: 0 }, error: null });
    openWithPair();
    analyse();

    // 0% is a real answer - no change - and must not be mistaken for refusal.
    await screen.findByText("0%");
    expect(screen.queryByText(/cannot be compared/i)).toBeNull();
  });
});

describe("choosing different photos", () => {
  it("clears the last refusal, so it cannot sit under the wrong pair", async () => {
    // The picker already cleared a SCORE when a new photo was chosen
    // (SkinTracker.tsx, in the thumbnail handler). It did not clear a refusal,
    // because until now there were none - so "these two photos cannot be
    // compared" would have stayed on screen under a pair it was never about.
    invoke.mockResolvedValue({
      data: { error: "Different body areas.", comparable: false, reason: "Different body areas." },
      error: null,
    });
    const pick = openWithPair();
    analyse();
    await screen.findByText(/cannot be compared/i);

    fireEvent.click(screen.getByLabelText("Clear photo 2"));
    fireEvent.click(screen.getByText("Select Photo"));
    pick("third");

    await waitFor(() => expect(screen.queryByText(/cannot be compared/i)).toBeNull());
    expect(screen.queryByText("Different body areas.")).toBeNull();
  });

  it("clears the last score too", async () => {
    invoke.mockResolvedValue({ data: SCORED, error: null });
    const pick = openWithPair();
    analyse();
    await screen.findByText("42%");

    fireEvent.click(screen.getByLabelText("Clear photo 2"));
    fireEvent.click(screen.getByText("Select Photo"));
    pick("third");

    await waitFor(() => expect(screen.queryByText("42%")).toBeNull());
  });
});
