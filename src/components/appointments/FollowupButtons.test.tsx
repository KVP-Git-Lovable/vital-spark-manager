import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { FollowupButtons } from "./FollowupButtons";

/**
 * The two buttons, in a DOM.
 *
 * The source-level checks in src/lib/followupSend.test.ts prove the wiring;
 * this proves the behaviour a receptionist meets - above all that a patient
 * whose record cannot carry a message gets a greyed-out button WITH a reason,
 * rather than one that looks fine and then fails.
 */

const invoke = vi.fn();
const rows: { content: string; created_at: string }[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) chain[m] = () => chain;
    chain.limit = () => Promise.resolve({ data: rows, error: null });
    return chain;
  };
  return {
    supabase: {
      from: () => builder(),
      functions: { invoke: (...a: unknown[]) => invoke(...a) },
    },
  };
});

// vi.mock is hoisted above every top-level const, so the spies have to be
// created inside the factory and read back through vi.mocked afterwards.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const props = {
  patientId: "11111111-1111-1111-1111-111111111111",
  appointmentId: "22222222-2222-2222-2222-222222222222",
  patientName: "Sheren",
  patientPhone: "9606342269",
  patient: { first_name: "Sheren", last_name: "" },
};

beforeEach(() => {
  rows.length = 0;
  invoke.mockReset();
  invoke.mockResolvedValue({ error: null });
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("FollowupButtons", () => {
  it("offers both follow-ups, enabled, for an ordinary patient", async () => {
    wrap(<FollowupButtons {...props} />);
    const a = await screen.findByTestId("send-followup-24h");
    const b = screen.getByTestId("send-followup-1week");
    expect(a).not.toBeDisabled();
    expect(b).not.toBeDisabled();
    expect(a).toHaveTextContent("24h follow-up");
    expect(b).toHaveTextContent("1 week follow-up");
  });

  it("sends the kind that was pressed, for this patient and appointment", async () => {
    wrap(<FollowupButtons {...props} />);
    fireEvent.click(await screen.findByTestId("send-followup-1week"));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke).toHaveBeenCalledWith("send-followup-whatsapp", {
      body: { patient_id: props.patientId, appointment_id: props.appointmentId, kind: "1week" },
    });
  });

  it("sends nothing when the confirm is dismissed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    wrap(<FollowupButtons {...props} />);
    fireEvent.click(await screen.findByTestId("send-followup-24h"));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("greys both out AND says why when the name is a phone number", async () => {
    // The whole point of the guard: 153 such records exist, and a disabled
    // button with no explanation is read as the app being broken.
    wrap(<FollowupButtons {...props} patient={{ first_name: "9663438657", last_name: "" }} />);
    expect(await screen.findByTestId("send-followup-24h")).toBeDisabled();
    expect(screen.getByTestId("send-followup-1week")).toBeDisabled();
    expect(screen.getByText(/9663438657/)).toBeInTheDocument();
  });

  it("greys both out when there is no number to send to", async () => {
    wrap(<FollowupButtons {...props} patientPhone="" />);
    expect(await screen.findByTestId("send-followup-24h")).toBeDisabled();
    expect(screen.getByText(/no phone number/i)).toBeInTheDocument();
  });

  it("shows when a follow-up already went out, and offers to resend", async () => {
    rows.push({
      content: "1-week follow-up sent using the approved clinic template.",
      created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });
    wrap(<FollowupButtons {...props} />);
    expect(await screen.findByTestId("followup-sent-1week")).toHaveTextContent("2 days ago");
    expect(screen.getByTestId("send-followup-1week")).toHaveTextContent("Resend");
    // The other one has not been sent, so it must not claim it has.
    expect(screen.queryByTestId("followup-sent-24h")).toBeNull();
    expect(screen.getByTestId("send-followup-24h")).not.toHaveTextContent("Resend");
  });

  it("reports a failed send instead of claiming success", async () => {
    invoke.mockResolvedValue({ error: new Error("Twilio said no") });
    wrap(<FollowupButtons {...props} />);
    fireEvent.click(await screen.findByTestId("send-followup-24h"));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("renders nothing at all without a patient id", () => {
    const { container } = wrap(<FollowupButtons {...props} patientId={undefined} />);
    expect(container.textContent).toBe("");
  });
});
