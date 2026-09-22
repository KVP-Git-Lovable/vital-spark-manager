import { describe, it, expect } from "vitest";
import { displayToIso, isoToDisplay, maskTyping, displayDate } from "./dateInput";

describe("isoToDisplay", () => {
  it("turns a stored date into dd/MM/yyyy", () => {
    expect(isoToDisplay("1982-07-31")).toBe("31/07/1982");
  });

  it("ignores a trailing timestamp", () => {
    expect(isoToDisplay("1982-07-31T00:00:00Z")).toBe("31/07/1982");
  });

  it("gives an empty box for anything it cannot read", () => {
    expect(isoToDisplay("")).toBe("");
    expect(isoToDisplay(null)).toBe("");
    expect(isoToDisplay(undefined)).toBe("");
    expect(isoToDisplay("31/07/1982")).toBe("");
  });
});

describe("displayToIso", () => {
  it("turns a typed date into the stored form", () => {
    expect(displayToIso("31/07/1982")).toBe("1982-07-31");
    expect(displayToIso("01/01/2000")).toBe("2000-01-01");
  });

  it("accepts 29 February in a leap year and rejects it otherwise", () => {
    expect(displayToIso("29/02/2024")).toBe("2024-02-29");
    expect(displayToIso("29/02/2023")).toBeNull();
  });

  it("rejects a day that does not exist rather than rolling it forward", () => {
    // The trap: new Date(1982, 1, 31) is 3 March, so a naive parse would store
    // a date the user never typed.
    expect(displayToIso("31/02/1982")).toBeNull();
    expect(displayToIso("31/04/1982")).toBeNull();
    expect(displayToIso("00/01/1982")).toBeNull();
    expect(displayToIso("01/13/1982")).toBeNull();
  });

  it("leaves half-typed input unparsed instead of guessing", () => {
    expect(displayToIso("")).toBeNull();
    expect(displayToIso("31")).toBeNull();
    expect(displayToIso("31/0")).toBeNull();
    expect(displayToIso("31/07/19")).toBeNull();
    expect(displayToIso("1/1/82")).toBeNull();
  });

  it("round-trips with isoToDisplay", () => {
    expect(displayToIso(isoToDisplay("1975-12-09"))).toBe("1975-12-09");
  });
});

describe("maskTyping", () => {
  it("adds the separators as digits arrive", () => {
    expect(maskTyping("3")).toBe("3");
    expect(maskTyping("31")).toBe("31");
    expect(maskTyping("310")).toBe("31/0");
    expect(maskTyping("3107")).toBe("31/07");
    expect(maskTyping("31071982")).toBe("31/07/1982");
  });

  it("keeps already-separated text stable, so re-rendering never fights typing", () => {
    expect(maskTyping("31/07/1982")).toBe("31/07/1982");
  });

  it("shrinks as the user deletes", () => {
    expect(maskTyping("31/07/198")).toBe("31/07/198");
    expect(maskTyping("31/07/")).toBe("31/07");
    expect(maskTyping("31")).toBe("31");
    expect(maskTyping("")).toBe("");
  });

  it("drops stray characters and never exceeds a full date", () => {
    expect(maskTyping("31-07-1982")).toBe("31/07/1982");
    expect(maskTyping("31/07/19825555")).toBe("31/07/1982");
    expect(maskTyping("abc")).toBe("");
  });
});

describe("displayDate", () => {
  it("is dd/MM/yyyy whatever the machine's region", () => {
    expect(displayDate("2026-09-19T17:30:00")).toBe("19/09/2026");
    // The case that reads as a different date entirely in US order.
    expect(displayDate("2026-10-09T12:00:00")).toBe("09/10/2026");
  });

  it("pads single digits, so columns line up and nothing is ambiguous", () => {
    expect(displayDate("2026-01-05T00:00:00")).toBe("05/01/2026");
  });

  it("takes a Date or a timestamp as well as a string", () => {
    expect(displayDate(new Date(2026, 8, 19))).toBe("19/09/2026");
    expect(displayDate(new Date(2026, 8, 19).getTime())).toBe("19/09/2026");
  });

  it("renders blank rather than 'Invalid Date' for a missing or broken value", () => {
    expect(displayDate(null)).toBe("");
    expect(displayDate(undefined)).toBe("");
    expect(displayDate("")).toBe("");
    expect(displayDate("not a date")).toBe("");
  });
});
