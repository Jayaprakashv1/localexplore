
/*
  # Add Missing RLS Policies
  
  1. Changes
    - Add DELETE policy for search_history
    - Add UPDATE policy for saved_places
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'search_history' 
    AND policyname = 'Users can delete their own search history'
  ) THEN
    CREATE POLICY "Users can delete their own search history"
      ON search_history
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saved_places' 
    AND policyname = 'Users can update their own saved places'
  ) THEN
    CREATE POLICY "Users can update their own saved places"
      ON saved_places
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
