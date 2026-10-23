import { describe, expect, it } from "vitest";
import { reviewTemplateParams } from "../../supabase/functions/send-google-review-whatsapp/template";
import { toE164IN } from "../../supabase/functions/_shared/comms-phone";

describe("Google review template sending", () => {
  it("sends the approved template without variables or free-text substitution", () => {
    const params = reviewTemplateParams("+919606342269", "+911234567890", "configured-template");
    expect(params.get("ContentSid")).toBe("configured-template");
    expect(params.has("ContentVariables")).toBe(false);
    expect(params.has("Body")).toBe(false);
    expect(params.get("To")).toBe("whatsapp:+919606342269");
  });
  it("preserves an already-prefixed clinic sender", () => {
    expect(reviewTemplateParams("+919606342269", "whatsapp:+911234567890", "configured-template").get("From"))
      .toBe("whatsapp:+911234567890");
  });
  it("normalizes the clinic's stored Indian mobile numbers and rejects missing numbers", () => {
    expect(toE164IN("9606342269")).toBe("+919606342269");
    expect(toE164IN(null)).toBeNull();
    expect(toE164IN("not a phone")).toBeNull();
  });
});