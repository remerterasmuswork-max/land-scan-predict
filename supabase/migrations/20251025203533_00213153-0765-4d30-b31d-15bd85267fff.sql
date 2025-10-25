-- Add index for efficient active job lookups per county
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_county_active
ON public.ingestion_jobs (county, is_complete, started_at DESC);