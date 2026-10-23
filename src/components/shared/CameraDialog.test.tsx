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

/**
 * Tapping the viewfinder used to do nothing at all.
 *
 * These mount a camera that actually starts, which the suite above
 * deliberately does not - jsdom has no mediaDevices, so everything there lands
 * in the "camera will not start" branch and never reaches a video track.
 */
describe("tapping the viewfinder to focus", () => {
  const trackWith = (capabilities: unknown) => ({
    stop: vi.fn(),
    getCapabilities: () => capabilities,
    applyConstraints: vi.fn().mockResolvedValue(undefined),
  });

  const mountCamera = (capabilities: unknown) => {
    const track = trackWith(capabilities);
    Object.defineProperty(global.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [track],
          getVideoTracks: () => [track],
        }),
      },
    });
    return track;
  };

  /** A 200x400 upright viewfinder, so a tap has somewhere to land. */
  const tapCentre = async () => {
    const frame = await screen.findByTestId("camera-frame");
    frame.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 400, right: 200, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(frame, { clientX: 100, clientY: 200 });
    return frame;
  };

  const widthWas = window.innerWidth;
  const setWidth = (px: number) =>
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px });

  beforeEach(() => {
    // A phone, which is where this was reported and the only place the
    // "use Phone camera" message is shown.
    setWidth(390);
    // jsdom does not implement playback; the dialog only ever awaits it.
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    setWidth(widthWas);
    // Put it back, or the suite above stops landing in the branch it tests.
    Reflect.deleteProperty(global.navigator, "mediaDevices");
    vi.restoreAllMocks();
  });

  it("aims the camera at the tapped point where the browser allows it", async () => {
    const track = mountCamera({ focusMode: ["single-shot", "continuous"], pointsOfInterest: {} });
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} />);
    await vi.waitFor(() => expect(track.getCapabilities()).toBeTruthy());

    await tapCentre();

    await vi.waitFor(() => expect(track.applyConstraints).toHaveBeenCalled());
    expect(track.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ focusMode: "single-shot", pointsOfInterest: [{ x: 0.5, y: 0.5 }] }],
    });
  });

  it("says so, and names the phone camera, where the browser does not - the iPhone case", async () => {
    // Safari on iOS reports no focus capabilities at all. Nothing can aim the
    // lens there, so the tap has to explain itself instead of looking broken.
    const track = mountCamera({});
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} />);
    await vi.waitFor(() => expect(track.getCapabilities()).toBeTruthy());

    await tapCentre();

    const note = await screen.findByTestId("focus-unavailable");
    expect(note.textContent).toMatch(/phone camera/i);
    expect(track.applyConstraints).not.toHaveBeenCalled();
  });

  it("does not claim the camera cannot focus when it can", async () => {
    const track = mountCamera({ focusMode: ["single-shot"], pointsOfInterest: {} });
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} />);
    await vi.waitFor(() => expect(track.getCapabilities()).toBeTruthy());

    await tapCentre();

    expect(screen.queryByTestId("focus-unavailable")).toBeNull();
  });

  it("acknowledges the tap on screen, whatever the camera can do", async () => {
    // The whole complaint was that tapping did nothing visible.
    mountCamera({});
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} />);

    await tapCentre();

    expect(await screen.findByTestId("focus-ring")).toBeTruthy();
  });

  it("does not throw when there is no camera to focus", async () => {
    render(<CameraDialog open onOpenChange={vi.fn()} onCapture={vi.fn()} />);
    const frame = await screen.findByTestId("camera-frame");
    frame.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 400, right: 200, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    expect(() => fireEvent.click(frame, { clientX: 10, clientY: 10 })).not.toThrow();
  });
});
