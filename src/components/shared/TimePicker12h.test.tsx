import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { TimePicker12h } from "./TimePicker12h";

describe("TimePicker12h", () => {
  it("offers both AM and PM", () => {
    // The clinic reported PM as missing. It was rendered all along - the
    // container clipped it once the control got narrow, so staff could not
    // see it or click it. Both halves must be reachable.
    render(<TimePicker12h value="04:15" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "AM" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "PM" })).toBeTruthy();
  });

  it("turns a morning time into the afternoon when PM is clicked", () => {
    const onChange = vi.fn();
    render(<TimePicker12h value="04:15" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "PM" }));

    expect(onChange).toHaveBeenCalledWith("16:15");
  });

  it("turns an afternoon time back into the morning when AM is clicked", () => {
    const onChange = vi.fn();
    render(<TimePicker12h value="16:15" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "AM" }));

    expect(onChange).toHaveBeenCalledWith("04:15");
  });

  it("shows an afternoon time as PM, on the twelve-hour clock", () => {
    render(<TimePicker12h value="16:15" onChange={() => {}} />);

    expect((screen.getByLabelText("Hour") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("Minute") as HTMLInputElement).value).toBe("15");
    // Noon and midnight are the cases a 12-hour clock usually gets wrong.
    expect(screen.getByRole("button", { name: "PM" }).className).toContain("bg-primary");
  });

  it("keeps midday and midnight on the right side of the clock", () => {
    const onChange = vi.fn();
    const { rerender } = render(<TimePicker12h value="12:00" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "PM" }).className).toContain("bg-primary");

    rerender(<TimePicker12h value="00:30" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "AM" }).className).toContain("bg-primary");
    expect((screen.getByLabelText("Hour") as HTMLInputElement).value).toBe("12");
  });

  it("backspacing the hour leaves the minutes alone", () => {
    // It used to clear the whole time, and the half-typed value it left
    // behind - a date with nothing after the T - crashed the appointment
    // screen with "Invalid time value".
    const onChange = vi.fn();
    render(<TimePicker12h value="11:30" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Hour"), { target: { value: "" } });

    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Minute") as HTMLInputElement).value).toBe("30");
  });

  it("clears the time only once both halves are empty", () => {
    // An optional time - a clinic break - is still cleared this way: empty
    // one box, then the other.
    const onChange = vi.fn();
    render(<TimePicker12h value="11:30" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Minute"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Hour"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("hands the caret to the minutes once the hour is finished", () => {
    render(<TimePicker12h value="11:30" onChange={() => {}} />);
    const hour = screen.getByLabelText("Hour");
    const minute = screen.getByLabelText("Minute");

    fireEvent.change(hour, { target: { value: "10" } });

    expect(document.activeElement).toBe(minute);
  });

  it("hands it over on one digit when nothing could follow it", () => {
    render(<TimePicker12h value="11:30" onChange={() => {}} />);
    const minute = screen.getByLabelText("Minute");

    fireEvent.change(screen.getByLabelText("Hour"), { target: { value: "3" } });

    expect(document.activeElement).toBe(minute);
  });

  it("waits while the hour could still be the start of ten, eleven or twelve", () => {
    render(<TimePicker12h value="11:30" onChange={() => {}} />);
    const minute = screen.getByLabelText("Minute");

    fireEvent.change(screen.getByLabelText("Hour"), { target: { value: "1" } });

    expect(document.activeElement).not.toBe(minute);
  });

  it("steps back to the hour when the minute box is empty", () => {
    render(<TimePicker12h value="11:30" onChange={() => {}} />);
    const hour = screen.getByLabelText("Hour");
    const minute = screen.getByLabelText("Minute");

    fireEvent.change(minute, { target: { value: "" } });
    fireEvent.keyDown(minute, { key: "Backspace" });

    expect(document.activeElement).toBe(hour);
  });

  it("replaces the hour with the first digit typed, so 1 stays 1", () => {
    // The clinic typed 1 on the way to 12 and the caret left for the minutes:
    // the digit had been added to the 1 already there, making 11 - a finished
    // hour. The first digit after arriving in the box replaces it.
    const onChange = vi.fn();
    render(<TimePicker12h value="01:02" onChange={onChange} />);
    const hour = screen.getByLabelText("Hour") as HTMLInputElement;
    const minute = screen.getByLabelText("Minute");

    fireEvent.focus(hour);
    fireEvent.keyDown(hour, { key: "1" });

    expect(hour.value).toBe("1");
    expect(document.activeElement).not.toBe(minute);
  });

  it("takes the second digit as the rest of the hour, and then moves on", () => {
    const onChange = vi.fn();
    render(<TimePicker12h value="01:02" onChange={onChange} />);
    const hour = screen.getByLabelText("Hour") as HTMLInputElement;
    const minute = screen.getByLabelText("Minute");

    fireEvent.focus(hour);
    fireEvent.keyDown(hour, { key: "1" });
    fireEvent.change(hour, { target: { value: "12" } });

    expect(onChange).toHaveBeenCalledWith("00:02");
    expect(document.activeElement).toBe(minute);
  });

  it("replaces the minutes with the first digit typed there too", () => {
    render(<TimePicker12h value="01:02" onChange={() => {}} />);
    const minute = screen.getByLabelText("Minute") as HTMLInputElement;

    fireEvent.focus(minute);
    fireEvent.keyDown(minute, { key: "3" });

    expect(minute.value).toBe("3");
  });

  it("leaves the caret beside the first digit, so a second one can follow it", () => {
    // The digits are selected when the box takes focus so the first keystroke
    // replaces them. Leaving them selected meant the second digit replaced
    // the first as well, and a two-digit hour could not be typed at all.
    render(<TimePicker12h value="01:02" onChange={() => {}} />);
    const hour = screen.getByLabelText("Hour") as HTMLInputElement;

    fireEvent.focus(hour);
    fireEvent.keyDown(hour, { key: "1" });

    expect(hour.selectionStart).toBe(1);
    expect(hour.selectionEnd).toBe(1);
  });
});
