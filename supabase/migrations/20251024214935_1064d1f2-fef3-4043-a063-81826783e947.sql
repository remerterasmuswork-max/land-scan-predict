-- Add resumable ingestion fields to ingestion_jobs
ALTER TABLE public.ingestion_jobs 
ADD COLUMN IF NOT EXISTS last_objectid int DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_complete boolean DEFAULT false;