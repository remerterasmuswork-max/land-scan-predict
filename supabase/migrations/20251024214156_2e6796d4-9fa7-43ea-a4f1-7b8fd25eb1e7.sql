-- Alter geometry column to accept both Polygon and MultiPolygon
ALTER TABLE public.parcels 
ALTER COLUMN geometry TYPE geometry(Geometry, 4326) USING geometry;