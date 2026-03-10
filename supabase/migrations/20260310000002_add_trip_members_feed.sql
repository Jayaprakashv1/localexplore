/*
  # Add trip members and public feed features

  1. Changes to existing tables
    - `trips`
      - Add `is_public` (boolean, default false) — owner can make a trip public/private
      - Add `member_count` (integer, default 0) — denormalized count of approved members
      - Update SELECT policy to also allow authenticated users to read public trips

    - `trip_items`
      - Update SELECT policy to allow approved trip members to view itinerary items

  2. New Table: `trip_members`
    - `id` (uuid, primary key)
    - `trip_id` (uuid, FK to trips)
    - `user_id` (uuid, FK to auth.users) — the person requesting/joining
    - `email` (text) — stored for display by the trip owner
    - `status` (text: 'pending' | 'approved' | 'rejected')
    - `created_at` (timestamptz)
    - Unique constraint: (trip_id, user_id)

  3. Helper function: `is_approved_trip_member(trip_id)`
     — SECURITY DEFINER so it bypasses RLS (avoids infinite recursion in policies)

  4. Trigger: keep `trips.member_count` up-to-date

  5. RLS policies for `trip_members`:
    - Trip owners can view/update/delete all member rows for their trips
    - Users can view their own membership row (status, etc.)
    - Approved members of a trip can view other approved members (via helper fn)
    - Any authenticated user can INSERT a pending request for a public trip they do not own
    - Users can delete their own pending requests
*/

-- ─── trips: new columns ────────────────────────────────────────────────────────

ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0;

-- Update trips SELECT policy to also expose public trips
DROP POLICY IF EXISTS "Users can view their own trips" ON trips;
CREATE POLICY "Users can view trips"
  ON trips FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_public = true);

-- Allow trip owners to update is_public and other fields (UPDATE policy already exists,
-- but re-create it with USING + WITH CHECK to satisfy the RLS UPDATE convention)
DROP POLICY IF EXISTS "Users can update their own trips" ON trips;
CREATE POLICY "Users can update their own trips"
  ON trips FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Helper function (SECURITY DEFINER — bypasses RLS to avoid recursion) ────

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

-- ─── trip_items: allow approved members to view the itinerary ─────────────────

DROP POLICY IF EXISTS "Users can view their own trip items" ON trip_items;
CREATE POLICY "Users can view trip items"
  ON trip_items FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR is_approved_trip_member(trip_id)
  );

-- ─── trip_members table ────────────────────────────────────────────────────────

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

-- Trip owner can see all member rows for their own trips
CREATE POLICY "Trip owners can view members"
  ON trip_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_id
        AND trips.user_id = auth.uid()
    )
  );

-- Users can always see their own membership row
CREATE POLICY "Members can view own membership"
  ON trip_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Approved members can see other approved members of the same trip
CREATE POLICY "Approved members can view trip members"
  ON trip_members FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND is_approved_trip_member(trip_id)
  );

-- Any authenticated user can request to join a public trip they do not own
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

-- Trip owner can approve or reject requests (UPDATE status)
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

-- Users can cancel their own pending requests; owners can remove any member
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

-- ─── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_is_public ON trips(is_public) WHERE is_public = true;

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
