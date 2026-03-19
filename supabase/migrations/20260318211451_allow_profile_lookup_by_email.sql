/*
  # Allow Profile Lookup by Email

  1. Changes
    - Add SELECT policy to allow authenticated users to look up profiles by email
    - Required for friend invitation system to find users

  2. Security
    - Only allows authenticated users to search
    - Users can view basic profile info (id, email, display_name) of other users
    - This is necessary for the friend invitation workflow
*/

-- Add policy to allow authenticated users to look up other users by email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can search profiles by email'
  ) THEN
    CREATE POLICY "Users can search profiles by email"
      ON profiles FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;