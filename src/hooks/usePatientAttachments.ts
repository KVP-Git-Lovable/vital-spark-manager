import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * A patient's documents, fetched once for everybody who needs them.
 *
 * Three places want this list: the Attachments tab body, the patient record's
 * tab label, and now the appointment sheet's. They share a query key so React
 * Query serves all three from one request - which only works if they also
 * share the SELECT.
 *
 * They did not. The patient page asked for `*, procedures(service_name)` and
 * the tab body for `*`, on the same key, so whichever mounted first decided
 * what the other got. Harmless while the extra column went unread, and a trap
 * the moment somebody read it. One hook, one query, no drift.
 */

export interface PatientAttachment {
  id: string;
  file_name: string | null;
  file_url: string | null;
  document_type: string | null;
  notes: string | null;
  created_at: string;
}

export const patientAttachmentsKey = (patientId: string | null | undefined) =>
  ["patient-attachments", patientId] as const;

export function usePatientAttachments(patientId: string | null | undefined) {
  return useQuery({
    queryKey: patientAttachmentsKey(patientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedure_attachments")
        .select("*")
        .eq("patient_id", patientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PatientAttachment[];
    },
    enabled: !!patientId,
  });
}
