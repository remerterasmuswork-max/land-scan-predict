import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZONING_SOURCES: Record<string, any> = {
  wake: {
    url: "https://services.wakegov.com/arcgis/rest/services/Planning/Zoning/FeatureServer/0",
    zoneCodeField: "ZONING",
    zoneDescField: "ZONE_NAME",
    effectiveDateField: "EFFECTIVE_DATE",
  },
  durham: {
    url: "https://gisweb.durhamnc.gov/arcgis/rest/services/PublicServices/Planning/MapServer/12",
    zoneCodeField: "ZONE_CLASS",
    zoneDescField: "ZONE_DESC",
  },
  orange: {
    url: "https://gis.orangecountync.gov/arcgis/rest/services/WebZoningService/MapServer/0",
    zoneCodeField: "ZONE_CODE",
    zoneDescField: "ZONE_NAME",
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

    if (!county || !ZONING_SOURCES[county.toLowerCase()]) {
      throw new Error(`Zoning data not available for county: ${county}`);
    }

    console.log(`Loading zoning data for ${county}`);

    const config = ZONING_SOURCES[county.toLowerCase()];
    let processed = 0;
    let offset = 0;
    const batchSize = 1000;

    while (true) {
      const url = `${config.url}/query?where=1=1&outFields=*&returnGeometry=true&f=json&resultOffset=${offset}&resultRecordCount=${batchSize}`;
      
      console.log(`Fetching zoning batch at offset ${offset}`);
      const response = await fetch(url);
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        break;
      }

      const zones = data.features.map((feature: any) => {
        const attrs = feature.attributes;
        const geom = feature.geometry;

        return {
          county: county.toLowerCase(),
          zone_code: attrs[config.zoneCodeField] || "UNKNOWN",
          zone_desc: attrs[config.zoneDescField] || null,
          effective_date: attrs[config.effectiveDateField] 
            ? new Date(attrs[config.effectiveDateField]).toISOString().split('T')[0] 
            : null,
          geometry: geom ? JSON.stringify(geom) : null,
        };
      });

      // Upsert zoning data
      const { error: upsertError } = await supabaseClient
        .from("zoning_layers")
        .upsert(zones, {
          onConflict: "county,zone_code",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error("Zoning upsert error:", upsertError);
        throw upsertError;
      }

      processed += data.features.length;
      offset += batchSize;

      console.log(`Processed ${processed} zoning records so far`);

      // Safety break
      if (offset > 100000) break;
    }

    console.log(`Zoning load complete for ${county}: ${processed} records`);

    return new Response(
      JSON.stringify({
        success: true,
        county,
        processed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Zoning load error:", error);
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
