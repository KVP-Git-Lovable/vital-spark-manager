/**
 * What to ask the camera for.
 *
 * This used to pass facingMode alone, which leaves the resolution entirely to
 * the browser - and a browser given no width or height hands back its default,
 * commonly 640x480. The clinic photographs skin: a soft, small frame is the
 * difference between a lesion you can compare next month and one you cannot.
 *
 * "ideal" rather than "exact" throughout, deliberately. exact is a hard
 * requirement - a camera that cannot manage 1080p, which includes some of the
 * older phones in the clinic, fails to open at all with an
 * OverconstrainedError. ideal asks for the best and accepts whatever the
 * camera can give, so nothing that worked before stops working.
 */

/** Full HD: the most any clinic camera here offers, and plenty for skin. */
export const IDEAL_WIDTH = 1920;
export const IDEAL_HEIGHT = 1080;

export type CameraFacing = "environment" | "user";

/**
 * The shape of the picture the camera is actually sending.
 *
 * The frame around the live view used to be a fixed shape, and a fixed shape
 * is wrong on one device or the other: a 4:3 box cut the sides off a desktop
 * webcam, and replacing it with a 16:9 box left a phone held upright as a
 * narrow strip between two black bars. Neither camera was at fault - the box
 * was. So the box is sized from this instead.
 *
 * null until a <video> has loaded its metadata, when videoWidth and
 * videoHeight are both 0 - the frame keeps its per-device guess until then
 * rather than dividing by zero.
 */
export function frameAspectRatio(videoWidth: number, videoHeight: number): number | null {
  if (!Number.isFinite(videoWidth) || !Number.isFinite(videoHeight)) return null;
  if (videoWidth <= 0 || videoHeight <= 0) return null;
  return videoWidth / videoHeight;
}

export function cameraConstraints(mode: CameraFacing): MediaStreamConstraints {
  return {
    video: {
      facingMode: { ideal: mode },
      width: { ideal: IDEAL_WIDTH },
      height: { ideal: IDEAL_HEIGHT },
    },
    // Never a microphone. Nothing here records sound, and asking for one would
    // put a second permission in front of taking a photograph.
    audio: false,
  };
}
