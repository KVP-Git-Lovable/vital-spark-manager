import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * One patient's attachments - their documents, consent forms, lab reports and
 * scanned prescriptions.
 *
 * Lives in its own file rather than beside the list that renders it so that
 * PatientAttachments.tsx exports components only - a file mixing the two breaks
 * react-refresh, which eslint flags. The same reason usePatientFeedback sits
 * here.
 *
 * One query for both the list and the patient page's tab badge. They share a
 * query key deliberately: mounting both costs one request, not two, and an
 * upload refetched from the list updates the badge without a refetch being
 * wired between them.
 *
 * It is one definition rather than two call sites agreeing on a select, because
 * agreeing is the part that failed. The page's count query used to ask for
 * `*, procedures(service_name)` against this same key while the list asked for
 * `*`, so whichever mounted first decided the shape the other was handed, and
 * reading the joined service back would have come up undefined depending on how
 * the patient was navigated to.
 */
export interface PatientAttachment {
  id: string;
  file_name: string | null;
  file_url: string | null;
  document_type: string | null;
  notes: string | null;
  created_at: string;
}

export function usePatientAttachments(patientId: string | null | undefined) {
  return useQuery({
    queryKey: ["patient-attachments", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedure_attachments")
        // No embed. The joined service is not read anywhere - the list labels a
        // file by its type and its date - and the column does not hold a
        // service name anyway, as the note in PatientAttachments.tsx explains.
        .select("*")
        .eq("patient_id", patientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PatientAttachment[];
    },
    enabled: !!patientId,
  });
}
