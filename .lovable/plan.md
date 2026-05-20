# Fix "Take Photo" opening File Manager instead of Camera

## Root cause

Today every "Take Photo" button triggers a hidden `<input type="file" accept="image/*" capture="environment">`. The `capture` attribute is **ignored on desktop browsers** — desktops have no camera-capture intent, so the browser falls back to the standard file picker (the "File Manager" the user sees). On mobile Chrome it would open the camera, but on the desktop preview it cannot.

To make "Take Photo" actually open the camera on both desktop and mobile, we need to use the **`navigator.mediaDevices.getUserMedia`** API and render a live video preview + capture button inside a dialog.

A second, important constraint (per our Lovable knowledge base): `getUserMedia` must be invoked **synchronously inside the click handler**, otherwise some browsers silently fall back / block. The new component will respect that.

## What I'll build

### 1. New shared component: `src/components/shared/CameraDialog.tsx`

A reusable in-app camera dialog:

- Opens a `<Dialog>` and immediately (synchronously on the trigger click, before the dialog mounts the video) calls `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })`.
- Shows live `<video>` preview, a circular Capture button, a Switch-camera button (front/back via `facingMode` toggle — useful on mobile), and a Retake/Use buttons after capture.
- On capture, draws the current video frame to a `<canvas>`, converts to a `File` (JPEG, ~0.9 quality), and returns it via `onCapture(file)`.
- Properly stops all tracks on close / unmount to release the camera.
- Graceful fallback: if `getUserMedia` is unsupported or permission denied, shows an error state with a "Choose from device" button that falls back to the existing `<input type="file" accept="image/*">` flow.
- Mobile-friendly: full-screen on small viewports, rounded card on desktop.

### 2. Wire it into the existing "Take Photo" surfaces

Replace the hidden `<input capture>` + `ref.click()` pattern in:

- **`src/pages/PatientDetail.tsx`**
  - Photos tab "Take Photo" button (line ~1059) and the header "Take Photo" button (line ~577) — both currently click `photoCameraRef`. Route both through `CameraDialog`; on capture, run the existing `handlePhotoCapture` upload logic with the returned `File`.
  - Attachments tab "Take Photo" button (line ~1420) — route through `CameraDialog`; on capture, run the existing `handleAttachmentUpload` logic.
- **`src/components/shared/CameraCapture.tsx`** — the "Camera" tile currently relies on the same `capture` attribute. Replace its click handler so it opens `CameraDialog` and feeds the resulting `File` into the existing preview/upload mutation. The "Gallery" tile keeps its current `<input type="file">` behavior (correct — that one is supposed to open the file picker).

No other modules currently use the file-input "Take Photo" pattern, so scope is limited to the files above.

## Behavior after fix

- **Desktop Chrome/Edge:** click "Take Photo" → browser prompts for camera permission → live webcam preview opens in a dialog → click capture → photo uploads as before.
- **Mobile Chrome/Android:** same flow, defaults to rear camera (`facingMode: "environment"`), with a button to flip to front.
- **iOS Safari (limited Web Speech support, but `getUserMedia` works):** same dialog flow.
- **Permission denied / unsupported browser:** dialog shows an inline error and a "Choose from device" button that opens the file picker as a fallback, so users are never stuck.

## Out of scope

- No changes to the upload pipeline, storage bucket, RLS, or DB schema — only the capture step changes.
- No changes to other voice/AI features.
