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

    console.log("Refreshing materialized views...");

    const { error } = await supabaseClient.rpc("refresh_parcel_views");

    if (error) throw error;

    // Get row counts
    const { count: zoningCount } = await supabaseClient
      .from("parcel_zoning_mv")
      .select("*", { count: "exact", head: true });

    const { count: infraCount } = await supabaseClient
      .from("parcel_infra_mv")
      .select("*", { count: "exact", head: true });

    const { count: signalsCount } = await supabaseClient
      .from("parcel_signals_mv")
      .select("*", { count: "exact", head: true });

    console.log(`Views refreshed: zoning=${zoningCount}, infra=${infraCount}, signals=${signalsCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        counts: {
          zoning: zoningCount,
          infra: infraCount,
          signals: signalsCount,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("View refresh error:", error);
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
