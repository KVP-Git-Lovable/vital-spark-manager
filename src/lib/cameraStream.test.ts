import { describe, it, expect } from "vitest";
import { cameraConstraints, IDEAL_HEIGHT, IDEAL_WIDTH } from "./cameraStream";

const video = (mode: "environment" | "user") =>
  cameraConstraints(mode).video as MediaTrackConstraints;

describe("cameraConstraints", () => {
  it("asks for the back camera, and for the front when switched", () => {
    expect(video("environment").facingMode).toEqual({ ideal: "environment" });
    expect(video("user").facingMode).toEqual({ ideal: "user" });
  });

  it("asks for a full-resolution frame instead of leaving it to the browser", () => {
    expect(video("environment").width).toEqual({ ideal: IDEAL_WIDTH });
    expect(video("environment").height).toEqual({ ideal: IDEAL_HEIGHT });
    expect(IDEAL_WIDTH).toBeGreaterThanOrEqual(1920);
  });

  it("never demands a size, so a camera that cannot manage it still opens", () => {
    // exact would raise OverconstrainedError on an older phone and the camera
    // would not start at all - the one failure worse than a small picture.
    const serialised = JSON.stringify(cameraConstraints("environment"));
    expect(serialised).not.toContain("exact");
  });

  it("never asks for a microphone", () => {
    expect(cameraConstraints("environment").audio).toBe(false);
    expect(cameraConstraints("user").audio).toBe(false);
  });
});
