/*
  # Add Notifications Insert Policy

  1. Changes
    - Add INSERT policy for notifications table
    - Allows authenticated users to create notifications for other users
    - Required for friend invitation system

  2. Security
    - Policy ensures only authenticated users can create notifications
    - Users can create notifications for any user (needed for friend invitations)
*/

-- Add INSERT policy for notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'Users can insert notifications'
  ) THEN
    CREATE POLICY "Users can insert notifications"
      ON notifications FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;