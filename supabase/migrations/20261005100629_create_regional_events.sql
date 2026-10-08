/*
# Create regional events calendar

1. New Tables
- `regional_events` stores the shared public event calendar for Oberfranken.
- `id` is the generated event identifier.
- `title` is the event name shown in the calendar.
- `starts_at` and `ends_at` store the event date and optional end time.
- `location` stores the venue or place name.
- `region` stores the Oberfranken region associated with the event.
- `category` stores a public category such as Kultur, Natur, Wissen, or Wirtschaft.
- `description` stores the short event summary.
- `importance` stores a 1–5 ranking used to surface the biggest events for each day.
- `source_url` stores the original public event link when available.
- `created_at` stores when the row entered the platform.

2. Security
- Row level security is enabled.
- The calendar is intentionally shared public data, so anon and authenticated visitors can read and maintain event rows.

3. Important Notes
- A Python ingestion script can insert rows into `regional_events` using the Supabase Python client.
- Use ISO timestamps for `starts_at` and `ends_at` and set `importance` from 1 to 5.
- The frontend orders each day by importance, then by start time.
*/

CREATE TABLE IF NOT EXISTS public.regional_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text NOT NULL,
  region text NOT NULL,
  category text NOT NULL DEFAULT 'Kultur',
  description text NOT NULL DEFAULT '',
  importance smallint NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.regional_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS regional_events_starts_at_idx ON public.regional_events (starts_at);
CREATE INDEX IF NOT EXISTS regional_events_importance_idx ON public.regional_events (importance DESC, starts_at);

DROP POLICY IF EXISTS "Public can read regional events" ON public.regional_events;
CREATE POLICY "Public can read regional events"
ON public.regional_events FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can add regional events" ON public.regional_events;
CREATE POLICY "Public can add regional events"
ON public.regional_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update regional events" ON public.regional_events;
CREATE POLICY "Public can update regional events"
ON public.regional_events FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can remove regional events" ON public.regional_events;
CREATE POLICY "Public can remove regional events"
ON public.regional_events FOR DELETE
TO anon, authenticated
USING (true);
