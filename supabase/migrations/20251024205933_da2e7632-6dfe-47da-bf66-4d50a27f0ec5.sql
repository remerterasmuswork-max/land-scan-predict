-- Create function to generate vector tiles with proper MVT format
CREATE OR REPLACE FUNCTION get_tile_data(
  z_param integer,
  x_param integer,
  y_param integer,
  where_clause text DEFAULT 'TRUE'
)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result bytea;
BEGIN
  EXECUTE format('
    SELECT ST_AsMVT(tile, ''parcels'', 4096, ''geom'') 
    FROM (
      SELECT 
        p.pin,
        p.county,
        p.acreage,
        COALESCE(ps.rezoning_probability, 0) as rezoning_probability,
        COALESCE(ps.investment_score, 0) as investment_score,
        COALESCE(sig.land_val_yoy, 0) as land_val_yoy,
        COALESCE(sig.use_change_flag, false) as use_change_flag,
        ST_AsMVTGeom(
          ST_Transform(ST_SetSRID(p.geometry::geometry, 4326), 3857),
          ST_TileEnvelope(%s, %s, %s),
          4096,
          256,
          true
        ) AS geom
      FROM parcels p
      LEFT JOIN parcel_scores ps ON ps.parcel_id = p.id
      LEFT JOIN parcel_signals_mv sig ON sig.parcel_id = p.id
      LEFT JOIN parcel_infra_mv pi ON pi.parcel_id = p.id
      WHERE p.geometry IS NOT NULL
        AND ST_Transform(ST_SetSRID(p.geometry::geometry, 4326), 3857) && ST_TileEnvelope(%s, %s, %s)
        AND %s
    ) AS tile
  ', z_param, x_param, y_param, z_param, x_param, y_param, where_clause)
  INTO result;
  
  RETURN result;
END;
$$;