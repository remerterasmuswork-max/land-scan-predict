import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Field mappings for each county's Esri REST API (FeatureServer with GeoJSON)
const FIELD_MAPS: Record<string, any> = {
  wake: {
    url: "https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/FeatureServer/0",
    pin: "PIN_NUM",
    address: "SITE_ADDRESS",
    land_val: "LAND_VAL",
    bldg_val: "BLDG_VAL",
    total_value_assd: "TOTAL_VALUE_ASSD",
    type_and_use_code: "TYPE_AND_USE",
    type_use_decode: "TYPE_USE_DECODE",
    land_code: "LAND_CODE",
    billing_class_decode: "BILLING_CLASS_DECODE",
    deed_date: "DEED_DATE",
    sale_date: "SALE_DATE",
    totsalprice: "TOTSALPRICE",
    owner_name: "OWNER",
    owner_mailing_1: "ADDR1",
    city: "CITY_DECODE",
    zip_code: "ZIPNUM",
    acreage: "REID_ACREAG",
  },
  mecklenburg: {
    url: "https://mcmap.org/rest/services/CountyData/Parcels/FeatureServer/0",
    pin: "PARCEL_ID",
    address: "SITE_ADDR",
    land_val: "LAND_VALUE",
    bldg_val: "BLDG_VALUE",
    total_value_assd: "TOTAL_VALUE",
    type_and_use_code: "USE_CODE",
    deed_date: "DEED_DATE",
    sale_date: "SALE_DATE",
    totsalprice: "SALE_PRICE",
    owner_name: "OWNER_NAME",
    acreage: "ACREAGE",
  },
  durham: {
    url: "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0",
    where: "COUNTY = 'DURHAM'",
    pin: "PIN",
    land_val: "LAND_VALUE",
    total_value_assd: "TOTAL_VALUE",
    deed_date: "DEED_DATE",
    owner_name: "OWNER_NAME",
  },
  orange: {
    url: "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0",
    where: "COUNTY = 'ORANGE'",
    pin: "PIN",
    land_val: "LAND_VALUE",
    total_value_assd: "TOTAL_VALUE",
    deed_date: "DEED_DATE",
    owner_name: "OWNER_NAME",
  },
  chatham: {
    url: "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0",
    where: "COUNTY = 'CHATHAM'",
    pin: "PIN",
    land_val: "LAND_VALUE",
    total_value_assd: "TOTAL_VALUE",
    deed_date: "DEED_DATE",
    owner_name: "OWNER_NAME",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 55000; // 55 seconds (leave 5s buffer)

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { county } = await req.json();

    if (!county || !FIELD_MAPS[county.toLowerCase()]) {
      throw new Error(`County ${county} not supported`);
    }

    const config = FIELD_MAPS[county.toLowerCase()];
    const countyLower = county.toLowerCase();

    // Check for existing job
    const { data: existingJobs } = await supabaseClient
      .from("ingestion_jobs")
      .select("*")
      .eq("county", countyLower)
      .eq("is_complete", false)
      .order("started_at", { ascending: false })
      .limit(1);

    let jobId: string;
    let cursor: number;

    if (existingJobs && existingJobs.length > 0) {
      // Resume existing job
      jobId = existingJobs[0].id;
      cursor = existingJobs[0].last_objectid || 0;
      console.log(`Resuming job ${jobId} from OBJECTID ${cursor}`);
      
      await supabaseClient.from("ingestion_jobs").update({
        status: "in_progress",
      }).eq("id", jobId);
    } else {
      // Create new job
      jobId = crypto.randomUUID();
      cursor = 0;
      console.log(`Starting new ingestion job ${jobId} for ${county}`);
      
      await supabaseClient.from("ingestion_jobs").insert({
        id: jobId,
        county: countyLower,
        status: "in_progress",
        started_at: new Date().toISOString(),
        last_objectid: 0,
        is_complete: false,
      });
    }

    let processed = 0;
    let withGeometry = 0;
    let failed = 0;
    const batchSize = 2000;
    const rpcBatchSize = 500;

    while ((Date.now() - startTime) < MAX_EXECUTION_TIME) {
      const whereClause = config.where 
        ? `(${config.where}) AND OBJECTID > ${cursor}`
        : `OBJECTID > ${cursor}`;
      
      const url = `${config.url}/query?where=${encodeURIComponent(whereClause)}&orderByFields=OBJECTID ASC&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultRecordCount=${batchSize}`;
      
      console.log(`Fetching batch from OBJECTID ${cursor}, URL: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status} from ${url}`);
        console.error(`Response body (first 300 chars): ${errorText.substring(0, 300)}`);
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 300)}`);
      }
      
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        console.log(`No more features after OBJECTID ${cursor}, marking complete`);
        
        // Mark job complete
        await supabaseClient.from("ingestion_jobs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          is_complete: true,
          records_processed: processed,
          records_failed: failed,
          records_with_geometry: withGeometry,
        }).eq("id", jobId);

        // Update county status
        await supabaseClient.from("counties").upsert({
          name: countyLower,
          status: "completed",
          last_ingestion_date: new Date().toISOString(),
        }, {
          onConflict: "name",
        });

        // Query final results using direct queries
        const { data: parcelsData, error: parcelsError } = await supabaseClient
          .from("parcels")
          .select("id, geometry", { count: "exact" })
          .eq("county", countyLower);

        const wakeRows = parcelsData?.length || 0;
        const withGeomCount = parcelsData?.filter(p => p.geometry !== null).length || 0;
        const pctGeom = wakeRows > 0 ? Math.round((withGeomCount / wakeRows) * 100 * 100) / 100 : 0;

        if (parcelsError) {
          console.error("Error querying parcels:", parcelsError);
        }

        const { count: histRows, error: histError } = await supabaseClient
          .from("parcel_history")
          .select("*", { count: "exact", head: true })
          .eq("ts", new Date().toISOString().split('T')[0])
          .in("parcel_id", parcelsData?.map(p => p.id) || []);

        if (histError) {
          console.error("Error querying history:", histError);
        }

        const { data: sampleData, error: sampleError } = await supabaseClient
          .from("parcels")
          .select("pin, land_val, type_and_use_code, deed_date")
          .eq("county", countyLower)
          .not("geometry", "is", null)
          .limit(3);

        if (sampleError) {
          console.error("Error querying samples:", sampleError);
        }

        console.log("=== FINAL RESULTS ===");
        console.log(`wake_rows: ${wakeRows}`);
        console.log(`pct_geom: ${pctGeom}`);
        console.log(`hist_rows: ${histRows || 0}`);
        console.log("Sample rows:", JSON.stringify(sampleData, null, 2));

        // Hard acceptance check
        if (wakeRows < 100000 || pctGeom < 99.0 || (histRows || 0) < 100000) {
          return new Response(
            JSON.stringify({
              status: "FAIL",
              reason: "Acceptance criteria not met",
              wake_rows: wakeRows,
              pct_geom: pctGeom,
              hist_rows: histRows || 0,
              requirements: { wake_rows: ">=100000", pct_geom: ">=99.0", hist_rows: ">=100000" },
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500,
            }
          );
        }

        return new Response(
          JSON.stringify({
            status: "COMPLETE",
            county,
            wake_rows: wakeRows,
            pct_geom: pctGeom,
            hist_rows: histRows || 0,
            sample_rows: sampleData,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      console.log(`Received ${data.features.length} features`);

      // Build batch payload for bulk RPC
      const payloadBatch: any[] = [];
      let maxObjectId = cursor;

      for (const feature of data.features) {
        const attrs = feature.properties;
        const geom = feature.geometry;
        const objectId = attrs.OBJECTID || attrs.objectid || attrs.ObjectId;

        if (objectId && objectId > maxObjectId) {
          maxObjectId = objectId;
        }

        // Skip if missing PIN
        if (!attrs[config.pin]) {
          console.error("Missing PIN field:", attrs);
          failed++;
          continue;
        }

        // Skip if no geometry
        if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) {
          console.error(`Invalid geometry type for PIN ${attrs[config.pin]}: ${geom?.type || 'null'}`);
          failed++;
          continue;
        }

        withGeometry++;

        const parcelPayload: any = {
          pin: attrs[config.pin],
          county: countyLower,
          geometry: geom,
          address: attrs[config.address] || null,
          city: attrs[config.city] || null,
          zip: attrs[config.zip_code] || null,
          calc_area_acres: null,
          land_val: attrs[config.land_val] || null,
          bldg_val: attrs[config.bldg_val] || null,
          total_value_assd: attrs[config.total_value_assd] || null,
          type_and_use_code: attrs[config.type_and_use_code] || null,
          type_use_decode: attrs[config.type_use_decode] || null,
          land_code: attrs[config.land_code] || null,
          billing_class_decode: attrs[config.billing_class_decode] || null,
          deed_date: attrs[config.deed_date] ? new Date(attrs[config.deed_date]).toISOString().split('T')[0] : null,
          sale_date: attrs[config.sale_date] ? new Date(attrs[config.sale_date]).toISOString().split('T')[0] : null,
          totsalprice: attrs[config.totsalprice] || null,
          owner_name: attrs[config.owner_name] || null,
          owner_mailing_1: attrs[config.owner_mailing_1] || null,
        };

        payloadBatch.push(parcelPayload);
      }

      // Send in chunks to bulk RPC
      for (let i = 0; i < payloadBatch.length; i += rpcBatchSize) {
        const chunk = payloadBatch.slice(i, i + rpcBatchSize);

        try {
          const { data: insertedCount, error } = await supabaseClient.rpc("bulk_insert_parcels_with_geojson", {
            p_payload: chunk,
          });

          if (error) {
            console.error(`RPC error:`, error);
            failed += chunk.length;
          } else {
            console.log(`Inserted ${insertedCount} parcels via RPC`);
          }
        } catch (e) {
          console.error(`RPC call failed:`, e);
          failed += chunk.length;
        }
      }

      processed += data.features.length;
      cursor = maxObjectId;

      console.log(`Processed ${processed} in this run, cursor now at OBJECTID ${cursor}, ${withGeometry} with geometry, ${failed} failed`);

      // Update job progress
      await supabaseClient.from("ingestion_jobs").update({
        last_objectid: cursor,
        records_processed: processed,
        records_failed: failed,
        records_with_geometry: withGeometry,
      }).eq("id", jobId);

      // Short delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Time limit reached, persist progress and exit
    console.log(`Time limit reached. Processed ${processed} parcels this run, cursor at OBJECTID ${cursor}`);
    
    await supabaseClient.from("ingestion_jobs").update({
      status: "in_progress",
      last_objectid: cursor,
      records_processed: processed,
      records_failed: failed,
      records_with_geometry: withGeometry,
    }).eq("id", jobId);

    return new Response(
      JSON.stringify({
        status: "PROGRESS",
        county,
        processed,
        last_objectid: cursor,
        with_geometry: withGeometry,
        failed,
        message: `Processed ${processed} parcels. Resume to continue from OBJECTID ${cursor}.`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Ingestion error:", error);

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
