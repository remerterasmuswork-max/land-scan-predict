-- ============================================
-- 1) EXTEND PARCELS TABLE
-- ============================================
ALTER TABLE parcels
ADD COLUMN IF NOT EXISTS calc_area_acres NUMERIC,
ADD COLUMN IF NOT EXISTS deed_acres NUMERIC,
ADD COLUMN IF NOT EXISTS bldg_val NUMERIC,
ADD COLUMN IF NOT EXISTS land_val NUMERIC,
ADD COLUMN IF NOT EXISTS total_value_assd NUMERIC,
ADD COLUMN IF NOT EXISTS type_and_use_code INTEGER,
ADD COLUMN IF NOT EXISTS type_use_decode TEXT,
ADD COLUMN IF NOT EXISTS land_code TEXT,
ADD COLUMN IF NOT EXISTS billing_class_decode TEXT,
ADD COLUMN IF NOT EXISTS sale_date DATE,
ADD COLUMN IF NOT EXISTS totsalprice NUMERIC,
ADD COLUMN IF NOT EXISTS owner_mailing_1 TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_2 TEXT;

ALTER TABLE parcels DROP CONSTRAINT IF EXISTS parcels_pin_county_unique;
ALTER TABLE parcels ADD CONSTRAINT parcels_pin_county_unique UNIQUE (pin, county);

CREATE INDEX IF NOT EXISTS parcels_geometry_idx ON parcels USING GIST (geometry);
CREATE INDEX IF NOT EXISTS parcels_centroid_idx ON parcels USING GIST (centroid);

-- ============================================
-- 2) FIX PARCEL_HISTORY
-- ============================================
ALTER TABLE parcel_history
ADD COLUMN IF NOT EXISTS ts DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS total_value_assd NUMERIC,
ADD COLUMN IF NOT EXISTS type_and_use_code INTEGER,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ingest';

UPDATE parcel_history SET ts = COALESCE(DATE(created_at), '2024-01-01'::DATE) WHERE ts IS NULL;
ALTER TABLE parcel_history ALTER COLUMN ts SET NOT NULL;

DELETE FROM parcel_history a 
USING parcel_history b
WHERE a.id > b.id 
  AND a.parcel_id = b.parcel_id 
  AND a.ts = b.ts;

ALTER TABLE parcel_history DROP CONSTRAINT IF EXISTS parcel_history_parcel_ts_unique;
ALTER TABLE parcel_history ADD CONSTRAINT parcel_history_parcel_ts_unique UNIQUE (parcel_id, ts);
ALTER TABLE parcel_history DROP COLUMN IF EXISTS year CASCADE;

-- ============================================
-- 3) FIX PARCEL_SCORES - Convert 0-100 to 0-1
-- ============================================
-- First convert existing 0-100 values to 0-1
UPDATE parcel_scores 
SET rezoning_probability = rezoning_probability / 100 
WHERE rezoning_probability > 1;

UPDATE parcel_scores 
SET investment_score = investment_score / 100 
WHERE investment_score > 1;

UPDATE parcel_scores
SET land_value_yoy_change = land_value_yoy_change / 100
WHERE land_value_yoy_change > 1;

-- Drop old constraints
ALTER TABLE parcel_scores DROP CONSTRAINT IF EXISTS parcel_scores_rezoning_probability_check;
ALTER TABLE parcel_scores DROP CONSTRAINT IF EXISTS parcel_scores_investment_score_check;

-- Add new constraints for 0-1 range
ALTER TABLE parcel_scores
ADD CONSTRAINT parcel_scores_rezoning_probability_check 
  CHECK (rezoning_probability IS NULL OR (rezoning_probability BETWEEN 0 AND 1)),
ADD CONSTRAINT parcel_scores_investment_score_check
  CHECK (investment_score IS NULL OR (investment_score BETWEEN 0 AND 1));

ALTER TABLE parcel_scores
ADD COLUMN IF NOT EXISTS undervaluation_pct NUMERIC,
ADD COLUMN IF NOT EXISTS adjacent_upzone_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS features JSONB,
ADD COLUMN IF NOT EXISTS explanations JSONB;

-- ============================================
-- 4) CREATE ZONING AND INFRA TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS zoning_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county county_name NOT NULL,
  zone_code TEXT NOT NULL,
  zone_desc TEXT,
  jurisdiction TEXT,
  effective_date DATE,
  geometry geometry(MultiPolygon, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zoning_layers_geometry_idx ON zoning_layers USING GIST (geometry);
CREATE INDEX IF NOT EXISTS zoning_layers_county_idx ON zoning_layers (county);

ALTER TABLE zoning_layers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view zoning layers" ON zoning_layers;
CREATE POLICY "Anyone can view zoning layers" ON zoning_layers FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS infrastructure_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county county_name NOT NULL,
  infra_type TEXT NOT NULL,
  name TEXT,
  description TEXT,
  status TEXT,
  effective_date DATE,
  geometry geometry(Geometry, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS infrastructure_geometry_idx ON infrastructure_layers USING GIST (geometry);
CREATE INDEX IF NOT EXISTS infrastructure_county_idx ON infrastructure_layers (county);
CREATE INDEX IF NOT EXISTS infrastructure_type_idx ON infrastructure_layers (infra_type);

ALTER TABLE infrastructure_layers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view infrastructure" ON infrastructure_layers;
CREATE POLICY "Anyone can view infrastructure" ON infrastructure_layers FOR SELECT USING (true);

-- ============================================
-- 5) ENABLE PGVECTOR & CREATE ZONING_TEXTS
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS zoning_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county county_name NOT NULL,
  zone_code TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  source_url TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zoning_texts_county_zone_idx ON zoning_texts (county, zone_code);

ALTER TABLE zoning_texts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view zoning texts" ON zoning_texts;
CREATE POLICY "Anyone can view zoning texts" ON zoning_texts FOR SELECT USING (true);

-- ============================================
-- 6) UPDATE INGESTION_JOBS
-- ============================================
ALTER TABLE ingestion_jobs
ADD COLUMN IF NOT EXISTS records_with_geometry INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS median_land_val NUMERIC,
ADD COLUMN IF NOT EXISTS null_audit JSONB;