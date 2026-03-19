export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_premium: boolean;
  premium_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
};

export type FriendInvitation = {
  id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_id: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  responded_at: string | null;
};

export type WatchlistItem = {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  overview: string | null;
  release_date: string | null;
  ranking: number;
  created_at: string;
  updated_at: string;
};

export type SharedSpace = {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
};

export type SharedWatchlistItem = {
  id: string;
  shared_space_id: string;
  added_by_user_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  overview: string | null;
  release_date: string | null;
  user1_ranking: number | null;
  user2_ranking: number | null;
  created_at: string;
  updated_at: string;
};

export type WatchHistory = {
  id: string;
  shared_space_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  dismissed: boolean;
  watched: boolean;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: 'friend_invitation' | 'invitation_accepted' | 'invitation_declined' | 'shared_item_added';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
};

export type TMDBContent = {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type: 'movie' | 'tv';
  vote_average: number;
};
