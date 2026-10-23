import { describe, it, expect } from "vitest";
import { GOOGLE_REVIEW_LINK, GOOGLE_REVIEW_MESSAGE, reviewRequestState, whatsappShareUrl } from "./googleReview";

describe("GOOGLE_REVIEW_MESSAGE", () => {
  /**
   * The clinic wrote this and it is also the body of the
   * google_review_request template. These assertions exist so that editing one
   * without the other is caught here rather than by a patient receiving the
   * wrong link.
   */
  it("keeps the clinic's review link exactly", () => {
    expect(GOOGLE_REVIEW_MESSAGE).toContain(GOOGLE_REVIEW_LINK);
    expect(GOOGLE_REVIEW_LINK).toBe("https://g.co/kgs/6Zy6nc");
  });

  it("keeps the address and the phone number the clinic gave", () => {
    expect(GOOGLE_REVIEW_MESSAGE).toContain("The Skin Clinic");
    expect(GOOGLE_REVIEW_MESSAGE).toContain("Vyasa Rao Road, Kadri Kambla Rd, Mangalore, Karnataka 575002");
    expect(GOOGLE_REVIEW_MESSAGE).toContain("063607 53030");
  });

  it("opens the way they wrote it", () => {
    expect(GOOGLE_REVIEW_MESSAGE.startsWith("It has been a great pleasure serving you")).toBe(true);
  });

  it("carries no placeholder anybody has to fill in", () => {
    // A body with no variables is also the easiest kind for Meta to approve.
    expect(GOOGLE_REVIEW_MESSAGE).not.toMatch(/\{\{.*?\}\}/);
  });
});

describe("whatsappShareUrl", () => {
  it("opens a chat with a ten-digit mobile, country code added", () => {
    // 9606342269 is how the clinic's numbers are stored.
    expect(whatsappShareUrl("9606342269")).toContain("https://wa.me/919606342269?text=");
  });

  it("does not add the country code twice", () => {
    expect(whatsappShareUrl("919606342269")).toContain("wa.me/919606342269?");
    expect(whatsappShareUrl("+91 96063 42269")).toContain("wa.me/919606342269?");
  });

  it("survives the punctuation numbers get typed with", () => {
    expect(whatsappShareUrl("096063-42269")).toContain("wa.me/919606342269?");
    expect(whatsappShareUrl("(96063) 42269")).toContain("wa.me/919606342269?");
  });

  it("escapes the message so the link and the line breaks arrive intact", () => {
    const url = whatsappShareUrl("9606342269") ?? "";
    expect(url).toContain(encodeURIComponent(GOOGLE_REVIEW_LINK));
    // Newlines must be escaped, not left raw in a URL.
    expect(url).not.toContain("\n");
    expect(url).toContain("%0A");
    // And the whole thing must decode back to exactly what was written.
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(GOOGLE_REVIEW_MESSAGE);
  });

  it("carries a message of its own when given one", () => {
    const url = whatsappShareUrl("9606342269", "Hello there") ?? "";
    expect(url).toContain("text=Hello%20there");
  });

  it("has nowhere to send a patient with no usable number", () => {
    // The button is disabled on this, rather than opening WhatsApp on nothing.
    expect(whatsappShareUrl("")).toBeNull();
    expect(whatsappShareUrl(null)).toBeNull();
    expect(whatsappShareUrl(undefined)).toBeNull();
    expect(whatsappShareUrl("12345")).toBeNull();
    expect(whatsappShareUrl("not a phone")).toBeNull();
  });
});

describe("reviewRequestState", () => {
  it("is ready to send when the patient has a number", () => {
    const state = reviewRequestState("9606342269");
    expect(state.enabled).toBe(true);
    expect(state.url).toContain("wa.me/919606342269");
    expect(state.reason).toBe("");
  });

  it("is disabled, with a reason, when there is nowhere to send it", () => {
    for (const bad of ["", null, undefined, "12345", "not a phone"]) {
      const state = reviewRequestState(bad as string | null | undefined);
      expect(state.enabled).toBe(false);
      expect(state.url).toBeNull();
      // The reason is shown on screen, so it has to actually say something.
      expect(state.reason.length).toBeGreaterThan(0);
    }
  });
});
