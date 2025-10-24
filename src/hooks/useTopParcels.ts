import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TopParcel {
  id: string;
  pin: string;
  county: string;
  address: string;
  city: string;
  acreage: number;
  landValue: number;
  zoningCategory: string;
  ownerType: string;
  investmentScore: number;
  rezoningProbability: number;
  yoyChange: number;
}

export const useTopParcels = (county?: string, limit = 20) => {
  return useQuery({
    queryKey: ["topParcels", county, limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("top-parcels", {
        body: { county, limit },
      });

      if (error) throw error;
      
      return data as { parcels: TopParcel[]; total: number };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
