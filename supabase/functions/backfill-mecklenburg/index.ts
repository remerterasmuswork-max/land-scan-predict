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

    console.log("Running Mecklenburg backfills...");

    // Execute backfill functions
    const { data: saleData, error: saleError } = await supabaseClient.rpc(
      "backfill_mecklenburg_sale_dates"
    );
    if (saleError) throw saleError;
    console.log(`Sale dates updated: ${saleData} rows`);

    const { data: deedData, error: deedError } = await supabaseClient.rpc(
      "backfill_mecklenburg_deed_dates"
    );
    if (deedError) throw deedError;
    console.log(`Deed dates updated: ${deedData} rows`);

    const { data: zipData, error: zipError } = await supabaseClient.rpc(
      "backfill_mecklenburg_zips"
    );
    if (zipError) throw zipError;
    console.log(`ZIP codes updated: ${zipData} rows`);

    // Run validation queries
    const { data: countsData, error: countsError } = await supabaseClient
      .from("parcels")
      .select("id, geometry", { count: "exact" })
      .eq("county", "mecklenburg");
    
    if (countsError) throw countsError;

    const totalRows = countsData?.length || 0;
    const withGeom = countsData?.filter(p => p.geometry !== null).length || 0;
    const pctGeom = totalRows > 0 ? Math.round((withGeom / totalRows) * 100 * 100) / 100 : 0;

    // Deed date quality check
    const { data: deedStats, error: deedStatsError } = await supabaseClient
      .from("parcels")
      .select("deed_date")
      .eq("county", "mecklenburg");
    
    if (deedStatsError) throw deedStatsError;

    const deedDates = deedStats?.map(p => p.deed_date).filter(d => d) || [];
    const minDeed = deedDates.length > 0 ? deedDates.reduce((min, d) => d < min ? d : min) : null;
    const maxDeed = deedDates.length > 0 ? deedDates.reduce((max, d) => d > max ? d : max) : null;
    const nullDeed = deedStats?.filter(p => !p.deed_date).length || 0;
    const dummy2001 = deedStats?.filter(p => p.deed_date === '2001-01-01').length || 0;

    // ZIP coverage
    const { data: zipData2, error: zipError2 } = await supabaseClient
      .from("parcels")
      .select("zip_code", { count: "exact" })
      .eq("county", "mecklenburg")
      .not("zip_code", "is", null)
      .neq("zip_code", "");
    
    if (zipError2) throw zipError2;
    const withZip = zipData2?.length || 0;

    // Random sample
    const { data: sampleData, error: sampleError } = await supabaseClient
      .from("parcels")
      .select("pin, address, city, zip_code, type_use_decode, sale_date, deed_date")
      .eq("county", "mecklenburg")
      .limit(5);
    
    if (sampleError) throw sampleError;

    // Acceptance gates
    const minRows = 50000;
    const minHistRatio = 0.95;
    const maxDummy2001Pct = 0.05;
    const minZipPct = 0.70;

    const dummy2001Pct = totalRows > 0 ? dummy2001 / totalRows : 0;
    const zipPct = totalRows > 0 ? withZip / totalRows : 0;

    const results: any = {
      status: "SUCCESS",
      backfill_results: {
        sale_rows_updated: saleData,
        deed_rows_updated: deedData,
        zip_rows_updated: zipData,
      },
      validation: {
        A_counts_geometry: {
          meck_rows: totalRows,
          geom_rows: withGeom,
          pct_geom: pctGeom,
        },
        B_deed_quality: {
          min_deed: minDeed,
          max_deed: maxDeed,
          null_deed: nullDeed,
          dummy_2001: dummy2001,
        },
        C_zip_coverage: {
          with_zip: withZip,
        },
        D_random_sample: sampleData,
      },
      acceptance: {
        pct_geom_pass: pctGeom >= 99.0,
        dummy_2001_pass: dummy2001Pct <= maxDummy2001Pct,
        zip_coverage_pass: zipPct >= minZipPct,
        requirements: {
          pct_geom: ">=99.0",
          dummy_2001: `<=${maxDummy2001Pct * 100}% (${Math.floor(totalRows * maxDummy2001Pct)} rows)`,
          with_zip: `>=${minZipPct * 100}% (${Math.floor(totalRows * minZipPct)} rows)`,
        },
        actual: {
          pct_geom: pctGeom,
          dummy_2001_pct: Math.round(dummy2001Pct * 10000) / 100,
          zip_pct: Math.round(zipPct * 10000) / 100,
        },
      },
    };

    // Check if all acceptance criteria passed
    const allPassed = results.acceptance.pct_geom_pass &&
                     results.acceptance.dummy_2001_pass &&
                     results.acceptance.zip_coverage_pass;

    if (!allPassed) {
      results.status = "FAIL";
      
      // Get first offending row's raw_attrs
      const { data: offendingRow, error: offendingError } = await supabaseClient
        .from("parcels")
        .select("pin, raw_attrs")
        .eq("county", "mecklenburg")
        .limit(1)
        .single();
      
      if (!offendingError && offendingRow) {
        results.validation["E_offending_raw_attrs"] = offendingRow;
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: allPassed ? 200 : 500,
    });

  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
