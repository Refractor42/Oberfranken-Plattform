/*
# Lock regional event ingestion to trusted writers

1. Security Changes
- Keep public read access to `regional_events` for the calendar.
- Remove anonymous and authenticated insert, update, and delete policies.
- Revoke browser write privileges from anon and authenticated roles.

2. Important Notes
- The Python ingestion process should use the Supabase service role connection when inserting or updating events.
- The public browser client only needs SELECT access and cannot modify the shared event calendar.
- Existing event rows and all event columns remain unchanged.
*/

DROP POLICY IF EXISTS "Public can add regional events" ON public.regional_events;
DROP POLICY IF EXISTS "Public can update regional events" ON public.regional_events;
DROP POLICY IF EXISTS "Public can remove regional events" ON public.regional_events;

REVOKE INSERT, UPDATE, DELETE ON public.regional_events FROM anon, authenticated;
GRANT SELECT ON public.regional_events TO anon, authenticated;
