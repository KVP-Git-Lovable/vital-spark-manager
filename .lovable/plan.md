## Plan: Fix duplicate words in mobile PWA speech-to-text

### Goal
Make mobile PWA speech-to-text stop duplicating words by using a separate mobile-only result handling strategy, while keeping the current desktop behavior unchanged.

### Files to change
- `src/hooks/useSpeechRecognition.ts`

### Implementation
1. **Keep desktop behavior as-is**
   - Desktop will continue using the existing `continuous`, auto-restart, interim, and final transcript flow.

2. **Add mobile-only processed index tracking**
   - Replace the current mobile `lastProcessedResultIndexRef` approach with a `Set<number>` ref, e.g. `processedIndicesRef`.
   - In mobile `onresult`, iterate from `event.resultIndex` to `event.results.length`.
   - Skip any index already present in the Set.
   - Only add an index to the Set after processing a final result.
   - Never process the same final result index twice.

3. **Use mobile-only transcript accumulator**
   - Maintain `mobileTranscriptRef` as the single accumulated mobile final transcript.
   - On each new final result, append only the new transcript chunk to this accumulator.
   - Call `onFinal` only with the newly accepted final chunk so existing fields append normally and do not re-append the entire transcript.

4. **Mobile recognition config**
   - On mobile only:
     - `recognition.continuous = false`
     - `recognition.interimResults = true`
   - Desktop continues using the existing passed options.

5. **Mobile restart behavior without resetting dedupe mid-session**
   - On mobile `onend`, if the user has not tapped stop, restart recognition to keep recording alive.
   - Do **not** clear `processedIndicesRef` or `mobileTranscriptRef` during automatic restarts.
   - Clear them only when the user starts a new recording session or manually stops.

6. **Manual stop cleanup**
   - When the user taps stop, disable restart, stop recognition, and reset mobile session state safely.
   - This prevents stale processed indices from carrying into the next recording.

7. **Preserve single-instance guard**
   - Keep `isRecordingRef` / `recogRef` protection so mobile cannot run multiple recognition instances at the same time.

### Expected result
- Mobile PWA: duplicate words are prevented because each final result index is processed once per recording session.
- Mobile PWA: recording continues across browser `onend` events until the user taps stop.
- Desktop: unchanged behavior.