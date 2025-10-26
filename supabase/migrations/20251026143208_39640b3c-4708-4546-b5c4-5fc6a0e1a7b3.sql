-- Update backfill functions to use lowercase field names from raw_attrs
CREATE OR REPLACE FUNCTION backfill_mecklenburg_sale_dates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE parcels
  SET sale_date = parse_flex_date(raw_attrs->>'saledate')
  WHERE county='mecklenburg';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

CREATE OR REPLACE FUNCTION backfill_mecklenburg_zips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE parcels
  SET zip_code = COALESCE(
    NULLIF(raw_attrs->>'szip',''),
    NULLIF(raw_attrs->>'mzip','')
  )
  WHERE county='mecklenburg';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;