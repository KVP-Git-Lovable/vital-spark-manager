import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionStatus = "idle" | "listening" | "error";

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onFinal?: (text: string) => void;
}

export function getSpeechRecognitionCtor(): { new (): SpeechRecognition } | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(opts: UseSpeechRecognitionOptions = {}) {
  const { language = "en-IN", continuous = true, interimResults = true, onFinal } = opts;
  const Ctor = getSpeechRecognitionCtor();
  const supported = !!Ctor;

  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recogRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanup = useCallback(() => {
    stopTimer();
    setListening(false);
    setInterimTranscript("");
  }, []);

  const stop = useCallback(() => {
    try {
      recogRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    if (!Ctor) {
      setError("Voice input not supported in this browser");
      return;
    }
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch { /* ignore */ }
    }
    setError(null);
    setInterimTranscript("");
    setElapsedMs(0);

    const recog = new Ctor();
    recog.lang = language;
    recog.continuous = continuous;
    recog.interimResults = interimResults;
    recog.maxAlternatives = 1;

    recog.onstart = () => {
      setListening(true);
      startedAtRef.current = Date.now();
      stopTimer();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
    };
    recog.onresult = (ev) => {
      let interim = "";
      let finalChunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r[0]?.transcript || "";
        if (r.isFinal) finalChunk += text;
        else interim += text;
      }
      if (interim) setInterimTranscript(interim);
      if (finalChunk) {
        setInterimTranscript("");
        onFinalRef.current?.(finalChunk.trim());
      }
    };
    recog.onerror = (ev) => {
      setError(ev.error || "Voice error");
      cleanup();
    };
    recog.onend = () => {
      cleanup();
    };

    recogRef.current = recog;
    try {
      recog.start();
    } catch (e: any) {
      setError(e?.message || "Could not start voice input");
      cleanup();
    }
  }, [Ctor, language, continuous, interimResults, cleanup]);

  useEffect(() => {
    return () => {
      stopTimer();
      try { recogRef.current?.abort(); } catch { /* ignore */ }
    };
  }, []);

  return { supported, listening, interimTranscript, elapsedMs, error, start, stop };
}

export function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}