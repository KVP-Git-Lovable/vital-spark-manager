import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openWhatsApp } from "./whatsappOpen";
import { isEmbedded } from "./embeddedPreview";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }));

/**
 * Opening WhatsApp for a staff member.
 *
 * The return value is the whole point: the callers write "this patient has
 * been contacted" on it. Two such rows were written on 10 Nov for clicks that
 * showed a blocked page, which is the failure these hold shut.
 */

const URL_ = "https://web.whatsapp.com/send?phone=919606342269&text=Hello";
const MESSAGE = "Hello Ms. Surekha,\nThis is a quick follow-up";

/**
 * Pretend this window is inside a frame.
 *
 * Only `top` is redefined. Replacing the whole `window` object breaks React and
 * jsdom - "Right-hand side of 'instanceof' is not an object" - and leaks into
 * every test that follows.
 */
function framed() {
  Object.defineProperty(window, "top", { value: { notUs: true }, configurable: true });
}
function unframed() {
  Object.defineProperty(window, "top", { value: window, configurable: true });
}

let openSpy: ReturnType<typeof vi.fn>;
const fakeWindow = () => ({ opener: {} as unknown }) as Window;

beforeEach(() => {
  openSpy = vi.fn(() => fakeWindow());
  vi.stubGlobal("open", openSpy);
  vi.mocked(toast.message).mockReset();
  vi.spyOn(window, "confirm");
});

afterEach(() => {
  unframed();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isEmbedded", () => {
  it("is false for a window that is its own top", () => {
    const w = {} as { self: unknown; top: unknown };
    w.self = w;
    w.top = w;
    expect(isEmbedded(w)).toBe(false);
  });

  it("is true inside a frame", () => {
    expect(isEmbedded({ self: { a: 1 }, top: { b: 2 } })).toBe(true);
  });

  it("treats a window.top that throws as embedded", () => {
    // A throw means we are certainly inside something. Swallowing it to
    // "not embedded" would open the doomed tab after all.
    const hostile = {
      self: {},
      get top(): unknown {
        throw new Error("cross-origin");
      },
    };
    expect(isEmbedded(hostile)).toBe(true);
  });
});

describe("in a normal tab", () => {
  beforeEach(() => {
    // jsdom's window is its own top, so this is the unframed case already.
    expect(isEmbedded()).toBe(false);
  });

  it("opens the URL it was given and says a tab opened", () => {
    expect(openWhatsApp(URL_, MESSAGE)).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toBe(URL_);
    expect(target).toBe("_blank");
    // A features string risks "noopener" creeping back, which makes
    // window.open return null even on success.
    expect(features).toBeUndefined();
  });

  it("disowns the tab it opened", () => {
    const win = fakeWindow();
    openSpy.mockReturnValue(win);
    openWhatsApp(URL_, MESSAGE);
    expect(win.opener).toBeNull();
  });

  it("asks no browser dialog on the way", () => {
    openWhatsApp(URL_, MESSAGE);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("says no tab opened when the browser blocks the popup, and offers the copy", () => {
    openSpy.mockReturnValue(null);
    expect(openWhatsApp(URL_, MESSAGE)).toBe(false);
    expect(vi.mocked(toast.message).mock.calls[0][0]).toContain("blocked");
  });
});

describe("inside the Lovable editor's preview frame", () => {
  beforeEach(() => {
    // A popup from a sandboxed frame inherits the sandbox and WhatsApp
    // answers ERR_BLOCKED_BY_RESPONSE.
    framed();
  });

  it("opens nothing at all", () => {
    expect(openWhatsApp(URL_, MESSAGE)).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("says why, and names the way out rather than just 'blocked'", () => {
    openWhatsApp(URL_, MESSAGE);
    const [title, opts] = vi.mocked(toast.message).mock.calls[0] as unknown as [
      string,
      { description: string },
    ];
    expect(title).toContain("preview panel");
    // "Blocked" on its own sends somebody looking for a setting in WhatsApp,
    // which is the one place the problem is not.
    expect(opts.description).toContain("own browser tab");
    expect(opts.description).toContain("Lovable");
  });

  it("still offers the message to copy, so the work is not stuck", () => {
    openWhatsApp(URL_, MESSAGE);
    const [, opts] = vi.mocked(toast.message).mock.calls[0] as unknown as [
      string,
      { action: { label: string } },
    ];
    expect(opts.action.label).toBe("Copy message");
  });
});
