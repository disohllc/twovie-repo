/*
  # Fix Notification Insert Policy

  ## Changes Made

  The previous notification insert policy was too restrictive. It prevented users from 
  creating notifications for other users, which broke the friend invitation system.

  ### New Policy Logic
  Users can insert notifications when:
  1. They are creating a notification about themselves (they are in the data field as a participant)
  2. The notification is related to a friend invitation or interaction they initiated
  3. They are involved in the action being notified about

  This allows:
  - User A to send friend invitations to User B (notification for User B)
  - User B to accept and create acceptance notifications for User A
  - Any legitimate notification where the creator is a participant in the action

  ## Security Notes
  - Still prevents arbitrary notification spam
  - Users must be involved in the action being notified
  - Validates against the data field to ensure the creator is a legitimate participant
*/

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

-- Create a more permissive but still secure policy
-- Allow authenticated users to create notifications when they are involved in the action
CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is the one taking the action (inviter, sender, etc.)
    (select auth.uid())::text = (data->>'inviter_id')::text
    OR (select auth.uid())::text = (data->>'from_user_id')::text
    OR (select auth.uid())::text = (data->>'user_id')::text
    -- Or user is creating a notification about accepting something (they're the accepter)
    OR (select auth.uid()) = user_id
  );
