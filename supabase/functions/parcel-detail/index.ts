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

    const { parcelId } = await req.json();

    if (!parcelId) {
      return new Response(
        JSON.stringify({ error: "parcelId is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Fetching parcel detail for:", parcelId);

    // Fetch parcel with all related data
    const { data: parcel, error: parcelError } = await supabaseClient
      .from("parcels")
      .select(`
        *,
        parcel_scores (
          rezoning_probability,
          investment_score,
          land_value_yoy_change,
          distance_to_infrastructure,
          nearby_rezoned_count,
          confidence_score,
          computed_at
        ),
        parcel_history (
          year,
          land_value,
          total_value,
          type_and_use,
          zoning_code
        )
      `)
      .eq("id", parcelId)
      .single();

    if (parcelError) {
      console.error("Error fetching parcel:", parcelError);
      
      if (parcelError.code === "PGRST116") {
        return new Response(
          JSON.stringify({ error: "Parcel not found" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          }
        );
      }
      
      throw parcelError;
    }

    // Generate AI insights based on parcel data
    const aiInsights = generateInsights(parcel);

    console.log("Successfully fetched parcel detail");

    return new Response(
      JSON.stringify({
        parcel: {
          ...parcel,
          ai_insights: aiInsights,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in parcel-detail:", error);
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

function generateInsights(parcel: any): string {
  const score = parcel.parcel_scores?.[0];
  const history = parcel.parcel_history || [];
  
  if (!score) {
    return "Insufficient data for AI analysis. Please check back after next scoring cycle.";
  }

  const insights: string[] = [];

  // Investment score insights
  if (score.investment_score >= 80) {
    insights.push(`Exceptional investment opportunity with a score of ${score.investment_score.toFixed(1)}.`);
  } else if (score.investment_score >= 60) {
    insights.push(`Strong investment potential with a score of ${score.investment_score.toFixed(1)}.`);
  } else {
    insights.push(`Moderate investment score of ${score.investment_score.toFixed(1)}.`);
  }

  // Rezoning probability insights
  if (score.rezoning_probability >= 70) {
    insights.push(`High likelihood of upzoning within 24 months (${score.rezoning_probability.toFixed(0)}% probability).`);
  } else if (score.rezoning_probability >= 50) {
    insights.push(`Moderate rezoning potential (${score.rezoning_probability.toFixed(0)}% probability).`);
  }

  // Land value trends
  if (score.land_value_yoy_change && score.land_value_yoy_change > 10) {
    insights.push(`Strong appreciation trend with ${score.land_value_yoy_change.toFixed(1)}% YoY land value growth.`);
  } else if (score.land_value_yoy_change && score.land_value_yoy_change > 5) {
    insights.push(`Steady appreciation with ${score.land_value_yoy_change.toFixed(1)}% YoY growth.`);
  }

  // Nearby development
  if (score.nearby_rezoned_count > 3) {
    insights.push(`Located in active development area with ${score.nearby_rezoned_count} nearby parcels recently rezoned.`);
  }

  // Zoning insights
  if (parcel.zoning_category === "residential" && score.rezoning_probability > 60) {
    insights.push("Current low-density residential zoning presents opportunity for higher-density mixed-use transition.");
  }

  // Historical patterns
  if (history.length >= 3) {
    const typeChanges = new Set(history.map((h: any) => h.type_and_use)).size;
    if (typeChanges > 1) {
      insights.push("Historical land use changes indicate flexibility for future development.");
    }
  }

  return insights.join(" ");
}
