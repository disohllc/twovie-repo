/*
  # Initial Twovie Database Schema

  1. New Tables
    - `profiles`
      - Stores user profile information
      - Links to auth.users
      - Tracks premium status
    
    - `friendships`
      - Manages friend connections between users
      - Tracks friendship status (pending, accepted, declined)
    
    - `friend_invitations`
      - Handles friend invitation workflow
      - Supports email invitations to non-registered users
    
    - `watchlist_items`
      - Personal watchlist for each user (private)
      - Stores TMDB movie/TV show data
      - Supports ranking/sorting
    
    - `shared_spaces`
      - Creates shared space between two friends
      - One space per friendship pair
    
    - `shared_watchlist_items`
      - Items added to shared space
      - Tracks individual rankings from both users
    
    - `watch_history`
      - Tracks dismissed/watched content
      - Used for recommendation filtering
    
    - `premium_transactions`
      - Records premium upgrade purchases
      - Supports multiple platforms (iOS, Android, Web)
    
    - `notifications`
      - In-app notification system
      - Friend invitations, acceptances, etc.

  2. Security
    - Enable RLS on all tables
    - Users can only access their own data
    - Shared data accessible only to participants
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendships"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friendships"
  ON friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Create friend_invitations table
CREATE TABLE IF NOT EXISTS friend_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

ALTER TABLE friend_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invitations"
  ON friend_invitations FOR SELECT
  TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can create invitations"
  ON friend_invitations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update own invitations"
  ON friend_invitations FOR UPDATE
  TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id)
  WITH CHECK (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Create watchlist_items table
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  poster_path TEXT,
  overview TEXT,
  release_date TEXT,
  ranking INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tmdb_id, media_type)
);

ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist"
  ON watchlist_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist items"
  ON watchlist_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist items"
  ON watchlist_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist items"
  ON watchlist_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create shared_spaces table
CREATE TABLE IF NOT EXISTS shared_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

ALTER TABLE shared_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shared spaces"
  ON shared_spaces FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create shared spaces"
  ON shared_spaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can delete own shared spaces"
  ON shared_spaces FOR DELETE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Create shared_watchlist_items table
CREATE TABLE IF NOT EXISTS shared_watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_space_id UUID NOT NULL REFERENCES shared_spaces(id) ON DELETE CASCADE,
  added_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  poster_path TEXT,
  overview TEXT,
  release_date TEXT,
  user1_ranking INTEGER,
  user2_ranking INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shared_space_id, tmdb_id, media_type)
);

ALTER TABLE shared_watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared watchlist items"
  ON shared_watchlist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND (shared_spaces.user1_id = auth.uid() OR shared_spaces.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert shared watchlist items"
  ON shared_watchlist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND (shared_spaces.user1_id = auth.uid() OR shared_spaces.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can update shared watchlist items"
  ON shared_watchlist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND (shared_spaces.user1_id = auth.uid() OR shared_spaces.user2_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND (shared_spaces.user1_id = auth.uid() OR shared_spaces.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete shared watchlist items"
  ON shared_watchlist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = shared_watchlist_items.shared_space_id
      AND (shared_spaces.user1_id = auth.uid() OR shared_spaces.user2_id = auth.uid())
    )
  );

-- Create watch_history table
CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_space_id UUID NOT NULL REFERENCES shared_spaces(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  dismissed BOOLEAN DEFAULT false,
  watched BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watch history"
  ON watch_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = watch_history.shared_space_id
      AND (shared_spaces.user1_id = auth.uid() OR shared_spaces.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert watch history"
  ON watch_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_spaces
      WHERE shared_spaces.id = watch_history.shared_space_id
      AND (shared_spaces.user1_id = auth.uid() OR shared_spaces.user2_id = auth.uid())
    )
  );

-- Create premium_transactions table
CREATE TABLE IF NOT EXISTS premium_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  transaction_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE premium_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON premium_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('friend_invitation', 'invitation_accepted', 'invitation_declined', 'shared_item_added')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_invitations_invitee_email ON friend_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_id ON watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_spaces_users ON shared_spaces(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_shared_watchlist_space_id ON shared_watchlist_items(shared_space_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, read);