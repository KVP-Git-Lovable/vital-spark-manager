## Goal

Fix two mobile-PWA-only bugs in voice-to-text input so behavior matches desktop. All voice fields (Symptoms, Diagnosis, Procedure Notes, Recommendations, and every other surface) flow through a single hook — `src/hooks/useSpeechRecognition.ts` consumed by `src/components/shared/MicButton.tsx` — so a one-file fix propagates everywhere automatically.

## Bugs & Root Cause

**1. Duplicate text on mobile PWA**
Mobile Chrome occasionally fires `onresult` twice for the same final segment, and the current `start()` doesn't guard against a second `start()` call landing while the previous instance is still tearing down. Both contribute to "words appearing 2–3 times."

**2. Auto-stop on brief pause**
Mobile Chrome's `SpeechRecognition` ends the session itself after a short silence (engine VAD timeout), regardless of `continuous = true`. On desktop, the same engine keeps going. The hook treats `onend` as "user stopped," so the timer/UI stop and the user has to tap mic again.

## Fix (in `src/hooks/useSpeechRecognition.ts`)

**A. Single-instance guard**
- Add `isRecordingRef = useRef(false)` and a `shouldRestartRef = useRef(false)`.
- In `start()`: if `isRecordingRef.current` is `true`, return immediately (ignore the duplicate call). Set it `true` only after `recog.start()` succeeds (inside `onstart`).
- In `stop()`: set `shouldRestartRef.current = false` first, then call `recog.stop()`. This is the only path that truly ends the session.

**B. Duplicate-result suppression**
- Track `lastFinalRef = useRef<string>("")` plus a timestamp. In `onresult`, if the new final chunk equals the last final chunk emitted within ~800ms, skip it. (Cheap, safe — real repeated words from the user almost never arrive back-to-back identical within sub-second.)
- Keep using `ev.resultIndex` so we only read new results, not the full accumulated buffer.

**C. Auto-restart on engine timeout (match desktop "keep listening")**
- Set `shouldRestartRef.current = true` when the user starts.
- In `onend`: if `shouldRestartRef.current` is still `true` (i.e., user hasn't pressed stop), call `recog.start()` again on the same instance after a 150ms `setTimeout` to let the engine release. Wrap in try/catch — on `InvalidStateError`, construct a fresh `SpeechRecognition` and start it.
- Do NOT reset `elapsedMs` or `listening` UI during an auto-restart (only on a user-initiated stop). The timer should appear to run continuously across silent gaps.
- In `onerror`: only auto-restart for benign errors (`no-speech`, `aborted`, `network`). For `not-allowed` / `service-not-allowed`, set `shouldRestartRef = false` and surface the error as today.

**D. Lifecycle cleanup**
- On unmount and on user `stop()`: `shouldRestartRef = false`, then `recog.stop()` and clear timer. Ensures we never leave a phantom recognizer running after navigation.

## Why this works everywhere

`MicButton` is the only consumer of the hook, and `MicButton` is the only voice entry point used by Symptoms, Diagnosis, Procedure Notes, Recommendations, and every other field across the app. Fixing the hook fixes every surface — no per-field changes needed.

## Out of scope

- No UI/visual changes to the mic button or transcript display.
- No changes to PWA/service-worker configuration.
- No changes to `CameraDialog`, Bolna endpoint, or any other feature.

## Verification

- Desktop Chrome: behavior unchanged (single instance, continuous, manual stop).
- Mobile PWA (installed): speak → pause 3–5s → speak again → recording continues, timer keeps ticking, no duplicate words; tap mic to stop ends cleanly.
- Tested on the four named fields plus at least one other (e.g., patient notes) to confirm hook-level fix propagates.
