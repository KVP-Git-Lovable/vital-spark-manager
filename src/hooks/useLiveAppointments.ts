import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  appointmentChangeKind,
  appointmentEventId,
  canApplyLiveChange,
  type AppointmentChange,
} from "@/lib/liveAppointments";

/** Long enough that a run of front-desk deletions is one refresh, not ten. */
const SETTLE_MS = 1_000;

interface Options {
  /**
   * True while somebody is mid-edit on this screen - a row being edited
   * inline, the booking dialog open. Nothing refreshes while this holds.
   */
  paused?: boolean;
  /** Told about each change, so a screen can react to its own record. */
  onAppointment?: (id: string, kind: AppointmentChange) => void;
}

/**
 * Keep appointments current without anyone pressing refresh.
 *
 * The front desk re-books and cancels all day; a doctor's screen held its data
 * for a minute and refetched on nothing, so she saw none of it until something
 * else happened to reload. One re-booking that way cost a whole consultation -
 * see liveAppointments.ts.
 *
 * Nothing here can blank a screen. It invalidates rather than removing, so the
 * rows already on screen stay on screen while fresh ones are fetched behind
 * them: React Query reports `isLoading` only when a query has no data at all,
 * and this never empties one. A refresh that fails leaves the previous rows
 * exactly where they were, with the page's own notice above them.
 */
export function useLiveAppointments({ paused = false, onAppointment }: Options = {}) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  // Read through refs so the subscription is made once and never torn down and
  // rebuilt as a page re-renders.
  const pausedRef = useRef(paused);
  const onAppointmentRef = useRef(onAppointment);
  pausedRef.current = paused;
  onAppointmentRef.current = onAppointment;

  const applyIfAllowed = () => {
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (!canApplyLiveChange({ paused: pausedRef.current, hidden })) return; // held, not dropped
    pendingRef.current = false;
    queryClient.invalidateQueries({
      queryKey: ["appointments"],
      // Only what is actually on screen is re-read. Everything else is marked
      // stale and refreshes the next time it is opened, which costs nothing now.
      refetchType: "active",
    });
  };

  useEffect(() => {
    const schedule = () => {
      pendingRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        applyIfAllowed();
      }, SETTLE_MS);
    };

    const channel = supabase
      .channel("appointments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, (payload) => {
        const id = appointmentEventId(payload as never);
        if (id) onAppointmentRef.current?.(id, appointmentChangeKind(payload as never));
        schedule();
      })
      .subscribe();

    // Coming back to the tab is the moment to catch up: the app does not
    // refetch on window focus - that was removed as "the app refreshes by
    // itself" - so without this a backgrounded screen would stay behind.
    const onVisible = () => {
      if (document.visibilityState === "visible" && pendingRef.current) applyIfAllowed();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The moment the screen is free again, catch up on whatever arrived while it
  // was not.
  useEffect(() => {
    if (!paused && pendingRef.current && !timerRef.current) applyIfAllowed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
}
