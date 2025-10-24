-- Fix function search path only (materialized views can't have RLS in PostgreSQL)
CREATE OR REPLACE FUNCTION refresh_parcel_views()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY parcel_zoning_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY parcel_infra_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY parcel_signals_mv;
END;
$$;