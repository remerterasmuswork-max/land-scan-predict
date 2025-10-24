import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? ""
    );

    console.log("Fetching county status data");

    // Fetch all counties with their status
    const { data: counties, error: countiesError } = await supabaseClient
      .from("counties")
      .select("*")
      .order("name");

    if (countiesError) {
      console.error("Error fetching counties:", countiesError);
      throw countiesError;
    }

    // Fetch parcel count by county
    const { data: parcelCounts, error: countsError } = await supabaseClient
      .from("parcels")
      .select("county")
      .then((result) => {
        if (result.error) throw result.error;
        
        // Count parcels by county
        const counts: Record<string, number> = {};
        result.data?.forEach((p: any) => {
          counts[p.county] = (counts[p.county] || 0) + 1;
        });
        
        return { data: counts, error: null };
      });

    if (countsError) {
      console.error("Error counting parcels:", countsError);
    }

    // Fetch recent ingestion jobs
    const { data: recentJobs, error: jobsError } = await supabaseClient
      .from("ingestion_jobs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
    }

    // Combine data
    const enhancedCounties = counties?.map((county) => ({
      ...county,
      actual_parcel_count: parcelCounts?.[county.name] || 0,
      recent_jobs: recentJobs?.filter((job) => job.county === county.name) || [],
    }));

    console.log("Successfully fetched county status");

    return new Response(
      JSON.stringify({
        counties: enhancedCounties,
        summary: {
          total_counties: counties?.length || 0,
          total_parcels: Object.values(parcelCounts || {}).reduce(
            (sum: number, count: number) => sum + count,
            0
          ),
          last_updated: new Date().toISOString(),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in county-status:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
