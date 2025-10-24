import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Field mappings for each county's Esri REST API
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
    url: "https://mcmap.org/rest/services/CountyData/Parcels/MapServer/0",
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
    const nullAudit: Record<string, number> = {};

    while (true) {
      const url = `${config.url}/query?where=${config.where || "1=1"}&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=${batchSize}`;
      
      console.log(`Fetching batch at offset ${offset}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status} from ${url}`);
        console.error(`Response body: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        break;
      }

      // Process features
      const parcelsToInsert: any[] = [];
      const historyRecords: any[] = [];

      for (const feature of data.features) {
        const attrs = feature.properties;
        const geom = feature.geometry;

        // Skip if missing PIN
        if (!attrs[config.pin]) {
          console.error("Missing PIN field:", attrs);
          failed++;
          continue;
        }

        const parcel: any = {
          pin: attrs[config.pin],
          county: county.toLowerCase(),
          address: attrs[config.address] || null,
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
          city: attrs[config.city] || null,
          zip_code: attrs[config.zip_code] || null,
          acreage: attrs[config.acreage] || null,
        };

        // Track nulls
        for (const [key, value] of Object.entries(parcel)) {
          if (value === null) {
            nullAudit[key] = (nullAudit[key] || 0) + 1;
          }
        }

        // Store GeoJSON geometry
        if (geom && (geom.type === "Polygon" || geom.type === "MultiPolygon")) {
          withGeometry++;
          parcel.geojson = JSON.stringify(geom);
        }

        parcelsToInsert.push(parcel);
      }

      // Batch upsert with PostGIS geometry conversion
      const today = new Date().toISOString().split('T')[0];
      
      for (const parcel of parcelsToInsert) {
        try {
          if (parcel.geojson) {
            // Use raw SQL via RPC to insert with geometry
            const { data, error } = await supabaseClient.rpc("exec_raw_sql", {
              sql: `
                INSERT INTO parcels (
                  pin, county, address, land_val, bldg_val, total_value_assd,
                  type_and_use_code, type_use_decode, land_code, billing_class_decode,
                  deed_date, sale_date, totsalprice, owner_name, owner_mailing_1,
                  city, zip_code, acreage, geometry, centroid, calc_area_acres
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                  ST_SetSRID(ST_GeomFromGeoJSON($19), 4326),
                  ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($19), 4326)),
                  ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($19), 4326)::geography) / 4046.8564224
                )
                ON CONFLICT (pin, county) DO UPDATE SET
                  address = EXCLUDED.address,
                  land_val = EXCLUDED.land_val,
                  bldg_val = EXCLUDED.bldg_val,
                  total_value_assd = EXCLUDED.total_value_assd,
                  type_and_use_code = EXCLUDED.type_and_use_code,
                  type_use_decode = EXCLUDED.type_use_decode,
                  land_code = EXCLUDED.land_code,
                  billing_class_decode = EXCLUDED.billing_class_decode,
                  deed_date = EXCLUDED.deed_date,
                  sale_date = EXCLUDED.sale_date,
                  totsalprice = EXCLUDED.totsalprice,
                  owner_name = EXCLUDED.owner_name,
                  owner_mailing_1 = EXCLUDED.owner_mailing_1,
                  city = EXCLUDED.city,
                  zip_code = EXCLUDED.zip_code,
                  acreage = EXCLUDED.acreage,
                  geometry = EXCLUDED.geometry,
                  centroid = EXCLUDED.centroid,
                  calc_area_acres = EXCLUDED.calc_area_acres
                RETURNING id
              `,
              params: [
                parcel.pin, parcel.county, parcel.address, parcel.land_val, parcel.bldg_val,
                parcel.total_value_assd, parcel.type_and_use_code, parcel.type_use_decode,
                parcel.land_code, parcel.billing_class_decode, parcel.deed_date, parcel.sale_date,
                parcel.totsalprice, parcel.owner_name, parcel.owner_mailing_1, parcel.city,
                parcel.zip_code, parcel.acreage, parcel.geojson
              ]
            });

            if (error) {
              console.error("Insert error:", error);
              failed++;
              continue;
            }

            // Add history record
            historyRecords.push({
              parcel_id: data[0].id,
              ts: today,
              land_value: parcel.land_val,
              total_value_assd: parcel.total_value_assd,
              type_and_use_code: parcel.type_and_use_code,
              source: "ingest",
            });
          } else {
            // Insert without geometry
            const { data: inserted, error } = await supabaseClient
              .from("parcels")
              .upsert([parcel], {
                onConflict: "pin,county",
                ignoreDuplicates: false,
              })
              .select("id")
              .single();

            if (error) {
              console.error("Insert error:", error);
              failed++;
              continue;
            }

            historyRecords.push({
              parcel_id: inserted.id,
              ts: today,
              land_value: parcel.land_val,
              total_value_assd: parcel.total_value_assd,
              type_and_use_code: parcel.type_and_use_code,
              source: "ingest",
            });
          }
        } catch (e) {
          console.error("Parcel insert failed:", e);
          failed++;
        }
      }

      // Batch insert history records
      if (historyRecords.length > 0) {
        await supabaseClient.from("parcel_history").upsert(historyRecords, {
          onConflict: "parcel_id,ts",
          ignoreDuplicates: true,
        });
      }

      processed += data.features.length;
      offset += batchSize;

      console.log(`Processed ${processed} parcels, ${withGeometry} with geometry, ${failed} failed`);

      // Add delay between batches to avoid CPU limits
      await new Promise(resolve => setTimeout(resolve, 200));

      // Safety break
      if (offset > 500000) break;
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
