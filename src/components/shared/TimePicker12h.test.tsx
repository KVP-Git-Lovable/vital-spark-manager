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
});
