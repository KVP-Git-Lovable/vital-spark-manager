import { describe, it, expect } from "vitest";
import { summaryFromThread, type ConversationThread } from "./whatsappThreads";

const thread = (over: Partial<ConversationThread> = {}): ConversationThread => ({
  phone: "+919113984063",
  last_at: "2026-05-01T10:30:00.000Z",
  message_count: 2,
  last_content: "Your appointment is confirmed.",
  last_direction: "outbound",
  patient_id: "11111111-1111-1111-1111-111111111111",
  first_name: "Tanushree",
  last_name: "Rao",
  ...over,
});

describe("summaryFromThread", () => {
  it("draws the conversation from its last message", () => {
    const summary = summaryFromThread(thread());
    expect(summary.phone).toBe("+919113984063");
    expect(summary.content).toBe("Your appointment is confirmed.");
    expect(summary.direction).toBe("outbound");
    expect(summary.created_at).toBe("2026-05-01T10:30:00.000Z");
    expect(summary.patients).toEqual({ first_name: "Tanushree", last_name: "Rao" });
  });

  it("identifies the row by the number, because that is the conversation", () => {
    expect(summaryFromThread(thread()).id).toBe("+919113984063");
  });

  it("carries the view's own count, so no per-row count query is needed", () => {
    expect(summaryFromThread(thread({ message_count: 78 })).messageCount).toBe(78);
    expect(summaryFromThread(thread({ message_count: 1 })).messageCount).toBe(1);
  });

  it("leaves a number the clinic never matched without a patient", () => {
    const summary = summaryFromThread(
      thread({ patient_id: null, first_name: null, last_name: null }),
    );
    expect(summary.patient_id).toBeNull();
    expect(summary.patients).toBeNull();
  });

  it("keeps a half-known name rather than dropping it", () => {
    expect(summaryFromThread(thread({ last_name: null })).patients).toEqual({
      first_name: "Tanushree",
      last_name: null,
    });
  });

  it("reads a missing last message as empty text, never as undefined", () => {
    const summary = summaryFromThread(thread({ last_content: null, last_direction: null }));
    expect(summary.content).toBe("");
    expect(summary.direction).toBe("");
  });
});
