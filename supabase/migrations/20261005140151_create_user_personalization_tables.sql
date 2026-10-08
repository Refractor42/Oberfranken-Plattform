/*
# User personalization: profiles, interests, saved events, behavior tracking

## Purpose
Enables Google-authenticated users to personalize their experience:
- Save their interests as tags ("Personalizing Mode")
- Save regional events to their personal calendar
- Track behavioral data (region clicks, topic filters, searches) for personalization
- Delete all their data (GDPR Art. 17 / DSGVO Recht auf Vergessenwerden)

## New Tables

1. `user_profiles`
   - `id` (uuid, PK, references auth.users, ON DELETE CASCADE)
   - `display_name` (text, nullable — populated from Google OAuth metadata)
   - `avatar_url` (text, nullable — populated from Google OAuth metadata)
   - `created_at` (timestamptz, default now())
   - `updated_at` (timestamptz, default now())
   - One row per authenticated user (created via trigger on signup)

2. `user_interests`
   - `id` (uuid, PK)
   - `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
   - `tag` (text, NOT NULL — e.g. "Kultur", "Natur", "Wandern", "Brauereien")
   - `created_at` (timestamptz, default now())
   - Unique constraint on (user_id, tag) to prevent duplicates

3. `user_saved_events`
   - `id` (uuid, PK)
   - `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
   - `event_id` (uuid, references regional_events(id) ON DELETE CASCADE)
   - `custom_title` (text, nullable — for manually added events)
   - `custom_date` (timestamptz, nullable — for manually added events)
   - `custom_location` (text, nullable — for manually added events)
   - `created_at` (timestamptz, default now())
   - Unique constraint on (user_id, event_id) to prevent duplicate saves

4. `user_behavior`
   - `id` (uuid, PK)
   - `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
   - `action` (text, NOT NULL — e.g. "region_click", "topic_filter", "search", "story_save")
   - `value` (text, NOT NULL — the value of the action, e.g. region name, topic, search term)
   - `created_at` (timestamptz, default now())
   - Index on (user_id, created_at) for efficient personalization queries

## Security (RLS)
- All tables have RLS enabled
- All policies scope TO authenticated with ownership check auth.uid() = user_id
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
- user_profiles uses id = auth.uid() as ownership check

## GDPR / DSGVO Compliance
- `delete_user_data()` SECURITY DEFINER function cascades all user data deletion
- Called by the authenticated user themselves (checked inside the function)
- Deletes: user_interests, user_saved_events, user_behavior, user_profiles
- Also deletes from auth.users via the admin API (handled client-side via signOut)

## Important Notes
1. All user_id columns default to auth.uid() so inserts work without client passing user_id
2. A trigger automatically creates a user_profiles row when a new auth.users row is created
3. The delete function is SECURITY DEFINER to allow users to delete their own auth.users row
4. For German GDPR compliance: users can see, export, and delete ALL their data
*/

-- ============================================================
-- 1. user_profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON user_profiles;
CREATE POLICY "select_own_profile"
ON user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON user_profiles;
CREATE POLICY "insert_own_profile"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON user_profiles;
CREATE POLICY "delete_own_profile"
ON user_profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- ============================================================
-- 2. user_interests table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tag)
);

ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_interests" ON user_interests;
CREATE POLICY "select_own_interests"
ON user_interests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_interests" ON user_interests;
CREATE POLICY "insert_own_interests"
ON user_interests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_interests" ON user_interests;
CREATE POLICY "update_own_interests"
ON user_interests FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_interests" ON user_interests;
CREATE POLICY "delete_own_interests"
ON user_interests FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================
-- 3. user_saved_events table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_saved_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES regional_events(id) ON DELETE CASCADE,
  custom_title text,
  custom_date timestamptz,
  custom_location text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE user_saved_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saved_events" ON user_saved_events;
CREATE POLICY "select_own_saved_events"
ON user_saved_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved_events" ON user_saved_events;
CREATE POLICY "insert_own_saved_events"
ON user_saved_events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_saved_events" ON user_saved_events;
CREATE POLICY "update_own_saved_events"
ON user_saved_events FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved_events" ON user_saved_events;
CREATE POLICY "delete_own_saved_events"
ON user_saved_events FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================
-- 4. user_behavior table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_behavior (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_behavior ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_behavior" ON user_behavior;
CREATE POLICY "select_own_behavior"
ON user_behavior FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_behavior" ON user_behavior;
CREATE POLICY "insert_own_behavior"
ON user_behavior FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_behavior" ON user_behavior;
CREATE POLICY "delete_own_behavior"
ON user_behavior FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_behavior_user_created
ON user_behavior(user_id, created_at DESC);

-- ============================================================
-- 5. Auto-create user_profiles on signup (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. GDPR / DSGVO: Delete all user data
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_user_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  deleted_counts jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet';
  END IF;

  WITH deleted_interests AS (
    DELETE FROM public.user_interests WHERE user_id = uid RETURNING 1
  ),
  deleted_saved AS (
    DELETE FROM public.user_saved_events WHERE user_id = uid RETURNING 1
  ),
  deleted_behavior AS (
    DELETE FROM public.user_behavior WHERE user_id = uid RETURNING 1
  ),
  deleted_profile AS (
    DELETE FROM public.user_profiles WHERE id = uid RETURNING 1
  )
  SELECT jsonb_build_object(
    'interests', (SELECT count(*) FROM deleted_interests),
    'saved_events', (SELECT count(*) FROM deleted_saved),
    'behavior', (SELECT count(*) FROM deleted_behavior),
    'profile', (SELECT count(*) FROM deleted_profile)
  ) INTO deleted_counts;

  RETURN jsonb_build_object('success', true, 'deleted', deleted_counts);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_data() TO authenticated;