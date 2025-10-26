-- Increase statement timeout for backfill functions to allow long-running batch operations
-- These functions process 200K+ rows in batches of 5000

CREATE OR REPLACE FUNCTION backfill_mecklenburg_sale_dates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '180s'  -- 3 minutes
AS $$
DECLARE
  rows_updated integer := 0;
  batch_size integer := 5000;
  total_updated integer := 0;
  batch_count integer := 0;
BEGIN
  LOOP
    UPDATE parcels
    SET sale_date = parse_flex_date(raw_attrs->>'saledate')
    WHERE county = 'mecklenburg'
      AND id IN (
        SELECT id FROM parcels
        WHERE county = 'mecklenburg'
          AND (sale_date IS NULL OR sale_date != parse_flex_date(raw_attrs->>'saledate'))
        LIMIT batch_size
      );
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    total_updated := total_updated + rows_updated;
    batch_count := batch_count + 1;
    
    RAISE NOTICE 'Sale dates batch %: updated % rows (total: %)', batch_count, rows_updated, total_updated;
    
    EXIT WHEN rows_updated = 0;
  END LOOP;
  
  RETURN total_updated;
END;
$$;

CREATE OR REPLACE FUNCTION backfill_mecklenburg_deed_dates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '180s'  -- 3 minutes
AS $$
DECLARE
  rows_updated integer := 0;
  batch_size integer := 5000;
  total_updated integer := 0;
  batch_count integer := 0;
BEGIN
  LOOP
    UPDATE parcels
    SET deed_date = parse_flex_date(raw_attrs->>'deeddate')
    WHERE county = 'mecklenburg'
      AND id IN (
        SELECT id FROM parcels
        WHERE county = 'mecklenburg'
          AND (deed_date IS NULL OR deed_date != parse_flex_date(raw_attrs->>'deeddate'))
        LIMIT batch_size
      );
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    total_updated := total_updated + rows_updated;
    batch_count := batch_count + 1;
    
    RAISE NOTICE 'Deed dates batch %: updated % rows (total: %)', batch_count, rows_updated, total_updated;
    
    EXIT WHEN rows_updated = 0;
  END LOOP;
  
  RETURN total_updated;
END;
$$;

CREATE OR REPLACE FUNCTION backfill_mecklenburg_zips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '180s'  -- 3 minutes
AS $$
DECLARE
  rows_updated integer := 0;
  batch_size integer := 5000;
  total_updated integer := 0;
  batch_count integer := 0;
  new_zip text;
BEGIN
  LOOP
    UPDATE parcels
    SET zip_code = COALESCE(
      NULLIF(raw_attrs->>'szip',''),
      NULLIF(raw_attrs->>'mzip','')
    )
    WHERE county = 'mecklenburg'
      AND id IN (
        SELECT id FROM parcels
        WHERE county = 'mecklenburg'
          AND (
            zip_code IS NULL 
            OR zip_code = ''
            OR zip_code != COALESCE(NULLIF(raw_attrs->>'szip',''), NULLIF(raw_attrs->>'mzip',''))
          )
        LIMIT batch_size
      );
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    total_updated := total_updated + rows_updated;
    batch_count := batch_count + 1;
    
    RAISE NOTICE 'ZIP codes batch %: updated % rows (total: %)', batch_count, rows_updated, total_updated;
    
    EXIT WHEN rows_updated = 0;
  END LOOP;
  
  RETURN total_updated;
END;
$$;