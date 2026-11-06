import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FOLLOWUP_KINDS, followupSendState, isFollowupMessage } from "./followupSend";
import { isSendableName } from "./patientName";
import {
  FOLLOWUP_BODIES,
  FOLLOWUP_TEMPLATES,
  followupText,
} from "../../supabase/functions/send-followup-whatsapp/template";
import { isSendableName as serverIsSendableName } from "../../supabase/functions/_shared/patient-greeting";

/**
 * The browser half of the two follow-up buttons: which patients they refuse,
 * and how a sent follow-up is recognised when it is read back.
 */

const OK = { first_name: "Sheren", last_name: "" };

describe("whether a follow-up can be sent", () => {
  it("allows an ordinary patient with a number", () => {
    expect(followupSendState("9606342269", OK)).toEqual({ enabled: true, reason: "" });
  });

  it("refuses a patient with no number, and says so", () => {
    const state = followupSendState("", OK);
    expect(state.enabled).toBe(false);
    expect(state.reason).toContain("no phone number");
    // Whitespace is not a phone number.
    expect(followupSendState("   ", OK).enabled).toBe(false);
    expect(followupSendState(null, OK).enabled).toBe(false);
  });

  it("refuses a patient whose name is really a phone number", () => {
    // 153 such records. "Hello Ms. 9663438657," must not be sendable.
    const state = followupSendState("9663438657", { first_name: "9663438657", last_name: "" });
    expect(state.enabled).toBe(false);
    // The reason quotes what is stored, so the receptionist can see the record
    // is wrong rather than assume the button is broken.
    expect(state.reason).toContain("9663438657");
  });

  it("refuses a single-letter name, exactly as the server does", () => {
    // 8 such records. This is the case that caught me out: hasRealName
    // accepts "A" - truthful enough for a list label - while the server
    // refuses it, so using hasRealName here enabled a button that then failed
    // with a 400 and no explanation.
    expect(followupSendState("9606342269", { first_name: "A", last_name: "" }).enabled).toBe(false);
    expect(serverIsSendableName("A")).toBe(false);
  });

  it("refuses a patient with no name at all", () => {
    expect(followupSendState("9606342269", { first_name: "", last_name: "" }).enabled).toBe(false);
    expect(followupSendState("9606342269", null).reason).toContain("no name");
  });

  it("allows a name carrying a digit, which is still a name", () => {
    expect(followupSendState("9606342269", { first_name: "Dr K2", last_name: "" }).enabled).toBe(true);
  });
});

describe("the browser rule and the server rule are the same rule", () => {
  // They are restated rather than shared, because Deno cannot import from the
  // browser bundle. So they are held against each other here: a button that is
  // enabled for a patient the server then refuses is worse than no button.
  const cases = [
    "Sheren",
    "A",
    "",
    " ",
    "9663438657",
    "+91 96634 38657",
    "(0824) 2441234",
    "Dr. Krithi",
    "Dr K2",
    "Jo",
    "123A",
    "-",
  ];
  for (const name of cases) {
    it(`agrees on ${JSON.stringify(name)}`, () => {
      expect(isSendableName(name)).toBe(serverIsSendableName(name));
    });
  }
});

describe("recognising a follow-up that has already been sent", () => {
  it("recognises the words the patient actually received", () => {
    for (const { kind } of FOLLOWUP_KINDS) {
      expect(isFollowupMessage(kind, followupText(kind, "Ms. Sheren"))).toBe(true);
    }
  });

  it("recognises the sender's fallback line, which is the COMMON case", () => {
    // Twilio returns no body for a template send, so send-followup-whatsapp
    // records its own text instead. If this stopped matching, the button would
    // offer "Send" again to a patient who was messaged a minute ago.
    for (const { kind } of FOLLOWUP_KINDS) {
      const fallback = `${FOLLOWUP_TEMPLATES[kind].label} sent using the approved clinic template.`;
      expect(isFollowupMessage(kind, fallback), `${kind} fallback unrecognised`).toBe(true);
    }
  });

  it("does not mistake one follow-up for the other", () => {
    expect(isFollowupMessage("24h", followupText("1week", "Ms. Sheren"))).toBe(false);
    expect(isFollowupMessage("1week", followupText("24h", "Ms. Sheren"))).toBe(false);
    const f24 = `${FOLLOWUP_TEMPLATES["24h"].label} sent using the approved clinic template.`;
    const f1w = `${FOLLOWUP_TEMPLATES["1week"].label} sent using the approved clinic template.`;
    expect(isFollowupMessage("1week", f24)).toBe(false);
    expect(isFollowupMessage("24h", f1w)).toBe(false);
  });

  it("claims nothing from an unrelated message", () => {
    expect(isFollowupMessage("24h", "Your appointment is confirmed for 9 Nov.")).toBe(false);
    expect(isFollowupMessage("1week", "")).toBe(false);
    expect(isFollowupMessage("1week", null)).toBe(false);
  });

  it("the words it matches on are words the approved bodies contain", () => {
    expect(FOLLOWUP_BODIES["24h"]).toContain("follow-up regarding your treatment");
    expect(FOLLOWUP_BODIES["1week"]).toContain("one week follow up");
  });
});

describe("the buttons are wired the way they are meant to be", () => {
  const button = () => readFileSync("src/components/appointments/FollowupButtons.tsx", "utf8");
  const sheet = () => readFileSync("src/components/appointments/AppointmentDetailSheet.tsx", "utf8");

  it("reads whatsapp_conversations, not the delivery log", () => {
    // whatsapp_delivery_log is filled in by the webhook afterwards and is still
    // empty for a second press forty seconds later. That gap once sent a
    // patient the same message twice.
    const src = button();
    expect(src).toContain('.from("whatsapp_conversations")');
    expect(src).not.toContain('.from("whatsapp_delivery_log")');
  });

  it("sends through the follow-up function and nothing else", () => {
    expect(button()).toContain('supabase.functions.invoke("send-followup-whatsapp"');
  });

  it("decides enabled/disabled in followupSendState rather than inline", () => {
    const src = button();
    expect(src).toContain("followupSendState(patientPhone, patient)");
    // The reason is shown, not swallowed: a greyed-out button with no
    // explanation is the thing being avoided.
    expect(src).toContain("state.reason");
  });

  it("confirms before sending, naming the patient and the number", () => {
    const src = button();
    expect(src).toMatch(/window\.confirm\([^)]*patientName/);
    expect(src).toMatch(/window\.confirm\([^)]*patientPhone/);
  });

  it("is rendered on the appointment detail screen, with the patient to check", () => {
    const src = sheet();
    expect(src).toContain('import { FollowupButtons } from "@/components/appointments/FollowupButtons"');
    // On its own line, i.e. rendered unconditionally. A plain toContain check
    // passes just as happily on `{false && <FollowupButtons` - which is
    // precisely how the buttons would disappear without a test noticing.
    expect(src).toMatch(/^\s*<FollowupButtons$/m);
    // Without patient= the guard above has nothing to read and every button is
    // enabled, including for the 153 phone-named records.
    expect(src).toMatch(/<FollowupButtons[\s\S]{0,400}?patient=\{appointment\.patients\}/);
  });

  it("offers exactly the two follow-ups the clinic asked for", () => {
    expect(FOLLOWUP_KINDS.map((k) => k.kind)).toEqual(["24h", "1week"]);
    expect(Object.keys(FOLLOWUP_BODIES).sort()).toEqual(["1week", "24h"]);
  });
});
