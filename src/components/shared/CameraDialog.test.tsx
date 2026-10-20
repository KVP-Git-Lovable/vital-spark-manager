import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

    // The input is mounted beside the frame rather than inside this block, so
    // that "Phone camera" can reach it too - the two share it.
    await screen.findByText(/choose from device/i);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
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

/**
 * The frame shape is where this went wrong three times over. A fixed 4:3 box
 * cut the sides off a desktop webcam; a fixed 16:9 box left a phone as a strip
 * between black bars; and sizing the box to a 9:16 stream inside a stacked
 * dialog squeezed it to about 280 of a 370px-wide phone. The phone gets the
 * screen, the desktop gets a shaped box - and neither should quietly become
 * the other.
 */
describe("the camera frame", () => {
  const widthWas = window.innerWidth;
  const setWidth = (px: number) =>
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px });
  afterEach(() => setWidth(widthWas));

  it("fills the screen on a phone, with no shape imposed on it", () => {
    setWidth(390);
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} multiple onCaptureMany={vi.fn()} />);
    const frame = screen.getByTestId("camera-frame");
    expect(frame.className).toContain("flex-1");
    // No height cap and no aspect box: those are what left bars down the sides.
    expect(frame.style.maxHeight).toBe("");
    expect(frame.style.aspectRatio).toBe("");
  });

  it("stays a shaped box on a desktop, so the dialog is not swallowed", () => {
    setWidth(1280);
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} multiple onCaptureMany={vi.fn()} />);
    const frame = screen.getByTestId("camera-frame");
    expect(frame.className).toContain("aspect-video");
    expect(frame.style.maxHeight).not.toBe("");
  });
});

/**
 * The phone's camera and the gallery share one file input, so the `capture`
 * attribute is the only thing telling them apart. Get it wrong and "Phone
 * camera" opens the photo library, or "Choose from device" launches the
 * camera - and the whole point of the phone camera here is that it is the only
 * way to focus an iPhone.
 */
describe("choosing where a photo comes from", () => {
  const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

  it("sets capture for the phone's own camera", async () => {
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} multiple onCaptureMany={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /phone camera/i }));
    expect(fileInput().getAttribute("capture")).toBe("environment");
  });

  it("clears it again for the gallery, so the camera does not open instead", async () => {
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} multiple onCaptureMany={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /phone camera/i }));
    fireEvent.click(screen.getByRole("button", { name: /choose from device/i }));
    expect(fileInput().hasAttribute("capture")).toBe(false);
  });
});
