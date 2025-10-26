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
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const z = parseInt(pathParts[pathParts.length - 3]);
    const x = parseInt(pathParts[pathParts.length - 2]);
    const y = parseInt(pathParts[pathParts.length - 1].replace(".mvt", ""));

    if (isNaN(z) || isNaN(x) || isNaN(y)) {
      return new Response("Invalid tile coordinates", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get filters from query params
    const county = url.searchParams.get("county");
    const minAcres = parseFloat(url.searchParams.get("minAcres") || "0");
    const minProb = parseFloat(url.searchParams.get("minProb") || "0");
    const insideUSA = url.searchParams.get("insideUSA") === "true";

    // Use new secure get_tile_data function with discrete parameters
    const { data, error } = await supabaseClient.rpc("get_tile_data", {
      z_param: z,
      x_param: x,
      y_param: y,
      county_filter: county,
      min_acres_filter: minAcres,
      min_prob_filter: minProb,
      inside_usa_filter: insideUSA,
    });

    if (error) {
      console.error("Tile generation error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(data, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-protobuf",
        "Content-Encoding": "gzip",
      },
    });
  } catch (error) {
    console.error("Vector tile error:", error);
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
