-- Function to insert parcels with PostGIS geometry from GeoJSON
CREATE OR REPLACE FUNCTION insert_parcel_with_geojson(
  p_pin text,
  p_county county_name,
  p_geojson text,
  p_address text DEFAULT NULL,
  p_land_val numeric DEFAULT NULL,
  p_bldg_val numeric DEFAULT NULL,
  p_total_value_assd numeric DEFAULT NULL,
  p_type_and_use_code integer DEFAULT NULL,
  p_type_use_decode text DEFAULT NULL,
  p_land_code text DEFAULT NULL,
  p_billing_class_decode text DEFAULT NULL,
  p_deed_date date DEFAULT NULL,
  p_sale_date date DEFAULT NULL,
  p_totsalprice numeric DEFAULT NULL,
  p_owner_name text DEFAULT NULL,
  p_owner_mailing_1 text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_acreage numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parcel_id uuid;
  v_geometry geometry;
BEGIN
  -- Convert GeoJSON to PostGIS geometry
  v_geometry := ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326);
  
  -- Upsert parcel
  INSERT INTO parcels (
    pin, county, address, land_val, bldg_val, total_value_assd,
    type_and_use_code, type_use_decode, land_code, billing_class_decode,
    deed_date, sale_date, totsalprice, owner_name, owner_mailing_1,
    city, zip_code, acreage, geometry, centroid, calc_area_acres
  ) VALUES (
    p_pin, p_county, p_address, p_land_val, p_bldg_val, p_total_value_assd,
    p_type_and_use_code, p_type_use_decode, p_land_code, p_billing_class_decode,
    p_deed_date, p_sale_date, p_totsalprice, p_owner_name, p_owner_mailing_1,
    p_city, p_zip_code, p_acreage, v_geometry, 
    ST_Centroid(v_geometry),
    ST_Area(v_geometry::geography) / 4046.8564224
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
    calc_area_acres = EXCLUDED.calc_area_acres,
    updated_at = now()
  RETURNING id INTO v_parcel_id;
  
  RETURN v_parcel_id;
END;
$$;