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

    const { county } = await req.json();

    if (!county) {
      throw new Error("County parameter is required");
    }

    console.log(`Starting ingestion for ${county} county`);

    // Create/update ingestion job
    const { data: job, error: jobError } = await supabaseClient
      .from("ingestion_jobs")
      .insert({
        county,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // County-specific Esri REST endpoints
    const endpoints: Record<string, string> = {
      wake: "https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0",
      mecklenburg: "https://parcelviewer.geodecisions.com/arcgis/rest/services/Charlotte/Public/MapServer/0",
      durham: "https://webgis.durhamnc.gov/server/rest/services/PublicServices/Property/MapServer/0",
      orange: "https://gis.orangecountync.gov/arcgis/rest/services/WebMainService/MapServer/0",
      chatham: "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0",
    };

    const endpoint = endpoints[county.toLowerCase()];
    if (!endpoint) {
      throw new Error(`No endpoint configured for ${county} county`);
    }

    // Fetch parcels from Esri REST API
    const queryParams = new URLSearchParams({
      where: county.toLowerCase() === "chatham" ? "COUNTY='CHATHAM'" : "1=1",
      outFields: "*",
      returnGeometry: "true",
      f: "json",
      resultRecordCount: "1000", // Limit for demo - production should paginate
    });

    console.log(`Fetching from: ${endpoint}/query?${queryParams}`);
    
    const response = await fetch(`${endpoint}/query?${queryParams}`);
    const data = await response.json();

    if (!data.features) {
      throw new Error(`No features returned from ${county} county endpoint`);
    }

    console.log(`Fetched ${data.features.length} parcels from ${county}`);

    let processed = 0;
    let failed = 0;
    let withGeometry = 0;
    const landValues: number[] = [];

    // Process each parcel
    for (const feature of data.features) {
      try {
        const attrs = feature.attributes;
        const geom = feature.geometry;

        // Map county-specific field names to our schema
        const pin = attrs.PIN || attrs.PARCELPIN || attrs.REID || attrs.PARCEL_ID || String(attrs.OBJECTID);
        const address = attrs.SITEADDRES || attrs.ADDR1 || attrs.ADDRESS || attrs.SITE_ADDR;
        const city = attrs.CITY || attrs.MUNICIPA || attrs.MUNICIPALITY;
        const zip = attrs.ZIPCODE || attrs.ZIP || attrs.ZIP_CODE;
        
        const acreage = parseFloat(attrs.ACREAGE || attrs.CALC_AREA || attrs.ACRES || 0);
        const landVal = parseFloat(attrs.LAND_VAL || attrs.LANDVALUE || attrs.LAND_VALUE || 0);
        const bldgVal = parseFloat(attrs.BLDG_VAL || attrs.BUILDINGVALUE || attrs.BLDG_VALUE || 0);
        const totalVal = parseFloat(attrs.TOTAL_VALUE_ASSD || attrs.TOTALVALUE || attrs.TOTAL_VALUE || 0);
        
        const typeAndUse = parseInt(attrs.TYPE_AND_USE || attrs.TYPE_USE || attrs.TYPEUSE || 0);
        const typeUseDecode = attrs.TYPE_USE_DECODE || attrs.TYPE_DESC || attrs.TYPE_DECODE || null;
        const landCode = attrs.LAND_CODE || attrs.LANDCODE || null;
        const billingClass = attrs.BILLING_CLASS_DECODE || attrs.CLASS_DECODE || null;
        
        const deedDate = attrs.DEED_DATE || attrs.DEEDDATE || null;
        const saleDate = attrs.SALE_DATE || attrs.SALEDATE || null;
        const salePrice = parseFloat(attrs.TOTSALPRICE || attrs.SALEPRICE || attrs.SALE_PRICE || 0);
        
        const ownerName = attrs.OWNER || attrs.OWNERNAME || attrs.OWNER_NAME || null;
        const ownerMail1 = attrs.ADDR1 || attrs.MAIL_ADDR1 || null;
        const ownerMail2 = attrs.ADDR2 || attrs.MAIL_ADDR2 || null;

        if (landVal > 0) landValues.push(landVal);

        // Convert Esri geometry to WKT
        let wkt = null;
        let centroidWkt = null;
        
        if (geom) {
          withGeometry++;
          if (geom.rings) {
            // Polygon
            const rings = geom.rings.map((ring: number[][]) => 
              "(" + ring.map((pt: number[]) => `${pt[0]} ${pt[1]}`).join(",") + ")"
            ).join(",");
            wkt = `SRID=4326;POLYGON(${rings})`;
            
            // Calculate centroid (simple average of first ring)
            const firstRing = geom.rings[0];
            const sumX = firstRing.reduce((sum: number, pt: number[]) => sum + pt[0], 0);
            const sumY = firstRing.reduce((sum: number, pt: number[]) => sum + pt[1], 0);
            const centX = sumX / firstRing.length;
            const centY = sumY / firstRing.length;
            centroidWkt = `SRID=4326;POINT(${centX} ${centY})`;
          } else if (geom.x && geom.y) {
            // Point
            centroidWkt = `SRID=4326;POINT(${geom.x} ${geom.y})`;
          }
        }

        // Upsert parcel
        const { data: parcel, error: parcelError } = await supabaseClient
          .from("parcels")
          .upsert({
            pin,
            county: county.toLowerCase(),
            address,
            city,
            zip_code: zip,
            geometry: wkt,
            centroid: centroidWkt,
            acreage,
            calc_area_acres: acreage,
            land_val: landVal,
            bldg_val: bldgVal,
            total_value_assd: totalVal,
            type_and_use_code: typeAndUse,
            type_use_decode: typeUseDecode,
            land_code: landCode,
            billing_class_decode: billingClass,
            deed_date: deedDate ? new Date(deedDate).toISOString().split('T')[0] : null,
            sale_date: saleDate ? new Date(saleDate).toISOString().split('T')[0] : null,
            totsalprice: salePrice,
            owner_name: ownerName,
            owner_mailing_1: ownerMail1,
            owner_mailing_2: ownerMail2,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "pin,county",
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (parcelError) {
          console.error(`Error upserting parcel ${pin}:`, parcelError);
          failed++;
          continue;
        }

        // Insert history snapshot
        await supabaseClient
          .from("parcel_history")
          .insert({
            parcel_id: parcel.id,
            ts: new Date().toISOString().split('T')[0],
            land_value: landVal,
            total_value_assd: totalVal,
            type_and_use_code: typeAndUse,
            type_use_decode: typeUseDecode,
            source: "ingest",
          })
          .select()
          .single();

        processed++;
      } catch (err) {
        console.error("Error processing parcel:", err);
        failed++;
      }
    }

    // Calculate statistics
    const medianLandVal = landValues.length > 0
      ? landValues.sort((a, b) => a - b)[Math.floor(landValues.length / 2)]
      : 0;

    // Update job status
    await supabaseClient
      .from("ingestion_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_processed: processed,
        records_failed: failed,
        records_with_geometry: withGeometry,
        median_land_val: medianLandVal,
      })
      .eq("id", job.id);

    // Update county record
    await supabaseClient
      .from("counties")
      .update({
        last_ingestion_date: new Date().toISOString(),
        total_parcels: processed,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("name", county.toLowerCase());

    console.log(`Ingestion complete for ${county}: ${processed} processed, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        county,
        processed,
        failed,
        withGeometry,
        medianLandVal,
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
