import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  appointmentChangeKind,
  appointmentEventId,
  type AppointmentChange,
} from "@/lib/liveAppointments";

/** Long enough that a run of front-desk deletions is one refetch, not ten. */
const SETTLE_MS = 1_000;

interface Options {
  /**
   * True while somebody is mid-edit on this screen.
   *
   * Nothing refetches while this holds. The clinic had the app's refetch-on-focus
   * removed because the page re-running its queries under them was reported as
   * "the app refreshes by itself", and a live feed would bring that straight
   * back if it were allowed to redraw a row being typed into. A change that
   * arrives during an edit is remembered and applied once the edit ends.
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
 * Subscribes once per screen and invalidates the "appointments" key, which
 * every list, calendar and count on the page is built from.
 */
export function useLiveAppointments({ paused = false, onAppointment }: Options = {}) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  // Read through refs so the subscription is made once and never torn down
  // and rebuilt as a page re-renders.
  const pausedRef = useRef(paused);
  const onAppointmentRef = useRef(onAppointment);
  pausedRef.current = paused;
  onAppointmentRef.current = onAppointment;

  const apply = () => {
    pendingRef.current = false;
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
  };

  const schedule = () => {
    pendingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (pausedRef.current) return; // held; the effect below applies it when the edit ends
      apply();
    }, SETTLE_MS);
  };

  useEffect(() => {
    const channel = supabase
      .channel("appointments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, (payload) => {
        const id = appointmentEventId(payload as never);
        if (id) onAppointmentRef.current?.(id, appointmentChangeKind(payload as never));
        schedule();
      })
      .subscribe();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The moment the screen is free again, catch up on whatever arrived while it
  // was not.
  useEffect(() => {
    if (!paused && pendingRef.current && !timerRef.current) apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
}
