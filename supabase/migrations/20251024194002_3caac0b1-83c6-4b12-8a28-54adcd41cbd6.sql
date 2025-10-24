-- Enable PostGIS extension for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create enum types
CREATE TYPE public.county_name AS ENUM ('wake', 'mecklenburg', 'durham', 'orange', 'chatham');
CREATE TYPE public.zoning_category AS ENUM ('residential', 'commercial', 'industrial', 'mixed', 'agricultural', 'other');
CREATE TYPE public.owner_type AS ENUM ('individual', 'corporate', 'government', 'trust', 'llc', 'other');
CREATE TYPE public.ingestion_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Counties table - track data sources and ingestion status
CREATE TABLE public.counties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name county_name NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  data_source_url TEXT,
  last_ingestion_date TIMESTAMPTZ,
  total_parcels INTEGER DEFAULT 0,
  status ingestion_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Parcels table - main parcel data with geometry
CREATE TABLE public.parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin TEXT NOT NULL,
  county county_name NOT NULL,
  geometry GEOMETRY(Polygon, 4326),
  centroid GEOMETRY(Point, 4326),
  
  -- Location
  address TEXT,
  city TEXT,
  zip_code TEXT,
  
  -- Property details
  acreage DECIMAL(10, 2),
  land_value DECIMAL(12, 2),
  total_value DECIMAL(12, 2),
  
  -- Zoning and classification
  zoning_code TEXT,
  zoning_category zoning_category,
  type_and_use TEXT,
  
  -- Ownership
  owner_name TEXT,
  owner_type owner_type,
  deed_date DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(pin, county)
);

-- Parcel history - track land value changes over time
CREATE TABLE public.parcel_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID REFERENCES public.parcels(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  land_value DECIMAL(12, 2),
  total_value DECIMAL(12, 2),
  type_and_use TEXT,
  zoning_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(parcel_id, year)
);

-- Parcel scores - ML model predictions and investment scores
CREATE TABLE public.parcel_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID REFERENCES public.parcels(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- ML predictions
  rezoning_probability DECIMAL(5, 2) CHECK (rezoning_probability >= 0 AND rezoning_probability <= 100),
  investment_score DECIMAL(5, 2) CHECK (investment_score >= 0 AND investment_score <= 100),
  
  -- Feature contributions
  land_value_yoy_change DECIMAL(8, 2),
  distance_to_infrastructure DECIMAL(10, 2),
  nearby_rezoned_count INTEGER DEFAULT 0,
  
  -- Metadata
  model_version TEXT,
  confidence_score DECIMAL(5, 2),
  computed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ingestion jobs - track ETL pipeline runs
CREATE TABLE public.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county county_name NOT NULL,
  status ingestion_status DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User saved parcels - allow users to bookmark parcels
CREATE TABLE public.user_saved_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parcel_id UUID REFERENCES public.parcels(id) ON DELETE CASCADE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, parcel_id)
);

-- Create spatial indexes for performance
CREATE INDEX idx_parcels_geometry ON public.parcels USING GIST(geometry);
CREATE INDEX idx_parcels_centroid ON public.parcels USING GIST(centroid);
CREATE INDEX idx_parcels_county ON public.parcels(county);
CREATE INDEX idx_parcels_zoning_category ON public.parcels(zoning_category);
CREATE INDEX idx_parcel_scores_investment ON public.parcel_scores(investment_score DESC);
CREATE INDEX idx_parcel_scores_rezoning ON public.parcel_scores(rezoning_probability DESC);
CREATE INDEX idx_parcel_history_parcel ON public.parcel_history(parcel_id, year DESC);

-- Enable Row Level Security
ALTER TABLE public.counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_parcels ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users to read all data
CREATE POLICY "Anyone can view counties" ON public.counties FOR SELECT USING (true);
CREATE POLICY "Anyone can view parcels" ON public.parcels FOR SELECT USING (true);
CREATE POLICY "Anyone can view parcel history" ON public.parcel_history FOR SELECT USING (true);
CREATE POLICY "Anyone can view parcel scores" ON public.parcel_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can view ingestion jobs" ON public.ingestion_jobs FOR SELECT USING (true);

-- RLS for saved parcels - users can only manage their own
CREATE POLICY "Users can view own saved parcels" ON public.user_saved_parcels 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved parcels" ON public.user_saved_parcels 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved parcels" ON public.user_saved_parcels 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved parcels" ON public.user_saved_parcels 
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_counties_updated_at BEFORE UPDATE ON public.counties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parcels_updated_at BEFORE UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parcel_scores_updated_at BEFORE UPDATE ON public.parcel_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial county data
INSERT INTO public.counties (name, display_name, data_source_url) VALUES
  ('wake', 'Wake County', 'https://data-wake.opendata.arcgis.com'),
  ('mecklenburg', 'Mecklenburg County', 'https://meck-nc.opendata.arcgis.com'),
  ('durham', 'Durham County', 'https://durhamnc.gov/1324/Open-Data'),
  ('orange', 'Orange County', NULL),
  ('chatham', 'Chatham County', 'https://data-chathamnc.opendata.arcgis.com');