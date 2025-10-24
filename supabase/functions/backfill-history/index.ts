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

    const { county, monthsBack = 24 } = await req.json();

    if (!county) {
      throw new Error("County parameter is required");
    }

    console.log(`Starting historical backfill for ${county} (${monthsBack} months)`);

    // Fetch current parcels
    const { data: parcels, error: parcelsError } = await supabaseClient
      .from("parcels")
      .select("id, pin, land_val, type_and_use_code, created_at")
      .eq("county", county.toLowerCase())
      .limit(10000);

    if (parcelsError) throw parcelsError;

    if (!parcels || parcels.length === 0) {
      return new Response(
        JSON.stringify({ error: "No parcels found for backfill" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`Backfilling ${parcels.length} parcels`);

    const historyRecords: any[] = [];
    const now = new Date();

    for (const parcel of parcels) {
      // Generate monthly snapshots going back
      for (let i = 0; i < monthsBack; i++) {
        const snapshotDate = new Date(now);
        snapshotDate.setMonth(snapshotDate.getMonth() - i);

        // Simulate historical land values with some variance
        // In production, this would pull from actual historical sources
        const variance = 1 + (Math.random() * 0.2 - 0.1); // ±10% variance
        const trendFactor = 1 + (i * 0.005); // ~0.5% monthly decline going back
        const historicalValue = parcel.land_val * variance * trendFactor;

        historyRecords.push({
          parcel_id: parcel.id,
          ts: snapshotDate.toISOString().split('T')[0],
          land_value: Math.round(historicalValue),
          type_and_use_code: parcel.type_and_use_code,
          source: "backfill",
        });

        // Batch insert every 500 records
        if (historyRecords.length >= 500) {
          await supabaseClient.from("parcel_history").upsert(historyRecords, {
            onConflict: "parcel_id,ts",
            ignoreDuplicates: true,
          });
          historyRecords.length = 0;
        }
      }
    }

    // Insert remaining records
    if (historyRecords.length > 0) {
      await supabaseClient.from("parcel_history").upsert(historyRecords, {
        onConflict: "parcel_id,ts",
        ignoreDuplicates: true,
      });
    }

    const totalRecords = parcels.length * monthsBack;

    console.log(`Backfill complete for ${county}: ${totalRecords} history records created`);

    return new Response(
      JSON.stringify({
        success: true,
        county,
        parcels: parcels.length,
        monthsBack,
        totalRecords,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Backfill error:", error);
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
