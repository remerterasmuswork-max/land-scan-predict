-- Create parcel_yoy view for year-over-year analysis
CREATE OR REPLACE VIEW parcel_yoy AS
SELECT 
  a.parcel_id,
  a.ts AS ts_curr,
  b.ts AS ts_prev,
  a.land_value AS land_curr,
  b.land_value AS land_prev,
  CASE 
    WHEN b.land_value > 0 THEN (a.land_value - b.land_value) / b.land_value 
    ELSE NULL 
  END AS land_val_yoy,
  (a.type_and_use_code IS DISTINCT FROM b.type_and_use_code) AS use_change_flag
FROM parcel_history a
JOIN parcel_history b ON a.parcel_id = b.parcel_id 
  AND a.ts = (b.ts + INTERVAL '12 months');

-- Create materialized view for parcel-zoning joins
CREATE MATERIALIZED VIEW IF NOT EXISTS parcel_zoning_mv AS
SELECT 
  p.id AS parcel_id,
  p.pin,
  p.county,
  z.zone_code,
  z.zone_desc,
  z.jurisdiction
FROM parcels p
LEFT JOIN zoning_layers z ON z.county = p.county
  AND ST_Intersects(
    ST_SetSRID(p.centroid, 4326),
    ST_SetSRID(z.geometry::geometry, 4326)
  );

CREATE UNIQUE INDEX IF NOT EXISTS parcel_zoning_mv_parcel_id_idx ON parcel_zoning_mv(parcel_id);

-- Create materialized view for parcel-infrastructure distance calculations
CREATE MATERIALIZED VIEW IF NOT EXISTS parcel_infra_mv AS
SELECT 
  p.id AS parcel_id,
  p.pin,
  p.county,
  COALESCE(
    MIN(
      ST_Distance(
        ST_SetSRID(p.centroid, 4326)::geography,
        ST_SetSRID(i.geometry::geometry, 4326)::geography
      )
    ) FILTER (WHERE i.infra_type = 'future_highway'),
    999999
  ) AS dist_future_highway_m,
  EXISTS(
    SELECT 1 FROM infrastructure_layers usa
    WHERE usa.county = p.county 
      AND usa.infra_type = 'urban_service_area'
      AND ST_Intersects(
        ST_SetSRID(p.centroid, 4326),
        ST_SetSRID(usa.geometry::geometry, 4326)
      )
  ) AS inside_urban_service_area
FROM parcels p
LEFT JOIN infrastructure_layers i ON i.county = p.county
GROUP BY p.id, p.pin, p.county, p.centroid;

CREATE UNIQUE INDEX IF NOT EXISTS parcel_infra_mv_parcel_id_idx ON parcel_infra_mv(parcel_id);

-- Create comprehensive signals materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS parcel_signals_mv AS
SELECT 
  p.id AS parcel_id,
  p.pin,
  p.county,
  p.acreage,
  p.land_val,
  p.total_value_assd,
  p.type_and_use_code,
  p.deed_date,
  p.owner_type,
  pz.zone_code,
  pz.zone_desc,
  pi.dist_future_highway_m,
  pi.inside_urban_service_area,
  yoy.land_val_yoy,
  yoy.use_change_flag,
  yoy.ts_curr,
  yoy.ts_prev
FROM parcels p
LEFT JOIN parcel_zoning_mv pz ON pz.parcel_id = p.id
LEFT JOIN parcel_infra_mv pi ON pi.parcel_id = p.id
LEFT JOIN parcel_yoy yoy ON yoy.parcel_id = p.id;

CREATE UNIQUE INDEX IF NOT EXISTS parcel_signals_mv_parcel_id_idx ON parcel_signals_mv(parcel_id);
CREATE INDEX IF NOT EXISTS parcel_signals_mv_county_idx ON parcel_signals_mv(county);

-- Enable PostGIS for vector tiles
CREATE EXTENSION IF NOT EXISTS postgis;

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_parcel_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY parcel_zoning_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY parcel_infra_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY parcel_signals_mv;
END;
$$ LANGUAGE plpgsql;