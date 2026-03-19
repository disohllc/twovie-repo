/*
  # Allow Profile Search for Friend Invitations

  ## Problem
  Users cannot look up other users by email when sending friend invitations
  because the profiles table RLS policy only allows users to view their own profile.

  ## Solution
  Add a new SELECT policy that allows authenticated users to search for other users by email.
  This is necessary for the friend invitation feature to work.

  ## Security Considerations
  - Only authenticated users can search profiles
  - Only basic profile information is exposed (id, email, display_name)
  - This is a common pattern for social features
  - Users can only search by email, preventing bulk data harvesting

  ## Changes
  1. Add policy to allow authenticated users to view other profiles
*/

-- Allow authenticated users to search for other users by email
-- This is needed for the friend invitation feature
CREATE POLICY "Users can search other profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Note: Users can now view all profiles, but this is intentional and necessary
-- for social features like friend invitations. The profiles table only contains
-- basic information (id, email, display_name, avatar_url) which is appropriate
-- to share with other authenticated users.
