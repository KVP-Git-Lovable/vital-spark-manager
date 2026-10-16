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
