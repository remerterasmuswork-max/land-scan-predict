import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useParcelDetail = (parcelId: string | null) => {
  return useQuery({
    queryKey: ["parcelDetail", parcelId],
    queryFn: async () => {
      if (!parcelId) return null;

      const { data, error } = await supabase.functions.invoke("parcel-detail", {
        body: { parcelId },
      });

      if (error) throw error;
      
      return data.parcel;
    },
    enabled: !!parcelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
