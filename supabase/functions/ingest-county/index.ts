import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Field mappings for each county's Esri REST API
const FIELD_MAPS: Record<string, any> = {
  wake: {
    url: "https://services.wakegov.com/arcgis/rest/services/RealEstate/Parcels/FeatureServer/0",
    pin: "PIN_NUM",
    address: "SITE_ADDRESS",
    land_val: "LAND_VAL",
    bldg_val: "BLDG_VAL",
    total_value_assd: "TOTAL_VALUE_ASSD",
    type_and_use_code: "TYPE_AND_USE",
    deed_date: "DEED_DATE",
    sale_date: "SALE_DATE",
    totsalprice: "TOTSALPRICE",
    owner_name: "OWNER",
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

    console.log(`Starting ingestion for ${county}`);

    const config = FIELD_MAPS[county.toLowerCase()];
    
    let processed = 0;
    let withGeometry = 0;
    let offset = 0;
    const batchSize = 1000;
    const nullAudit: Record<string, number> = {};

    while (true) {
      const url = `${config.url}/query?where=${config.where || "1=1"}&outFields=*&returnGeometry=true&f=json&resultOffset=${offset}&resultRecordCount=${batchSize}`;
      
      console.log(`Fetching batch at offset ${offset}`);
      const response = await fetch(url);
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        break;
      }

      const parcels = data.features.map((feature: any) => {
        const attrs = feature.attributes;
        const geom = feature.geometry;

        // Map fields
        const parcel: any = {
          pin: attrs[config.pin],
          county: county.toLowerCase(),
          address: attrs[config.address] || null,
          land_val: attrs[config.land_val] || null,
          bldg_val: attrs[config.bldg_val] || null,
          total_value_assd: attrs[config.total_value_assd] || null,
          type_and_use_code: attrs[config.type_and_use_code] || null,
          deed_date: attrs[config.deed_date] ? new Date(attrs[config.deed_date]).toISOString().split('T')[0] : null,
          sale_date: attrs[config.sale_date] ? new Date(attrs[config.sale_date]).toISOString().split('T')[0] : null,
          totsalprice: attrs[config.totsalprice] || null,
          owner_name: attrs[config.owner_name] || null,
          acreage: attrs[config.acreage] || null,
        };

        // Track nulls
        for (const [key, value] of Object.entries(parcel)) {
          if (value === null) {
            nullAudit[key] = (nullAudit[key] || 0) + 1;
          }
        }

        // Convert geometry to PostGIS format (simplified - just track if present)
        if (geom && (geom.rings || geom.x)) {
          withGeometry++;
          parcel.geometry = JSON.stringify(geom); // Store as JSON for now
          
          // Calculate centroid
          if (geom.rings) {
            const firstRing = geom.rings[0];
            if (firstRing && firstRing.length > 0) {
              const centerX = firstRing.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / firstRing.length;
              const centerY = firstRing.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / firstRing.length;
              parcel.centroid = `POINT(${centerX} ${centerY})`;
            }
          } else if (geom.x && geom.y) {
            parcel.centroid = `POINT(${geom.x} ${geom.y})`;
          }
        }

        return parcel;
      });

      // Upsert parcels
      const { error: upsertError } = await supabaseClient
        .from("parcels")
        .upsert(parcels, {
          onConflict: "pin,county",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw upsertError;
      }

      processed += data.features.length;
      offset += batchSize;

      console.log(`Processed ${processed} parcels so far`);

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

    console.log(`Ingestion complete for ${county}: ${processed} parcels, ${withGeometry} with geometry`);

    return new Response(
      JSON.stringify({
        success: true,
        county,
        processed,
        withGeometry,
        medianLandVal,
        nullAudit,
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
