import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Words that hint the photo is a clear, front-facing portrait — preferred for recognition. */
const FRONT_HINTS = ["front", "face", "portrait", "straight", "profile"];

function score(photo: any): number {
  const hay = `${photo.photo_type ?? ""} ${photo.notes ?? ""}`.toLowerCase();
  return FRONT_HINTS.some((h) => hay.includes(h)) ? 1 : 0;
}

/**
 * Latest recognisable photo per patient, keyed by patient id.
 * Prefers front-facing/portrait shots, then the most recent photo.
 */
export function usePatientAvatars(patientIds: string[]) {
  const ids = [...new Set(patientIds.filter(Boolean))].sort();
  const key = ids.join(",");

  const { data } = useQuery({
    queryKey: ["patient-avatars", key],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map: Record<string, string> = {};
      const best: Record<string, number> = {};
      // chunk to keep the URL length sane
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { data, error } = await supabase
          .from("patient_photos")
          .select("patient_id, photo_url, photo_type, notes, taken_at")
          .in("patient_id", chunk)
          .order("taken_at", { ascending: false });
        if (error) throw error;
        for (const p of data || []) {
          if (!p.photo_url) continue;
          const s = score(p);
          // rows arrive newest-first, so only replace on a strictly better score
          if (map[p.patient_id] === undefined || s > (best[p.patient_id] ?? -1)) {
            map[p.patient_id] = p.photo_url;
            best[p.patient_id] = s;
          }
        }
      }
      return map;
    },
  });

  return data ?? {};
}
