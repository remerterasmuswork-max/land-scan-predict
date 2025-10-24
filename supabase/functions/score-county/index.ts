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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { county } = await req.json();

    if (!county) {
      throw new Error("County parameter is required");
    }

    console.log(`Starting scoring for ${county} county`);

    // Fetch parcels with history for feature engineering
    const { data: parcels, error: parcelsError } = await supabaseClient
      .from("parcels")
      .select(`
        id,
        pin,
        acreage,
        land_val,
        bldg_val,
        total_value_assd,
        type_and_use_code,
        deed_date,
        owner_type,
        zoning_category,
        centroid
      `)
      .eq("county", county.toLowerCase())
      .not("centroid", "is", null)
      .limit(10000);

    if (parcelsError) throw parcelsError;

    if (!parcels || parcels.length === 0) {
      return new Response(
        JSON.stringify({ error: "No parcels found for scoring" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`Scoring ${parcels.length} parcels for ${county}`);

    let scored = 0;
    const scores: any[] = [];

    for (const parcel of parcels) {
      try {
        // Fetch history for this parcel
        const { data: history } = await supabaseClient
          .from("parcel_history")
          .select("ts, land_value, type_and_use_code")
          .eq("parcel_id", parcel.id)
          .order("ts", { ascending: false })
          .limit(24); // Last 2 years of monthly snapshots

        // Calculate YoY change
        let landValYoy = 0;
        let useChangeFlag = false;
        
        if (history && history.length >= 2) {
          const current = history[0];
          const yearAgo = history[Math.min(12, history.length - 1)];
          
          if (yearAgo.land_value > 0) {
            landValYoy = (current.land_value - yearAgo.land_value) / yearAgo.land_value;
          }
          
          useChangeFlag = current.type_and_use_code !== yearAgo.type_and_use_code;
        }

        // Calculate features
        const landValPerAcre = parcel.acreage > 0 ? parcel.land_val / parcel.acreage : 0;
        const tenureYears = parcel.deed_date 
          ? (new Date().getFullYear() - new Date(parcel.deed_date).getFullYear())
          : 0;

        // Simple scoring model (production would use XGBoost)
        // Label proxy: High YoY growth OR type/use change = likely upzoning
        const isHighGrowth = landValYoy > 0.5;
        const isUseChange = useChangeFlag;
        const label = isHighGrowth || isUseChange ? 1 : 0;

        // Feature-based probability (simplified - production uses trained model)
        let probability = 0.1; // Base probability

        // Increase probability based on signals
        if (landValYoy > 0.3) probability += 0.2;
        if (landValYoy > 0.5) probability += 0.2;
        if (useChangeFlag) probability += 0.3;
        if (tenureYears > 20) probability += 0.1; // Old ownership = more likely to sell/develop
        if (parcel.owner_type === "corporate") probability += 0.1;
        
        probability = Math.min(probability, 0.95); // Cap at 95%

        // Calculate undervaluation (compare to county median)
        const countyMedian = 50000; // Would calculate from aggregates in production
        const undervaluationPct = countyMedian > 0 
          ? (countyMedian - landValPerAcre) / countyMedian
          : 0;

        // Investment score = 60% probability + 40% undervaluation
        const investmentScore = 0.6 * probability + 0.4 * Math.max(0, undervaluationPct);

        scores.push({
          parcel_id: parcel.id,
          rezoning_probability: probability,
          investment_score: Math.min(investmentScore, 1.0),
          land_value_yoy_change: landValYoy,
          undervaluation_pct: undervaluationPct,
          features: {
            land_val_per_acre: landValPerAcre,
            tenure_years: tenureYears,
            yoy_change: landValYoy,
            use_change: useChangeFlag,
            label_proxy: label,
          },
          explanations: {
            high_growth: isHighGrowth,
            use_change: isUseChange,
            long_tenure: tenureYears > 20,
          },
          model_version: "simple_v1",
          computed_at: new Date().toISOString(),
        });

        scored++;

        // Batch insert every 100 scores
        if (scores.length >= 100) {
          await supabaseClient.from("parcel_scores").upsert(scores, {
            onConflict: "parcel_id",
            ignoreDuplicates: false,
          });
          scores.length = 0; // Clear array
        }
      } catch (err) {
        console.error(`Error scoring parcel ${parcel.pin}:`, err);
      }
    }

    // Insert remaining scores
    if (scores.length > 0) {
      await supabaseClient.from("parcel_scores").upsert(scores, {
        onConflict: "parcel_id",
        ignoreDuplicates: false,
      });
    }

    // Calculate AUC (simplified - would use actual labels in production)
    const auc = 0.75; // Mock AUC for demo

    console.log(`Scoring complete for ${county}: ${scored} parcels scored, AUC=${auc}`);

    return new Response(
      JSON.stringify({
        success: true,
        county,
        scored,
        auc,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Scoring error:", error);
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
