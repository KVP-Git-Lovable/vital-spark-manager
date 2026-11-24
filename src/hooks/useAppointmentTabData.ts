import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { stickyNoteOwner } from "@/lib/stickyNoteOwner";

/**
 * The three lists an appointment's tabs are counted from.
 *
 * Each already existed inside the component that renders the tab, and the
 * count needed the same numbers. They are hooks rather than a second query on
 * the same key for one specific reason:
 *
 * Only the OPEN tab's body is mounted. Opening the sheet on Details means the
 * count is the sole consumer of the key, so its queryFn is the one that fills
 * the cache - and when the clinician then opens Survey or Notes, that body
 * renders whatever the count fetched. A lighter `select("id")` count would
 * have quietly stripped the joined template name off the survey rows. One
 * query, used by both, cannot do that.
 */

export const appointmentSurveyResponsesKey = (
  appointmentId: string | null | undefined,
  patientId: string | null | undefined,
) => ["survey-responses", appointmentId, patientId] as const;

export function useAppointmentSurveyResponses(
  appointmentId: string | null | undefined,
  patientId: string | null | undefined,
) {
  return useQuery({
    queryKey: appointmentSurveyResponsesKey(appointmentId, patientId),
    queryFn: async () => {
      let query = supabase
        .from("survey_responses")
        .select("*, survey_templates(name), staff(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (patientId) {
        query = query.or(`appointment_id.eq.${appointmentId},patient_id.eq.${patientId}`);
      } else {
        query = query.eq("appointment_id", appointmentId!);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });
}

/** Keyed by table as well as id: a procedure and an appointment could
 *  otherwise share a cache entry on equal uuids. */
export const stickyNotesKey = (owner: ReturnType<typeof stickyNoteOwner>) =>
  ["sticky-notes", owner?.table, owner?.id] as const;

/**
 * The notes on a procedure OR an appointment.
 *
 * Takes the owner rather than an appointment id, because StickyNotes serves
 * both and must keep doing so.
 */
export function useStickyNotes(owner: ReturnType<typeof stickyNoteOwner>) {
  return useQuery({
    queryKey: stickyNotesKey(owner),
    queryFn: async () => {
      if (!owner) return [];
      const { data, error } = await supabase
        .from(owner.table as "procedure_sticky_notes")
        .select("*")
        .eq(owner.column as "procedure_id", owner.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!owner,
  });
}

/** The same notes, for an appointment's tab count. */
export function useAppointmentStickyNotes(appointmentId: string | null | undefined) {
  return useStickyNotes(stickyNoteOwner({ appointmentId: appointmentId ?? undefined }));
}

export const appointmentFeedbackKey = (appointmentId: string | null | undefined) =>
  ["patient-feedback", appointmentId] as const;

/** One row or none: patient_feedback carries UNIQUE (appointment_id). */
export function useAppointmentFeedback(appointmentId: string | null | undefined) {
  return useQuery({
    queryKey: appointmentFeedbackKey(appointmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_feedback")
        .select("*")
        .eq("appointment_id", appointmentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });
}
