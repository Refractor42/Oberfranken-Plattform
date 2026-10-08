/*
# Create weather and places tables for live regional data

1. New Tables
- `weather_snapshots` stores the latest weather data per region, fetched from Bright Sky (api.brightsky.dev).
  - `id` uuid primary key
  - `region` text — the Oberfranken region name (Bamberg, Bayreuth, etc.)
  - `lat` numeric — latitude used for the Bright Sky query
  - `lon` numeric — longitude used for the Bright Sky query
  - `temperature` numeric — current temperature in °C
  - `temp_min` numeric — daily low in °C
  - `temp_max` numeric — daily high in °C
  - `description` text — short German weather description
  - `icon` text — weather condition code from Bright Sky
  - `wind_speed` numeric — wind speed in km/h
  - `precipitation` numeric — precipitation in mm/h
  - `humidity` numeric — relative humidity in %
  - `fetched_at` timestamptz — when the data was retrieved from Bright Sky

- `regional_places` stores museums and restaurants from OpenStreetMap (Overpass API).
  - `id` uuid primary key
  - `osm_id` bigint — OpenStreetMap element id for deduplication
  - `name` text — the place name
  - `category` text — 'museum' or 'restaurant'
  - `region` text — the Oberfranken region name
  - `lat` numeric — latitude
  - `lon` numeric — longitude
  - `opening_hours` text — raw OSM opening hours string
  - `cuisine` text — cuisine type (restaurants only)
  - `website` text — official website if available
  - `phone` text — phone number if available
  - `address` text — street address if available
  - `description` text — short description (generated later by Gemini)
  - `updated_at` timestamptz — when the row was last refreshed

2. Security
- Row level security is enabled on both tables.
- Both tables are intentionally public/shared (no auth required to view weather and places).
- anon and authenticated roles can read all rows.
- Only anon and authenticated can insert/update (the edge function uses the service role key which bypasses RLS).

3. Important Notes
- The edge function `fetch-regional-data` fetches from Bright Sky and Overpass, then upserts into these tables.
- Weather is fetched per region using lat/lon coordinates.
- Places are fetched per region using Overpass queries for tourism=museum and amenity=restaurant.
- OSM opening hours are stored raw; the frontend can format them for display.
*/

CREATE TABLE IF NOT EXISTS public.weather_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL,
  lat numeric NOT NULL,
  lon numeric NOT NULL,
  temperature numeric,
  temp_min numeric,
  temp_max numeric,
  description text,
  icon text,
  wind_speed numeric,
  precipitation numeric,
  humidity numeric,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(region)
);

ALTER TABLE public.weather_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read weather" ON public.weather_snapshots;
CREATE POLICY "Public can read weather"
ON public.weather_snapshots FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can write weather" ON public.weather_snapshots;
CREATE POLICY "Public can write weather"
ON public.weather_snapshots FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update weather" ON public.weather_snapshots;
CREATE POLICY "Public can update weather"
ON public.weather_snapshots FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete weather" ON public.weather_snapshots;
CREATE POLICY "Public can delete weather"
ON public.weather_snapshots FOR DELETE
TO anon, authenticated
USING (true);

CREATE TABLE IF NOT EXISTS public.regional_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_id bigint,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('museum', 'restaurant')),
  region text NOT NULL,
  lat numeric,
  lon numeric,
  opening_hours text,
  cuisine text,
  website text,
  phone text,
  address text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(osm_id)
);

ALTER TABLE public.regional_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read places" ON public.regional_places;
CREATE POLICY "Public can read places"
ON public.regional_places FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can write places" ON public.regional_places;
CREATE POLICY "Public can write places"
ON public.regional_places FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update places" ON public.regional_places;
CREATE POLICY "Public can update places"
ON public.regional_places FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete places" ON public.regional_places;
CREATE POLICY "Public can delete places"
ON public.regional_places FOR DELETE
TO anon, authenticated
USING (true);

CREATE INDEX IF NOT EXISTS regional_places_region_category_idx
ON public.regional_places (region, category);