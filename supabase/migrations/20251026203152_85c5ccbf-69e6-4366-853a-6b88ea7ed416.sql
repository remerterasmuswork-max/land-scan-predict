-- ====================================
-- CRITICAL SECURITY FIXES
-- ====================================

-- 1. Create user roles infrastructure for role-based access control
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only admins can manage roles (will be enforced via edge functions)
CREATE POLICY "Service role can manage roles"
ON public.user_roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. FIX SQL INJECTION: Rewrite get_tile_data to accept discrete parameters
DROP FUNCTION IF EXISTS get_tile_data(integer, integer, integer, text);

CREATE OR REPLACE FUNCTION get_tile_data(
  z_param integer,
  x_param integer,
  y_param integer,
  county_filter text DEFAULT NULL,
  min_acres_filter numeric DEFAULT 0,
  min_prob_filter numeric DEFAULT 0,
  inside_usa_filter boolean DEFAULT false
)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result bytea;
  valid_counties text[] := ARRAY['wake', 'mecklenburg', 'durham', 'orange', 'chatham'];
  safe_county text;
BEGIN
  -- Validate county parameter against allowlist
  IF county_filter IS NOT NULL THEN
    safe_county := lower(trim(county_filter));
    IF NOT (safe_county = ANY(valid_counties)) THEN
      RAISE EXCEPTION 'Invalid county: %. Must be one of: %', county_filter, array_to_string(valid_counties, ', ');
    END IF;
  END IF;

  -- Validate numeric parameters
  IF min_acres_filter < 0 OR min_acres_filter > 10000 THEN
    RAISE EXCEPTION 'Invalid min_acres: %. Must be between 0 and 10000', min_acres_filter;
  END IF;

  IF min_prob_filter < 0 OR min_prob_filter > 100 THEN
    RAISE EXCEPTION 'Invalid min_prob: %. Must be between 0 and 100', min_prob_filter;
  END IF;

  -- Use parameterized query with proper casting
  SELECT ST_AsMVT(tile, 'parcels', 4096, 'geom') 
  INTO result
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
        ST_TileEnvelope(z_param, x_param, y_param),
        4096,
        256,
        true
      ) AS geom
    FROM parcels p
    LEFT JOIN parcel_scores ps ON ps.parcel_id = p.id
    LEFT JOIN parcel_signals_mv sig ON sig.parcel_id = p.id
    LEFT JOIN parcel_infra_mv pi ON pi.parcel_id = p.id
    WHERE p.geometry IS NOT NULL
      AND ST_Transform(ST_SetSRID(p.geometry::geometry, 4326), 3857) && ST_TileEnvelope(z_param, x_param, y_param)
      AND (safe_county IS NULL OR p.county = safe_county)
      AND p.acreage >= min_acres_filter
      AND COALESCE(ps.rezoning_probability, 0) >= min_prob_filter
      AND (NOT inside_usa_filter OR COALESCE(pi.inside_urban_service_area, false) = true)
  ) AS tile;
  
  RETURN result;
END;
$$;

-- 4. UPDATE RLS POLICIES: Require authentication for sensitive data

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can view parcels" ON public.parcels;
DROP POLICY IF EXISTS "Anyone can view parcel history" ON public.parcel_history;
DROP POLICY IF EXISTS "Anyone can view parcel scores" ON public.parcel_scores;
DROP POLICY IF EXISTS "Anyone can view ingestion jobs" ON public.ingestion_jobs;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can view parcels"
ON public.parcels FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view parcel history"
ON public.parcel_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view parcel scores"
ON public.parcel_scores FOR SELECT
TO authenticated
USING (true);

-- Restrict ingestion jobs to admins only
CREATE POLICY "Admins can view ingestion jobs"
ON public.ingestion_jobs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Service role can manage everything (for edge functions)
CREATE POLICY "Service role full access to parcels"
ON public.parcels FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access to parcel history"
ON public.parcel_history FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access to parcel scores"
ON public.parcel_scores FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access to ingestion jobs"
ON public.ingestion_jobs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);