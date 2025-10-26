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
    // Authentication enforced by verify_jwt = true in config.toml
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { limit = 20, county } = await req.json();

    console.log("Fetching top parcels:", { limit, county });

    // Fetch parcels with scores, ordered by investment score
    let query = supabaseClient
      .from("parcel_scores")
      .select(`
        investment_score,
        rezoning_probability,
        land_value_yoy_change,
        parcels (
          id,
          pin,
          county,
          address,
          city,
          acreage,
          land_value,
          zoning_category,
          owner_type
        )
      `)
      .not("parcels", "is", null)
      .order("investment_score", { ascending: false })
      .limit(limit);

    const { data: scores, error: scoresError } = await query;

    if (scoresError) {
      console.error("Error fetching top parcels:", scoresError);
      throw scoresError;
    }

    // Transform and filter by county if specified
    let topParcels = (scores || [])
      .map((score: any) => ({
        id: score.parcels.id,
        pin: score.parcels.pin,
        county: score.parcels.county,
        address: score.parcels.address,
        city: score.parcels.city,
        acreage: score.parcels.acreage,
        landValue: score.parcels.land_value,
        zoningCategory: score.parcels.zoning_category,
        ownerType: score.parcels.owner_type,
        investmentScore: score.investment_score,
        rezoningProbability: score.rezoning_probability,
        yoyChange: score.land_value_yoy_change,
      }))
      .filter((p: any) => p.address); // Filter out parcels without addresses

    // Apply county filter if specified
    if (county && county !== "all") {
      topParcels = topParcels.filter((p: any) => p.county === county);
    }

    console.log(`Returning ${topParcels.length} top parcels`);

    return new Response(
      JSON.stringify({
        parcels: topParcels,
        total: topParcels.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in top-parcels:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
