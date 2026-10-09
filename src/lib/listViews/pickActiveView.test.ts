import { describe, it, expect } from "vitest";
import { activeViewKey, pickActiveView } from "./pickActiveView";
import { ALL_VIEW_ID, RECENT_VIEW_ID } from "./standardViews";

const ME = "user-punya";
const views = [
  { id: "v-mine", is_default: true, owner_id: ME },
  { id: "v-theirs", is_default: true, owner_id: "user-suyog" },
  { id: "v-plain", is_default: false, owner_id: ME },
];

describe("pickActiveView", () => {
  it("opens on the view that was last chosen", () => {
    expect(pickActiveView({ stored: "v-plain", views, userId: ME })).toEqual({ id: "v-plain", forget: false });
  });

  it("opens on this user's pinned view when nothing was chosen", () => {
    expect(pickActiveView({ stored: null, views, userId: ME })).toEqual({ id: "v-mine", forget: false });
  });

  it("never lands on somebody else's pinned view", () => {
    // Two views are pinned and visible - one is a colleague's, shared with
    // everyone. Only your own counts.
    expect(pickActiveView({ stored: null, views, userId: "user-nobody" }).id).toBe(ALL_VIEW_ID);
  });

  it("forgets a remembered view this user can no longer see", () => {
    // A private view belonging to whoever used the machine last.
    expect(pickActiveView({ stored: "v-gone", views, userId: ME })).toEqual({ id: "v-mine", forget: true });
  });

  it("keeps a standard view without needing it in the list", () => {
    expect(pickActiveView({ stored: ALL_VIEW_ID, views, userId: ME })).toEqual({ id: ALL_VIEW_ID, forget: false });
    expect(pickActiveView({ stored: RECENT_VIEW_ID, views, userId: ME }).id).toBe(RECENT_VIEW_ID);
  });

  it("falls back to All when there is nothing to go on", () => {
    expect(pickActiveView({ stored: null, views: [], userId: ME })).toEqual({ id: ALL_VIEW_ID, forget: false });
  });
});

describe("activeViewKey", () => {
  it("keeps one person's remembered view out of another's", () => {
    expect(activeViewKey("appointments", "a")).not.toBe(activeViewKey("appointments", "b"));
    expect(activeViewKey("appointments", "a")).toBe("appointments.activeListView.a");
  });

  it("still has a key before the user is known", () => {
    expect(activeViewKey("appointments")).toBe("appointments.activeListView");
  });
});
