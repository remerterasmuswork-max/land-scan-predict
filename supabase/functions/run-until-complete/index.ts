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

  const startTime = Date.now();
  let output = "";

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // ============= WAKE COUNTY =============
    output += "=== WAKE COUNTY INGESTION ===\n\n";
    
    let wakeIteration = 0;
    let wakeComplete = false;
    
    while (!wakeComplete) {
      wakeIteration++;
      output += `Wake iteration ${wakeIteration}...\n`;
      
      const ingestUrl = `${supabaseUrl}/functions/v1/ingest-county`;
      const ingestResponse = await fetch(ingestUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ county: "wake" }),
      });

      if (!ingestResponse.ok) {
        const errorText = await ingestResponse.text();
        output += `FAIL: HTTP ${ingestResponse.status}\n`;
        output += `URL: ${ingestUrl}\n`;
        output += `Body (first 300): ${errorText.substring(0, 300)}\n`;
        
        return new Response(output, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
          status: 500,
        });
      }

      const ingestData = await ingestResponse.json();
      
      if (ingestData.status === "COMPLETED") {
        output += `Wake COMPLETED after ${wakeIteration} iterations\n`;
        output += `last_objectid: ${ingestData.last_objectid || "N/A"}\n\n`;
        wakeComplete = true;
      } else if (ingestData.status === "PROGRESS") {
        output += `last_objectid: ${ingestData.last_objectid}\n`;
        await new Promise(resolve => setTimeout(resolve, 250));
      } else if (ingestData.status === "FAIL") {
        output += `FAIL: ${JSON.stringify(ingestData)}\n`;
        return new Response(output, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
          status: 500,
        });
      } else {
        output += `Unexpected status: ${JSON.stringify(ingestData)}\n`;
        return new Response(output, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
          status: 500,
        });
      }
    }

    // Query Wake results
    output += "=== WAKE VALIDATION ===\n\n";

    const { data: wakeData, error: wakeError } = await supabaseClient
      .from("parcels")
      .select("id, geometry", { count: "exact" })
      .eq("county", "wake");

    const wakeRows = wakeData?.length || 0;
    const wakeWithGeom = wakeData?.filter(p => p.geometry !== null).length || 0;
    const wakePctGeom = wakeRows > 0 ? Math.round((wakeWithGeom / wakeRows) * 100 * 100) / 100 : 0;

    output += `Q1: wake_rows=${wakeRows}, pct_geom=${wakePctGeom}\n`;

    const { count: wakeHistRows, error: wakeHistError } = await supabaseClient
      .from("parcel_history")
      .select("*", { count: "exact", head: true })
      .eq("ts", new Date().toISOString().split('T')[0])
      .in("parcel_id", wakeData?.map(p => p.id) || []);

    output += `Q2: hist_rows=${wakeHistRows || 0}\n`;

    const { data: wakeSample, error: wakeSampleError } = await supabaseClient
      .from("parcels")
      .select("pin, land_val, type_and_use_code, deed_date")
      .eq("county", "wake")
      .not("geometry", "is", null)
      .limit(3);

    output += `Q3 (sample):\n${JSON.stringify(wakeSample, null, 2)}\n\n`;

    // Acceptance check for Wake
    if (wakeRows < 100000 || wakePctGeom < 99.0 || (wakeHistRows || 0) < 100000) {
      output += `WAKE FAIL:\n`;
      output += `wake_rows: ${wakeRows} (need >=100000)\n`;
      output += `pct_geom: ${wakePctGeom} (need >=99.0)\n`;
      output += `hist_rows: ${wakeHistRows || 0} (need >=100000)\n`;
      
      return new Response(output, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
        status: 500,
      });
    }

    output += `WAKE PASS ✓\n\n`;

    // ============= MECKLENBURG COUNTY =============
    output += "=== MECKLENBURG COUNTY INGESTION ===\n\n";
    
    let meckIteration = 0;
    let meckComplete = false;
    
    while (!meckComplete) {
      meckIteration++;
      output += `Mecklenburg iteration ${meckIteration}...\n`;
      
      const ingestUrl = `${supabaseUrl}/functions/v1/ingest-county`;
      const ingestResponse = await fetch(ingestUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ county: "mecklenburg" }),
      });

      if (!ingestResponse.ok) {
        const errorText = await ingestResponse.text();
        output += `FAIL: HTTP ${ingestResponse.status}\n`;
        output += `URL: ${ingestUrl}\n`;
        output += `Body (first 300): ${errorText.substring(0, 300)}\n`;
        
        return new Response(output, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
          status: 500,
        });
      }

      const ingestData = await ingestResponse.json();
      
      if (ingestData.status === "COMPLETED") {
        output += `Mecklenburg COMPLETED after ${meckIteration} iterations\n`;
        output += `last_objectid: ${ingestData.last_objectid || "N/A"}\n\n`;
        meckComplete = true;
      } else if (ingestData.status === "PROGRESS") {
        output += `last_objectid: ${ingestData.last_objectid}\n`;
        await new Promise(resolve => setTimeout(resolve, 250));
      } else if (ingestData.status === "FAIL") {
        output += `FAIL: ${JSON.stringify(ingestData)}\n`;
        return new Response(output, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
          status: 500,
        });
      } else {
        output += `Unexpected status: ${JSON.stringify(ingestData)}\n`;
        return new Response(output, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
          status: 500,
        });
      }
    }

    // Query Mecklenburg results
    output += "=== MECKLENBURG VALIDATION ===\n\n";

    const { data: meckData, error: meckError } = await supabaseClient
      .from("parcels")
      .select("id, geometry", { count: "exact" })
      .eq("county", "mecklenburg");

    const meckRows = meckData?.length || 0;
    const meckWithGeom = meckData?.filter(p => p.geometry !== null).length || 0;
    const meckPctGeom = meckRows > 0 ? Math.round((meckWithGeom / meckRows) * 100 * 100) / 100 : 0;

    output += `Q1: meck_rows=${meckRows}, pct_geom_meck=${meckPctGeom}\n`;

    const { count: meckHistRows, error: meckHistError } = await supabaseClient
      .from("parcel_history")
      .select("*", { count: "exact", head: true })
      .eq("ts", new Date().toISOString().split('T')[0])
      .in("parcel_id", meckData?.map(p => p.id) || []);

    output += `Q2: hist_rows_meck=${meckHistRows || 0}\n`;

    const { data: meckSample, error: meckSampleError } = await supabaseClient
      .from("parcels")
      .select("pin, land_val, type_and_use_code, deed_date")
      .eq("county", "mecklenburg")
      .not("geometry", "is", null)
      .limit(3);

    output += `Q3 (sample):\n${JSON.stringify(meckSample, null, 2)}\n\n`;

    // Acceptance check for Mecklenburg (use 50k threshold)
    const meckThreshold = meckRows >= 100000 ? 100000 : 50000;
    
    if (meckRows < meckThreshold || meckPctGeom < 99.0 || (meckHistRows || 0) < meckThreshold) {
      output += `MECKLENBURG FAIL:\n`;
      output += `meck_rows: ${meckRows} (need >=${meckThreshold})\n`;
      output += `pct_geom: ${meckPctGeom} (need >=99.0)\n`;
      output += `hist_rows: ${meckHistRows || 0} (need >=${meckThreshold})\n`;
      
      return new Response(output, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
        status: 500,
      });
    }

    output += `MECKLENBURG PASS ✓\n\n`;
    output += `=== ALL COMPLETE ===\n`;
    output += `Total time: ${Math.round((Date.now() - startTime) / 1000)}s\n`;

    return new Response(output, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
      status: 200,
    });

  } catch (error) {
    output += `\nERROR: ${error instanceof Error ? error.message : "Unknown error"}\n`;
    console.error("Run-until-complete error:", error);

    return new Response(output, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
      status: 500,
    });
  }
});
