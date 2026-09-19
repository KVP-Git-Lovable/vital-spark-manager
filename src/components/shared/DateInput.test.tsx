import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateInput } from "./DateInput";

/** Mirrors how PatientFormSheet holds date_of_birth: ISO in, ISO out. */
function Harness({ initial = "", onIso }: { initial?: string; onIso?: (v: string) => void }) {
  const [iso, setIso] = useState(initial);
  return (
    <>
      <DateInput value={iso} onChange={(v) => { setIso(v); onIso?.(v); }} />
      <span data-testid="stored">{iso}</span>
    </>
  );
}

const box = () => screen.getByPlaceholderText("dd/mm/yyyy") as HTMLInputElement;
const stored = () => screen.getByTestId("stored").textContent;

/** Types one character at a time, the way a person actually fills the field. */
function type(chars: string) {
  for (const c of chars) {
    fireEvent.change(box(), { target: { value: box().value + c } });
  }
}

describe("DateInput", () => {
  it("shows a stored date in dd/MM/yyyy, not the browser's order", () => {
    render(<Harness initial="1982-07-31" />);
    expect(box().value).toBe("31/07/1982");
  });

  it("can be typed straight through, inserting the slashes itself", () => {
    render(<Harness />);
    type("31071982");
    expect(box().value).toBe("31/07/1982");
    expect(stored()).toBe("1982-07-31");
  });

  it("holds the date back until it is complete, so a partial entry is never stored", () => {
    render(<Harness />);
    type("3107");
    expect(box().value).toBe("31/07");
    expect(stored()).toBe("");
    type("1982");
    expect(stored()).toBe("1982-07-31");
  });

  it("lets the user edit an existing date without the text fighting back", () => {
    // The trap this component exists to avoid: reformatting mid-edit, which
    // pushes the caret and leaves the typist unable to correct a digit.
    render(<Harness initial="1982-07-31" />);
    fireEvent.change(box(), { target: { value: "31/07/198" } });
    expect(box().value).toBe("31/07/198");
    fireEvent.change(box(), { target: { value: "31/07/1983" } });
    expect(box().value).toBe("31/07/1983");
    expect(stored()).toBe("1983-07-31");
  });

  it("clears the stored date when the box is emptied", () => {
    render(<Harness initial="1982-07-31" />);
    fireEvent.change(box(), { target: { value: "" } });
    expect(box().value).toBe("");
    expect(stored()).toBe("");
  });

  it("snaps back on blur rather than showing one date and saving another", () => {
    render(<Harness initial="1982-07-31" />);
    fireEvent.change(box(), { target: { value: "31/07/19" } });
    expect(stored()).toBe("1982-07-31");
    fireEvent.blur(box());
    expect(box().value).toBe("31/07/1982");
  });

  it("refuses a day that does not exist instead of rolling it into next month", () => {
    render(<Harness />);
    type("31021982");
    expect(box().value).toBe("31/02/1982");
    expect(stored()).toBe("");
  });
});
