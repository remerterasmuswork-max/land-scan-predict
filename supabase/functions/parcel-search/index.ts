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

    const {
      county,
      minAcreage,
      maxAcreage,
      zoningCategory,
      minProbability,
      limit = 100,
    } = await req.json();

    console.log("Parcel search request:", {
      county,
      minAcreage,
      maxAcreage,
      zoningCategory,
      minProbability,
      limit,
    });

    // Build query with filters
    let query = supabaseClient
      .from("parcels")
      .select(`
        id,
        pin,
        county,
        address,
        city,
        acreage,
        land_value,
        zoning_code,
        zoning_category,
        owner_type,
        parcel_scores (
          investment_score,
          rezoning_probability,
          land_value_yoy_change
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply filters
    if (county && county !== "all") {
      query = query.eq("county", county);
    }

    if (minAcreage !== undefined && minAcreage > 0) {
      query = query.gte("acreage", minAcreage);
    }

    if (maxAcreage !== undefined && maxAcreage > 0) {
      query = query.lte("acreage", maxAcreage);
    }

    if (zoningCategory && zoningCategory !== "all") {
      query = query.eq("zoning_category", zoningCategory);
    }

    const { data: parcels, error: parcelsError } = await query;

    if (parcelsError) {
      console.error("Error fetching parcels:", parcelsError);
      throw parcelsError;
    }

    // Filter by rezoning probability if specified (done in memory for now)
    let filteredParcels = parcels || [];
    if (minProbability !== undefined && minProbability > 0) {
      filteredParcels = filteredParcels.filter(
        (p: any) =>
          p.parcel_scores?.[0]?.rezoning_probability >= minProbability
      );
    }

    // Sort by investment score descending
    filteredParcels.sort((a: any, b: any) => {
      const scoreA = a.parcel_scores?.[0]?.investment_score || 0;
      const scoreB = b.parcel_scores?.[0]?.investment_score || 0;
      return scoreB - scoreA;
    });

    console.log(`Found ${filteredParcels.length} parcels matching criteria`);

    return new Response(
      JSON.stringify({
        parcels: filteredParcels,
        total: filteredParcels.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in parcel-search:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
