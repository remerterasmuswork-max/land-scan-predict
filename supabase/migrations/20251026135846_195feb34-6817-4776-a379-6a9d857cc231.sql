-- Add raw audit column to parcels
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS raw_attrs jsonb;

-- Safe date parser: supports YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, and epoch millis
CREATE OR REPLACE FUNCTION public.parse_flex_date(p_text text)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  d date;
  n numeric;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;

  -- epoch millis
  BEGIN
    n := p_text::numeric;
    IF n > 10000000000 THEN
      RETURN to_timestamp(n/1000)::date;
    ELSIF n BETWEEN 1000000000 AND 9999999999 THEN
      RETURN to_timestamp(n)::date;
    END IF;
  EXCEPTION WHEN others THEN
    -- not numeric, continue
  END;

  -- direct ISO
  BEGIN
    d := p_text::date; RETURN d;
  EXCEPTION WHEN others THEN
    -- try common formats
  END;
  BEGIN
    d := to_date(p_text,'YYYY/MM/DD'); RETURN d;
  EXCEPTION WHEN others THEN
  END;
  BEGIN
    d := to_date(p_text,'MM/DD/YYYY'); RETURN d;
  EXCEPTION WHEN others THEN
  END;

  RETURN NULL; -- never silently force 2001
END;
$$;

-- Harden the RPC to store raw + parse dates + fix ZIP
DROP FUNCTION IF EXISTS public.insert_parcel_with_geojson;
CREATE OR REPLACE FUNCTION public.insert_parcel_with_geojson(
  p_pin text,
  p_county public.county_name,
  p_geom_geojson jsonb,
  p_address text,
  p_city text,
  p_zip_any text,
  p_calc_area_acres numeric,
  p_land_val numeric,
  p_bldg_val numeric,
  p_total_value_assd numeric,
  p_type_and_use_code int,
  p_type_use_decode text,
  p_land_code text,
  p_billing_class_decode text,
  p_deed_any text,
  p_sale_any text,
  p_totsalprice numeric,
  p_owner_name text,
  p_owner_mailing_1 text,
  p_raw_attrs jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_geom geometry;
  v_id uuid;
  v_zip text;
  v_deed date;
  v_sale date;
BEGIN
  v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geom_geojson::text),4326);
  v_zip  := NULLIF(btrim(p_zip_any), '');
  v_deed := parse_flex_date(p_deed_any);
  v_sale := parse_flex_date(p_sale_any);

  INSERT INTO public.parcels(
    pin, county, geometry, centroid, calc_area_acres,
    address, city, zip_code,
    land_val, bldg_val, total_value_assd,
    type_and_use_code, type_use_decode, land_code, billing_class_decode,
    deed_date, sale_date, totsalprice,
    owner_name, owner_mailing_1, raw_attrs
  )
  VALUES(
    p_pin, p_county, v_geom, ST_Centroid(v_geom),
    COALESCE(p_calc_area_acres, ST_Area(v_geom::geography)/4046.8564224),
    NULLIF(p_address,''), NULLIF(p_city,''), v_zip,
    p_land_val, p_bldg_val, p_total_value_assd,
    p_type_and_use_code, NULLIF(p_type_use_decode,''), NULLIF(p_land_code,''), NULLIF(p_billing_class_decode,''),
    v_deed, v_sale, p_totsalprice,
    NULLIF(p_owner_name,''), NULLIF(p_owner_mailing_1,''), p_raw_attrs
  )
  ON CONFLICT (pin, county) DO UPDATE SET
    geometry             = EXCLUDED.geometry,
    centroid             = EXCLUDED.centroid,
    calc_area_acres      = EXCLUDED.calc_area_acres,
    address              = EXCLUDED.address,
    city                 = EXCLUDED.city,
    zip_code             = COALESCE(EXCLUDED.zip_code, parcels.zip_code),
    land_val             = EXCLUDED.land_val,
    bldg_val             = EXCLUDED.bldg_val,
    total_value_assd     = EXCLUDED.total_value_assd,
    type_and_use_code    = EXCLUDED.type_and_use_code,
    type_use_decode      = EXCLUDED.type_use_decode,
    land_code            = EXCLUDED.land_code,
    billing_class_decode = EXCLUDED.billing_class_decode,
    deed_date            = COALESCE(EXCLUDED.deed_date, parcels.deed_date),
    sale_date            = COALESCE(EXCLUDED.sale_date, parcels.sale_date),
    totsalprice          = EXCLUDED.totsalprice,
    owner_name           = EXCLUDED.owner_name,
    owner_mailing_1      = EXCLUDED.owner_mailing_1,
    raw_attrs            = COALESCE(parcels.raw_attrs, EXCLUDED.raw_attrs),
    updated_at           = now()
  RETURNING id INTO v_id;

  INSERT INTO public.parcel_history (parcel_id, ts, land_value, total_value_assd, type_and_use_code, source)
  VALUES (v_id, current_date, p_land_val, p_total_value_assd, p_type_and_use_code, 'ingest')
  ON CONFLICT (parcel_id, ts) DO NOTHING;

  RETURN v_id;
END;
$$;