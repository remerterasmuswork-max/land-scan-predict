-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Single-row upsert from GeoJSON
DROP FUNCTION IF EXISTS public.insert_parcel_with_geojson;
CREATE OR REPLACE FUNCTION public.insert_parcel_with_geojson(
  p_pin text,
  p_county public.county_name,
  p_geom_geojson jsonb,
  p_address text,
  p_city text,
  p_zip text,
  p_calc_area_acres numeric,
  p_land_val numeric,
  p_bldg_val numeric,
  p_total_value_assd numeric,
  p_type_and_use_code int,
  p_type_use_decode text,
  p_land_code text,
  p_billing_class_decode text,
  p_deed_date date,
  p_sale_date date,
  p_totsalprice numeric,
  p_owner_name text,
  p_owner_mailing_1 text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_geom geometry;
  v_centroid geometry;
  v_id uuid;
BEGIN
  -- Convert GeoJSON -> geometry(Polygon/MultiPolygon,4326)
  v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geom_geojson::text), 4326);
  IF GeometryType(v_geom) NOT IN ('POLYGON','MULTIPOLYGON') THEN
    RAISE EXCEPTION 'Unsupported geom type: %', GeometryType(v_geom);
  END IF;

  v_centroid := ST_Centroid(v_geom);

  INSERT INTO public.parcels (
    pin, county, geometry, centroid,
    address, city, zip_code,
    calc_area_acres, land_val, bldg_val, total_value_assd,
    type_and_use_code, type_use_decode, land_code, billing_class_decode,
    deed_date, sale_date, totsalprice, owner_name, owner_mailing_1
  ) VALUES (
    p_pin, p_county, v_geom, v_centroid,
    p_address, p_city, p_zip,
    COALESCE(p_calc_area_acres, ST_Area(v_geom::geography)/4046.8564224),
    p_land_val, p_bldg_val, p_total_value_assd,
    p_type_and_use_code, p_type_use_decode, p_land_code, p_billing_class_decode,
    p_deed_date, p_sale_date, p_totsalprice, p_owner_name, p_owner_mailing_1
  )
  ON CONFLICT (pin, county) DO UPDATE SET
    geometry = EXCLUDED.geometry,
    centroid = EXCLUDED.centroid,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    zip_code = EXCLUDED.zip_code,
    calc_area_acres = EXCLUDED.calc_area_acres,
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
    updated_at = now()
  RETURNING id INTO v_id;

  -- snapshot into parcel_history (today)
  INSERT INTO public.parcel_history (parcel_id, ts, land_value, total_value_assd, type_and_use_code, source)
  VALUES (v_id, current_date, p_land_val, p_total_value_assd, p_type_and_use_code, 'ingest')
  ON CONFLICT (parcel_id, ts) DO NOTHING;

  RETURN v_id;
END;
$$;

-- 2. Batch helper RPC
DROP FUNCTION IF EXISTS public.bulk_insert_parcels_with_geojson;
CREATE OR REPLACE FUNCTION public.bulk_insert_parcels_with_geojson(p_payload jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_count int := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_payload)
  LOOP
    PERFORM public.insert_parcel_with_geojson(
      r->>'pin',
      (r->>'county')::public.county_name,
      r->'geometry',
      r->>'address',
      r->>'city',
      r->>'zip',
      (r->>'calc_area_acres')::numeric,
      (r->>'land_val')::numeric,
      (r->>'bldg_val')::numeric,
      (r->>'total_value_assd')::numeric,
      (r->>'type_and_use_code')::int,
      r->>'type_use_decode',
      r->>'land_code',
      r->>'billing_class_decode',
      (r->>'deed_date')::date,
      (r->>'sale_date')::date,
      (r->>'totsalprice')::numeric,
      r->>'owner_name',
      r->>'owner_mailing_1'
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Expose RPCs to PostgREST
GRANT EXECUTE ON FUNCTION public.insert_parcel_with_geojson(text, public.county_name, jsonb, text, text, text, numeric, numeric, numeric, numeric, int, text, text, text, date, date, numeric, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_insert_parcels_with_geojson(jsonb) TO anon, authenticated, service_role;