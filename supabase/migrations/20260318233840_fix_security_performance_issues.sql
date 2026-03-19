/*
  # Fix Security and Performance Issues

  ## Changes Made

  ### 1. Add Missing Indexes for Foreign Keys
  Creates indexes on foreign key columns to improve query performance:
  - friend_invitations: invitee_id, inviter_id
  - premium_transactions: user_id
  - shared_spaces: user2_id
  - shared_watchlist_items: added_by_user_id
  - watch_history: shared_space_id

  ### 2. Remove Unused Indexes
  Drops indexes that are not being used by the query planner:
  - idx_friend_invitations_invitee_email
  - idx_watchlist_items_user_id
  - idx_notifications_user_id

  ### 3. Optimize RLS Policies for Performance
  Updates all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
  This prevents the function from being re-evaluated for each row, improving performance at scale

  ### 4. Fix Multiple Permissive Policies Issue
  Removes the redundant "Users can search profiles by email" policy to eliminate
  multiple permissive policies on the same table

  ### 5. Fix Notification Insert Policy
  Restricts the notification insert policy to only allow users to create notifications
  where they are specified in the data field, preventing unrestricted access

  ## Security Notes
  - All changes maintain existing security boundaries
  - Performance improvements do not reduce security
  - RLS policies still enforce proper access control
*/

-- ============================================================================
-- 1. Add Missing Indexes for Foreign Keys
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_friend_invitations_invitee_id 
  ON friend_invitations(invitee_id);

CREATE INDEX IF NOT EXISTS idx_friend_invitations_inviter_id 
  ON friend_invitations(inviter_id);

CREATE INDEX IF NOT EXISTS idx_premium_transactions_user_id 
  ON premium_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_shared_spaces_user2_id 
  ON shared_spaces(user2_id);

CREATE INDEX IF NOT EXISTS idx_shared_watchlist_items_added_by 
  ON shared_watchlist_items(added_by_user_id);

CREATE INDEX IF NOT EXISTS idx_watch_history_shared_space_id 
  ON watch_history(shared_space_id);

-- ============================================================================
-- 2. Remove Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_friend_invitations_invitee_email;
DROP INDEX IF EXISTS idx_watchlist_items_user_id;
DROP INDEX IF EXISTS idx_notifications_user_id;

-- ============================================================================
-- 3. Drop and Recreate RLS Policies with Performance Optimization
-- ============================================================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can search profiles by email" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- Friendships policies
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
DROP POLICY IF EXISTS "Users can update own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;

CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id OR (select auth.uid()) = friend_id);

CREATE POLICY "Users can create friendships"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own friendships"
  ON friendships FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id OR (select auth.uid()) = friend_id)
  WITH CHECK ((select auth.uid()) = user_id OR (select auth.uid()) = friend_id);

CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id OR (select auth.uid()) = friend_id);

-- Friend invitations policies
DROP POLICY IF EXISTS "Users can view own invitations" ON friend_invitations;
DROP POLICY IF EXISTS "Users can create invitations" ON friend_invitations;
DROP POLICY IF EXISTS "Users can update own invitations" ON friend_invitations;

CREATE POLICY "Users can view own invitations"
  ON friend_invitations FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = inviter_id OR (select auth.uid()) = invitee_id);

CREATE POLICY "Users can create invitations"
  ON friend_invitations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = inviter_id);

CREATE POLICY "Users can update own invitations"
  ON friend_invitations FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = inviter_id OR (select auth.uid()) = invitee_id)
  WITH CHECK ((select auth.uid()) = inviter_id OR (select auth.uid()) = invitee_id);

-- Watchlist items policies
DROP POLICY IF EXISTS "Users can view own watchlist" ON watchlist_items;
DROP POLICY IF EXISTS "Users can insert own watchlist items" ON watchlist_items;
DROP POLICY IF EXISTS "Users can update own watchlist items" ON watchlist_items;
DROP POLICY IF EXISTS "Users can delete own watchlist items" ON watchlist_items;

CREATE POLICY "Users can view own watchlist"
  ON watchlist_items FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own watchlist items"
  ON watchlist_items FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own watchlist items"
  ON watchlist_items FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own watchlist items"
  ON watchlist_items FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Shared spaces policies
DROP POLICY IF EXISTS "Users can view own shared spaces" ON shared_spaces;
DROP POLICY IF EXISTS "Users can create shared spaces" ON shared_spaces;
DROP POLICY IF EXISTS "Users can delete own shared spaces" ON shared_spaces;

CREATE POLICY "Users can view own shared spaces"
  ON shared_spaces FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user1_id OR (select auth.uid()) = user2_id);

CREATE POLICY "Users can create shared spaces"
  ON shared_spaces FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user1_id OR (select auth.uid()) = user2_id);

CREATE POLICY "Users can delete own shared spaces"
  ON shared_spaces FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user1_id OR (select auth.uid()) = user2_id);

-- Shared watchlist items policies
DROP POLICY IF EXISTS "Users can view shared watchlist items" ON shared_watchlist_items;
DROP POLICY IF EXISTS "Users can insert shared watchlist items" ON shared_watchlist_items;
DROP POLICY IF EXISTS "Users can update shared watchlist items" ON shared_watchlist_items;
DROP POLICY IF EXISTS "Users can delete shared watchlist items" ON shared_watchlist_items;

CREATE POLICY "Users can view shared watchlist items"
  ON shared_watchlist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND ((select auth.uid()) = shared_spaces.user1_id OR (select auth.uid()) = shared_spaces.user2_id)
    )
  );

CREATE POLICY "Users can insert shared watchlist items"
  ON shared_watchlist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = added_by_user_id
    AND EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND ((select auth.uid()) = shared_spaces.user1_id OR (select auth.uid()) = shared_spaces.user2_id)
    )
  );

CREATE POLICY "Users can update shared watchlist items"
  ON shared_watchlist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND ((select auth.uid()) = shared_spaces.user1_id OR (select auth.uid()) = shared_spaces.user2_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND ((select auth.uid()) = shared_spaces.user1_id OR (select auth.uid()) = shared_spaces.user2_id)
    )
  );

CREATE POLICY "Users can delete shared watchlist items"
  ON shared_watchlist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND ((select auth.uid()) = shared_spaces.user1_id OR (select auth.uid()) = shared_spaces.user2_id)
    )
  );

-- Watch history policies
DROP POLICY IF EXISTS "Users can view own watch history" ON watch_history;
DROP POLICY IF EXISTS "Users can insert watch history" ON watch_history;

CREATE POLICY "Users can view own watch history"
  ON watch_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = watch_history.shared_space_id
      AND ((select auth.uid()) = shared_spaces.user1_id OR (select auth.uid()) = shared_spaces.user2_id)
    )
  );

CREATE POLICY "Users can insert watch history"
  ON watch_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = watch_history.shared_space_id
      AND ((select auth.uid()) = shared_spaces.user1_id OR (select auth.uid()) = shared_spaces.user2_id)
    )
  );

-- Premium transactions policies
DROP POLICY IF EXISTS "Users can view own transactions" ON premium_transactions;

CREATE POLICY "Users can view own transactions"
  ON premium_transactions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix notification insert policy to restrict based on sender
-- Notifications should only be created by the system or the sender
CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid())::text = (data->>'from_user_id')::text
    OR (select auth.uid())::text = (data->>'inviter_id')::text
  );
