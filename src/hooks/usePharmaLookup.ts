import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PHARMA_LOOKUP_COLUMNS, PHARMA_LOOKUP_KEY, type MedicineDefaults } from "@/lib/medicineDefaults";

/**
 * The medicine list every prescribing screen works from.
 *
 * It exists so the columns and the cache key travel together. Four screens
 * used to write this query out separately under the same key and two of them
 * asked for id and name alone, so whichever opened first decided whether the
 * pharmacy's prescription defaults reached the doctor at all.
 */
export interface PharmaLookupProduct extends MedicineDefaults {
  id: string;
  name: string;
}

export function usePharmaLookup() {
  return useQuery({
    queryKey: PHARMA_LOOKUP_KEY,
    queryFn: async (): Promise<PharmaLookupProduct[]> => {
      const { data, error } = await supabase.from("pharma_products").select(PHARMA_LOOKUP_COLUMNS).order("name");
      if (error) throw error;
      return (data || []) as PharmaLookupProduct[];
    },
  });
}
