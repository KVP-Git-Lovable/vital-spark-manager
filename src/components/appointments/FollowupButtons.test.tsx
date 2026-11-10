import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FollowupButtons } from "./FollowupButtons";
import { followupMessage } from "@/lib/followupSend";

/**
 * The two follow-up buttons in a DOM.
 *
 * What matters here is the tab: it must be a real top-level window.open with
 * the message already in the URL, and nothing may stand between the click and
 * that call. The reasoning is in the component; this is what holds it.
 */

const inserted: Record<string, unknown>[] = [];
let conversations: { content: string; created_at: string }[] = [];
let opens: { kind: string; opened_at: string }[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const chainOn = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) chain[m] = () => chain;
    chain.limit = () => Promise.resolve({ data: rows, error: null });
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => ({
        ...chainOn(table === "followup_opens" ? opens : conversations),
        insert: (row: Record<string, unknown>) => {
          inserted.push({ table, ...row });
          return Promise.resolve({ error: null });
        },
      }),
      auth: { getUser: async () => ({ data: { user: { id: "staff-1" } } }) },
    },
  };
});

vi.mock("sonner", () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );

const props = {
  patientId: "11111111-1111-1111-1111-111111111111",
  appointmentId: "22222222-2222-2222-2222-222222222222",
  patientPhone: "9606342269",
  patient: { first_name: "Surekha", last_name: "", gender: "Female" },
};

let openSpy: ReturnType<typeof vi.fn>;
const fakeWindow = () => ({ opener: {} as unknown }) as Window;

beforeEach(() => {
  inserted.length = 0;
  conversations = [];
  opens = [];
  openSpy = vi.fn(() => fakeWindow());
  vi.stubGlobal("open", openSpy);
  vi.spyOn(window, "confirm");
});

describe("opening WhatsApp", () => {
  it("opens a tab with the patient's number and the message ready", async () => {
    wrap(<FollowupButtons {...props} />);
    fireEvent.click(await screen.findByTestId("send-followup-24h"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(String(url).startsWith("https://web.whatsapp.com/send?")).toBe(true);
    expect(target).toBe("_blank");
    // A features string at all would risk "noopener" creeping back in, which
    // makes window.open return null even on success.
    expect(features).toBeUndefined();

    const parsed = new URL(String(url));
    expect(parsed.searchParams.get("phone")).toBe("919606342269");
    expect(parsed.searchParams.get("text")).toBe(followupMessage("24h", props.patient));
  });

  it("sends each button's own message", async () => {
    wrap(<FollowupButtons {...props} />);
    fireEvent.click(await screen.findByTestId("send-followup-1week"));
    const text = new URL(String(openSpy.mock.calls[0][0])).searchParams.get("text");
    expect(text).toContain("one week follow up");
    expect(text).not.toContain("quick follow-up regarding your treatment");
  });

  it("never asks a browser dialog before opening", async () => {
    // Chrome ignores a dialog asked for by a background tab, which is how this
    // pattern once opened a tab and instantly closed it again.
    wrap(<FollowupButtons {...props} />);
    fireEvent.click(await screen.findByTestId("send-followup-24h"));
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("disowns the tab it opened", async () => {
    const win = fakeWindow();
    openSpy.mockReturnValue(win);
    wrap(<FollowupButtons {...props} />);
    fireEvent.click(await screen.findByTestId("send-followup-24h"));
    expect(win.opener).toBeNull();
  });

  it("records the open, with the kind, against this patient and visit", async () => {
    wrap(<FollowupButtons {...props} />);
    fireEvent.click(await screen.findByTestId("send-followup-1week"));
    await waitFor(() => expect(inserted.length).toBe(1));
    expect(inserted[0]).toMatchObject({
      table: "followup_opens",
      patient_id: props.patientId,
      appointment_id: props.appointmentId,
      kind: "1week",
      opened_by: "staff-1",
    });
  });
});

describe("when the browser blocks the tab", () => {
  it("offers the message to copy instead, and records nothing", async () => {
    const { toast } = await import("sonner");
    openSpy.mockReturnValue(null);
    wrap(<FollowupButtons {...props} />);
    fireEvent.click(await screen.findByTestId("send-followup-24h"));

    await waitFor(() => expect(toast.message).toHaveBeenCalled());
    expect(vi.mocked(toast.message).mock.calls[0][0]).toContain("blocked");
    // Nothing was put in front of the patient, so nothing is recorded.
    expect(inserted).toHaveLength(0);
  });
});

describe("a patient who has already been contacted", () => {
  it("asks first, and opens nothing until that is confirmed", async () => {
    opens = [{ kind: "24h", opened_at: new Date(Date.now() - 3600_000).toISOString() }];
    wrap(<FollowupButtons {...props} />);
    await screen.findByTestId("followup-sent-24h");

    fireEvent.click(screen.getByTestId("send-followup-24h"));
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByTestId("confirm-followup-again"));
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
  });

  it("notices the one follow-up that really was sent through the old sender", async () => {
    // Ms. Surekha, 10 Nov 2026. A send is a stronger claim than an open, and
    // the wording has to say so.
    conversations = [
      {
        content: "Hello Ms. Surekha,\nThis is a quick follow-up regarding your treatment done.",
        created_at: new Date(Date.now() - 7200_000).toISOString(),
      },
    ];
    wrap(<FollowupButtons {...props} />);
    const line = await screen.findByTestId("followup-sent-24h");
    expect(line.textContent).toContain("Already sent");
    // The other button is untouched by it.
    expect(screen.queryByTestId("followup-sent-1week")).toBeNull();
  });

  it("offers to send again rather than pretending it is the first time", async () => {
    opens = [{ kind: "1week", opened_at: new Date(Date.now() - 3600_000).toISOString() }];
    wrap(<FollowupButtons {...props} />);
    await waitFor(() =>
      expect(screen.getByTestId("send-followup-1week").textContent).toContain("again"),
    );
    expect(screen.getByTestId("send-followup-24h").textContent).not.toContain("again");
  });
});

describe("patients the buttons cannot work for", () => {
  it("greys both out, with the reason, when there is no usable number", async () => {
    wrap(<FollowupButtons {...props} patientPhone="" />);
    expect(await screen.findByTestId("send-followup-24h")).toBeDisabled();
    expect(screen.getByTestId("send-followup-1week")).toBeDisabled();
    expect(screen.getByText(/no usable phone number/i)).toBeInTheDocument();
  });

  it("STILL works when the name is a phone number, falling back to 'Hello,'", async () => {
    // 161 such patients. These used to be refused outright; the message simply
    // loses the name now.
    wrap(<FollowupButtons {...props} patient={{ first_name: "9663438657", last_name: "" }} />);
    const button = await screen.findByTestId("send-followup-24h");
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    const text = new URL(String(openSpy.mock.calls[0][0])).searchParams.get("text") ?? "";
    expect(text.startsWith("Hello,\n")).toBe(true);
    expect(text).not.toContain("9663438657");
  });

  it("renders nothing at all without a patient id", () => {
    const { container } = wrap(<FollowupButtons {...props} patientId={undefined} />);
    expect(container.textContent).toBe("");
  });
});
