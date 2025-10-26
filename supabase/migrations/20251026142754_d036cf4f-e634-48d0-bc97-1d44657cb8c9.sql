-- Create function to backfill Mecklenburg sale dates
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
  SET sale_date = COALESCE(
    parse_flex_date(raw_attrs->>'SALEDATE'),
    parse_flex_date(raw_attrs->>'SALE_DATE'),
    parse_flex_date(raw_attrs->>'saledate'),
    parse_flex_date(raw_attrs->>'sale_date')
  )
  WHERE county='mecklenburg' AND sale_date IS NULL;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

-- Create function to backfill Mecklenburg deed dates
CREATE OR REPLACE FUNCTION backfill_mecklenburg_deed_dates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE parcels
  SET deed_date = COALESCE(
    parse_flex_date(raw_attrs->>'DEEDDATE'),
    parse_flex_date(raw_attrs->>'RECORDED_DATE'),
    parse_flex_date(raw_attrs->>'deeddate'),
    parse_flex_date(raw_attrs->>'recorded_date')
  )
  WHERE county='mecklenburg';
  
  UPDATE parcels
  SET deed_date = NULL
  WHERE county='mecklenburg'
    AND deed_date = '2001-01-01'
    AND COALESCE(raw_attrs->>'DEEDDATE',raw_attrs->>'RECORDED_DATE',raw_attrs->>'deeddate',raw_attrs->>'recorded_date','') = '';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

-- Create function to backfill Mecklenburg ZIP codes  
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
    NULLIF(zip_code,''),
    NULLIF(raw_attrs->>'SITEZIP',''),
    NULLIF(raw_attrs->>'SITE_ZIP',''),
    NULLIF(raw_attrs->>'SZIP',''),
    NULLIF(raw_attrs->>'MZIP',''),
    NULLIF(raw_attrs->>'ZIP',''),
    NULLIF(raw_attrs->>'ZIPCODE','')
  )
  WHERE county='mecklenburg';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;