/*
  # Create trips and trip_items tables for Trip Planner

  1. New Tables
    - `trips`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `title` (text) - e.g. "Summer in Tokyo"
      - `destination` (text) - e.g. "Tokyo"
      - `start_date` (date, nullable)
      - `end_date` (date, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamp)

    - `trip_items`
      - `id` (uuid, primary key)
      - `trip_id` (uuid, foreign key to trips)
      - `user_id` (uuid, foreign key to auth.users)
      - `place_name` (text)
      - `place_type` (text: place, restaurant, activity, food)
      - `location` (text)
      - `description` (text, nullable)
      - `rating` (numeric, nullable)
      - `notes` (text, nullable) - personal notes like "book in advance"
      - `visit_order` (integer) - for ordering items in the trip
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to read/write only their own data
*/

CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  destination text NOT NULL,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

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

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trips"
  ON trips FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trips"
  ON trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
  ON trips FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips"
  ON trips FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own trip items"
  ON trip_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trip items"
  ON trip_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trip items"
  ON trip_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trip items"
  ON trip_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trip_items_trip_id ON trip_items(trip_id);
CREATE INDEX idx_trip_items_user_id ON trip_items(user_id);
