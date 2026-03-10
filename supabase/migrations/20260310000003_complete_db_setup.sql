/*
  # Complete Database Setup — Idempotent Fix Migration

  This migration ensures all required tables, columns, functions, triggers and RLS
  policies exist on any Supabase project, regardless of which previous migrations
  have been applied.  It is safe to run multiple times (fully idempotent).

  Tables covered:
    - saved_places        (created in 20251225031731)
    - search_history      (created in 20251225031731)
    - trips               (created in 20260310000001, extended in 20260310000002)
    - trip_items          (created in 20260310000001)
    - trip_members        (created in 20260310000002)

  Run this migration if any of the following symptoms are observed:
    • 404 errors on saved / plan / feed screens
    • Plan creation fails
    • Trip members / feed features do not work
*/

-- ─── saved_places ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_name text NOT NULL,
  place_type text NOT NULL,
  location text NOT NULL,
  description text,
  rating numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saved_places' AND policyname = 'Users can view their own saved places'
  ) THEN
    CREATE POLICY "Users can view their own saved places"
      ON saved_places FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saved_places' AND policyname = 'Users can create saved places'
  ) THEN
    CREATE POLICY "Users can create saved places"
      ON saved_places FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saved_places' AND policyname = 'Users can update their own saved places'
  ) THEN
    CREATE POLICY "Users can update their own saved places"
      ON saved_places FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saved_places' AND policyname = 'Users can delete their own saved places'
  ) THEN
    CREATE POLICY "Users can delete their own saved places"
      ON saved_places FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_places_user_id ON saved_places(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_places_location ON saved_places(location);

-- ─── search_history ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'search_history' AND policyname = 'Users can view their own search history'
  ) THEN
    CREATE POLICY "Users can view their own search history"
      ON search_history FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'search_history' AND policyname = 'Users can create search history entries'
  ) THEN
    CREATE POLICY "Users can create search history entries"
      ON search_history FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'search_history' AND policyname = 'Users can delete their own search history'
  ) THEN
    CREATE POLICY "Users can delete their own search history"
      ON search_history FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);

-- ─── trips ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  destination text NOT NULL,
  start_date date,
  end_date date,
  notes text,
  is_public boolean NOT NULL DEFAULT false,
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add columns to existing tables if they were created without them
ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0;

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Drop old restrictive SELECT policy if it exists, then create the correct one
DROP POLICY IF EXISTS "Users can view their own trips" ON trips;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trips' AND policyname = 'Users can view trips'
  ) THEN
    CREATE POLICY "Users can view trips"
      ON trips FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR is_public = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trips' AND policyname = 'Users can create their own trips'
  ) THEN
    CREATE POLICY "Users can create their own trips"
      ON trips FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Drop old UPDATE policy without WITH CHECK, then recreate with both clauses
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trips' AND policyname = 'Users can update their own trips'
  ) THEN
    DROP POLICY "Users can update their own trips" ON trips;
  END IF;

  CREATE POLICY "Users can update their own trips"
    ON trips FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trips' AND policyname = 'Users can delete their own trips'
  ) THEN
    CREATE POLICY "Users can delete their own trips"
      ON trips FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_is_public ON trips(is_public) WHERE is_public = true;

-- ─── trip_items ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_name text NOT NULL,
  place_type text NOT NULL,
  location text NOT NULL,
  description text,
  rating numeric,
  notes text,
  visit_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trip_items ENABLE ROW LEVEL SECURITY;

-- Helper function for trip membership check (needed for trip_items SELECT policy)
CREATE OR REPLACE FUNCTION is_approved_trip_member(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id
      AND user_id = auth.uid()
      AND status = 'approved'
  );
$$;

-- Drop old trip_items SELECT policy (owner-only) and replace with owner+member policy
DROP POLICY IF EXISTS "Users can view their own trip items" ON trip_items;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_items' AND policyname = 'Users can view trip items'
  ) THEN
    CREATE POLICY "Users can view trip items"
      ON trip_items FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        OR is_approved_trip_member(trip_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_items' AND policyname = 'Users can create their own trip items'
  ) THEN
    CREATE POLICY "Users can create their own trip items"
      ON trip_items FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_items' AND policyname = 'Users can update their own trip items'
  ) THEN
    CREATE POLICY "Users can update their own trip items"
      ON trip_items FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_items' AND policyname = 'Users can delete their own trip items'
  ) THEN
    CREATE POLICY "Users can delete their own trip items"
      ON trip_items FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trip_items_trip_id ON trip_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_items_user_id ON trip_items(user_id);

-- ─── trip_members ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_members' AND policyname = 'Trip owners can view members'
  ) THEN
    CREATE POLICY "Trip owners can view members"
      ON trip_members FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM trips
          WHERE trips.id = trip_id
            AND trips.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_members' AND policyname = 'Members can view own membership'
  ) THEN
    CREATE POLICY "Members can view own membership"
      ON trip_members FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_members' AND policyname = 'Approved members can view trip members'
  ) THEN
    CREATE POLICY "Approved members can view trip members"
      ON trip_members FOR SELECT TO authenticated
      USING (
        status = 'approved'
        AND is_approved_trip_member(trip_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_members' AND policyname = 'Users can request to join public trips'
  ) THEN
    CREATE POLICY "Users can request to join public trips"
      ON trip_members FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM trips
          WHERE trips.id = trip_id
            AND trips.is_public = true
            AND trips.user_id != auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_members' AND policyname = 'Trip owners can update member status'
  ) THEN
    CREATE POLICY "Trip owners can update member status"
      ON trip_members FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM trips
          WHERE trips.id = trip_id
            AND trips.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM trips
          WHERE trips.id = trip_id
            AND trips.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_members' AND policyname = 'Users can delete own membership or owners can remove members'
  ) THEN
    CREATE POLICY "Users can delete own membership or owners can remove members"
      ON trip_members FOR DELETE TO authenticated
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM trips
          WHERE trips.id = trip_id
            AND trips.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);

-- ─── Trigger: keep trips.member_count in sync ─────────────────────────────────

CREATE OR REPLACE FUNCTION update_trip_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected_trip_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_trip_id := OLD.trip_id;
  ELSE
    affected_trip_id := NEW.trip_id;
  END IF;

  UPDATE trips
  SET member_count = (
    SELECT COUNT(*) FROM trip_members
    WHERE trip_id = affected_trip_id
      AND status = 'approved'
  )
  WHERE id = affected_trip_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trip_member_count_trigger ON trip_members;
CREATE TRIGGER trip_member_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON trip_members
  FOR EACH ROW EXECUTE FUNCTION update_trip_member_count();
