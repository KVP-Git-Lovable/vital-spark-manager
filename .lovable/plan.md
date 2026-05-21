# Real-time interim transcript on mobile PWA

## Problem

On mobile PWA, words only appear after the user stops speaking. On desktop, they appear live while speaking. Root cause: in `src/hooks/useSpeechRecognition.ts`, mobile is forced to `continuous = false` and auto-restart is disabled, so the engine only emits `onresult` once per utterance — typically buffering until the end. The `interimTranscript` state therefore never updates mid-speech on mobile.

## Goal

Mobile PWA should behave like desktop: live interim text while speaking, finals appended as they arrive, recording continues until the user taps stop. No duplicates, no beep loop.

## Approach

Re-enable continuous mode + auto-restart on mobile, but keep the existing duplicate-suppression guards that already exist in the hook so the prior duplicate-word problem does not return.

### Changes (single file: `src/hooks/useSpeechRecognition.ts`)

1. **Use `continuous = true` on mobile** (line 97). The engine streams interim results live; without `continuous`, mobile Chrome batches results until the utterance ends.
2. **Auto-restart on mobile in `onend`** (line 162). Mirror desktop's 150 ms `setTimeout` restart so a brief VAD-induced end does not stop recording. Recording still only truly stops when `shouldRestartRef.current === false` (set by user-initiated `stop()`).
3. **Set `shouldRestartRef.current = true` for both desktop and mobile in `start()`** (line 93).
4. **Keep the existing dedupe guards** so re-fired finals from mobile Chrome do not double-append:
   - `lastProcessedResultIndexRef` — only process result indices we have not seen.
   - `lastFinalRef` + `lastFinalAtRef` (800 ms window) — drop identical final chunks fired back-to-back.
   - `isRecordingRef` single-instance guard in `start()`.
5. **Benign-error handling on mobile**: in `onerror`, also treat `no-speech` / `aborted` / `network` as benign on mobile (return without stopping), so the auto-restart in `onend` can take over instead of surfacing an error.
6. **Interim handling unchanged**: `onresult` already calls `setInterimTranscript(interim)` for both mobile and desktop — with `continuous=true` the engine will now actually emit interims mid-utterance on mobile.

### Why this fixes the regression risk

The previous duplicate-words bug came from running multiple recognizer instances concurrently and re-processing the same `resultIndex`. Those root causes are already mitigated by `isRecordingRef`, `lastProcessedResultIndexRef`, and the 800 ms final-dedupe window — all retained.

### Out of scope

No UI / `MicButton` changes. No edits to consumers (Symptoms, Diagnosis, Procedure Notes, Recommendations) — they automatically inherit the fix.
