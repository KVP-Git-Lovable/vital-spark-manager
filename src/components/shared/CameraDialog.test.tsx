import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CameraDialog } from "./CameraDialog";

/**
 * jsdom has no navigator.mediaDevices, so the dialog lands in exactly the
 * branch a phone lands in when the live camera will not start: the message and
 * the "Choose from device" button. That branch used to hand back one photo and
 * close, which is why taking several worked on the desktop and nowhere else.
 */
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
  global.URL.revokeObjectURL = vi.fn();
});

const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });

describe("CameraDialog, when the live camera cannot start", () => {
  it("collects photos from the device without closing", async () => {
    const onCaptureMany = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CameraDialog open onOpenChange={onOpenChange} onCapture={vi.fn()} multiple onCaptureMany={onCaptureMany} />,
    );

    const picker = await screen.findByText(/choose from device/i);
    const input = picker.closest("div")?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.multiple).toBe(true);

    fireEvent.change(input, { target: { files: [file("a.jpg"), file("b.jpg")] } });

    // Still open, and nothing handed back yet - the set is still being built.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onCaptureMany).not.toHaveBeenCalled();

    // Another one, the way a phone camera returns them: one at a time.
    fireEvent.change(input, { target: { files: [file("c.jpg")] } });
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(onCaptureMany).toHaveBeenCalledTimes(1);
    expect(onCaptureMany.mock.calls[0][0]).toHaveLength(3);
  });

  it("still takes exactly one photo when it is not in multi-shot mode", () => {
    // The patient attachments camera, the prescription scanner and the patient
    // page all want one picture and must not change.
    const onCapture = vi.fn();
    const onOpenChange = vi.fn();
    render(<CameraDialog open onOpenChange={onOpenChange} onCapture={onCapture} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.multiple).toBe(false);
    fireEvent.change(input, { target: { files: [file("a.jpg")] } });

    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the count on Done from the start, so a set is clearly possible", () => {
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} multiple onCaptureMany={vi.fn()} />);
    expect(screen.getByRole("button", { name: /done/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /done/i }).textContent).toContain("(0)");
  });
});
