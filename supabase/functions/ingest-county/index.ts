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

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { county } = await req.json();

    if (!county || !FIELD_MAPS[county.toLowerCase()]) {
      throw new Error(`County ${county} not supported`);
    }

    const jobId = crypto.randomUUID();
    const startTime = new Date().toISOString();
    
    console.log(`Starting ingestion for ${county}, job ${jobId}`);

    // Create ingestion job record
    await supabaseClient.from("ingestion_jobs").insert({
      id: jobId,
      county: county.toLowerCase(),
      status: "in_progress",
      started_at: startTime,
    });

    const config = FIELD_MAPS[county.toLowerCase()];
    
    let processed = 0;
    let withGeometry = 0;
    let failed = 0;
    let offset = 0;
    const batchSize = 2000;
    const rpcBatchSize = 500;
    const nullAudit: Record<string, number> = {};

    console.log(`Starting ingestion for ${county} from ${config.url}`);

    while (true) {
      const url = `${config.url}/query?where=${config.where || "1=1"}&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=${batchSize}`;
      
      console.log(`Fetching batch at offset ${offset}, URL: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status} from ${url}`);
        console.error(`Response body: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        console.log(`No more features at offset ${offset}, stopping`);
        break;
      }

      console.log(`Received ${data.features.length} features`);

      // Debug: log first feature for field inspection
      if (offset === 0 && data.features.length > 0) {
        console.log("FIRST FEATURE SAMPLE:", JSON.stringify(data.features[0], null, 2));
      }

      // Build batch payload for bulk RPC
      const payloadBatch: any[] = [];

      for (const feature of data.features) {
        const attrs = feature.properties;
        const geom = feature.geometry;

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
          county: county.toLowerCase(),
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

        // Track nulls
        for (const [key, value] of Object.entries(parcelPayload)) {
          if (value === null && key !== 'calc_area_acres' && key !== 'geometry') {
            nullAudit[key] = (nullAudit[key] || 0) + 1;
          }
        }

        payloadBatch.push(parcelPayload);
      }

      // Send in chunks to bulk RPC
      for (let i = 0; i < payloadBatch.length; i += rpcBatchSize) {
        const chunk = payloadBatch.slice(i, i + rpcBatchSize);
        
        if (i === 0 && offset === 0) {
          console.log("FIRST RPC PAYLOAD SAMPLE:", JSON.stringify(chunk[0], null, 2));
        }

        try {
          const { data: insertedCount, error } = await supabaseClient.rpc("bulk_insert_parcels_with_geojson", {
            p_payload: chunk,
          });

          if (error) {
            console.error(`RPC error for chunk at offset ${offset}:`, error);
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
      offset += batchSize;

      console.log(`Processed ${processed} total, ${withGeometry} with geometry, ${failed} failed`);

      // Add delay between batches to avoid CPU limits
      await new Promise(resolve => setTimeout(resolve, 200));

      // Safety break
      if (offset > 500000) {
        console.log("Safety break at 500k offset");
        break;
      }
    }

    // Calculate median land value
    const { data: medianData } = await supabaseClient
      .from("parcels")
      .select("land_val")
      .eq("county", county.toLowerCase())
      .not("land_val", "is", null)
      .order("land_val", { ascending: true })
      .limit(1)
      .range(Math.floor(processed / 2), Math.floor(processed / 2));

    const medianLandVal = medianData && medianData.length > 0 ? medianData[0].land_val : null;

    // Update ingestion job
    await supabaseClient.from("ingestion_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      records_processed: processed,
      records_failed: failed,
      records_with_geometry: withGeometry,
      median_land_val: medianLandVal,
      null_audit: nullAudit,
    }).eq("id", jobId);

    // Update county status
    await supabaseClient.from("counties").upsert({
      name: county.toLowerCase(),
      status: "completed",
      total_parcels: processed,
      last_ingestion_date: new Date().toISOString(),
    }, {
      onConflict: "name",
    });

    console.log(`Ingestion complete: ${processed} parcels, ${withGeometry} with geometry, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        county,
        processed,
        withGeometry,
        failed,
        medianLandVal,
        nullAudit,
        geometryRate: withGeometry / processed,
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
