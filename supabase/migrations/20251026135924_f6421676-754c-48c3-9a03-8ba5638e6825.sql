-- Update bulk insert RPC to match new signature
DROP FUNCTION IF EXISTS public.bulk_insert_parcels_with_geojson;
CREATE OR REPLACE FUNCTION public.bulk_insert_parcels_with_geojson(p_payload jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_row jsonb;
  v_count int := 0;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_payload)
  LOOP
    PERFORM insert_parcel_with_geojson(
      p_pin                  := v_row->>'pin',
      p_county               := (v_row->>'county')::public.county_name,
      p_geom_geojson         := v_row->'geometry',
      p_address              := v_row->>'address',
      p_city                 := v_row->>'city',
      p_zip_any              := v_row->>'zip',
      p_calc_area_acres      := (v_row->>'calc_area_acres')::numeric,
      p_land_val             := (v_row->>'land_val')::numeric,
      p_bldg_val             := (v_row->>'bldg_val')::numeric,
      p_total_value_assd     := (v_row->>'total_value_assd')::numeric,
      p_type_and_use_code    := (v_row->>'type_and_use_code')::int,
      p_type_use_decode      := v_row->>'type_use_decode',
      p_land_code            := v_row->>'land_code',
      p_billing_class_decode := v_row->>'billing_class_decode',
      p_deed_any             := v_row->>'deed_date',
      p_sale_any             := v_row->>'sale_date',
      p_totsalprice          := (v_row->>'totsalprice')::numeric,
      p_owner_name           := v_row->>'owner_name',
      p_owner_mailing_1      := v_row->>'owner_mailing_1',
      p_raw_attrs            := v_row->'raw_attrs'
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;