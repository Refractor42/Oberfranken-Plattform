/*
# Expand regional_places to accept all business categories

1. Modified Tables
- `regional_places` — the existing `category` column had a CHECK constraint
  limiting it to 'museum' or 'restaurant'. This removes that constraint so
  the column can store any business type string (e.g. 'plumber', 'electrician',
  'car_wash', 'bank', 'pharmacy', 'hairdresser', 'supermarket', etc.).
  No new columns are added — the existing schema (name, category, region, lat,
  lon, opening_hours, cuisine, website, phone, address, description) already
  works for all business types.

2. Security
- No RLS or policy changes. The existing public read/write policies remain.

3. Important Notes
- The `cuisine` column will be NULL for non-restaurant categories; the frontend
  will use the `category` field to display appropriate labels and icons.
- Existing rows with category 'museum' or 'restaurant' are unaffected.
- The index on (region, category) already exists and works for any category value.
*/

ALTER TABLE public.regional_places DROP CONSTRAINT IF EXISTS regional_places_category_check;
