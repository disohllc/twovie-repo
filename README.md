# Twovie - Decide What to Watch Together

Twovie is a cross-platform mobile application (iOS, Android, Web) that helps couples decide what entertainment content to watch together. Built with Expo and React Native, powered by Supabase.

## Features

### Authentication & User Management
- Secure email/password authentication
- User profile management with editable display names
- Profile avatars and premium badges

### Personal Watchlist
- Add movies and TV shows from TMDB's extensive catalog
- Drag-and-drop ranking system for preference ordering
- Free tier: 5 items limit
- Premium: Unlimited items
- Private watchlists (not visible to other users)

### Friend Connection System
- Invite friends via email address
- Accept/decline friend invitations
- Real-time notifications for invitations
- Remove friends and manage connections

### Shared Spaces
- Automatic shared space creation between connected friends
- Add items from personal watchlist to shared space
- Both users can rank items independently
- View combined rankings

### Smart Recommendation Engine
- "What should we watch?" feature with animated spinner
- Algorithm considers both users' preference rankings
- Prioritizes items both users rank highly
- Factors in ranking agreement/disagreement
- Dismiss suggestions to filter them out
- Track watch history

### Premium Features
- One-time payment of $1.99
- Unlimited watchlist items
- Ad-free experience
- Priority support

## Tech Stack

### Frontend
- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Icons**: Lucide React Native
- **State Management**: React Context API

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Storage**: Row Level Security (RLS) policies

### Third-Party Services
- **TMDB API**: Movie and TV show data
- **RevenueCat**: Mobile in-app purchases (iOS/Android)
- **Stripe**: Web payments

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. Expo CLI installed: `npm install -g expo-cli`
3. TMDB API Key (free at https://www.themoviedb.org/settings/api)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Database Setup

The database schema is already applied via Supabase migrations. The following tables are created:

- `profiles` - User profile information
- `friendships` - Friend connections between users
- `friend_invitations` - Friend invitation workflow
- `watchlist_items` - Personal watchlists
- `shared_spaces` - Shared spaces between friends
- `shared_watchlist_items` - Items in shared spaces
- `watch_history` - Dismissed/watched content tracking
- `premium_transactions` - Premium purchase records
- `notifications` - In-app notifications

All tables have Row Level Security (RLS) enabled with appropriate policies.

## Project Structure

```
/app
  /(auth)
    login.tsx           # Login screen
    register.tsx        # Registration screen
  /(tabs)
    index.tsx           # Home screen with popular content
    watchlist.tsx       # Personal watchlist management
    friends.tsx         # Friend management
    /friends
      /shared
        [friendId].tsx  # Shared watchlist and recommendations
    profile.tsx         # User profile and settings
  _layout.tsx           # Root layout with auth provider
  index.tsx             # Auth routing logic

/components
  ContentCard.tsx       # Reusable content display card

/contexts
  AuthContext.tsx       # Authentication state management

/lib
  supabase.ts           # Supabase client configuration

/services
  tmdb.ts               # TMDB API integration

/types
  database.ts           # TypeScript type definitions
```

## Key Features Implementation

### Recommendation Algorithm

The recommendation engine uses a weighted scoring system:

1. Filters out dismissed/watched items
2. Calculates combined score: `(user1_ranking + user2_ranking) / 2`
3. Calculates agreement factor: `abs(user1_ranking - user2_ranking)`
4. Final score: `combined_score + (agreement * 0.5)`
5. Selects randomly from top 5 scored items

Lower scores = higher priority (since ranking 1 is better than ranking 5).

### Security

- All database operations protected by Row Level Security
- Users can only access their own data
- Shared data only accessible to participants
- Email addresses hidden until invitation accepted
- API keys stored securely in environment variables

### Free Tier Limitations

- Maximum 5 items per personal watchlist
- Upgrade prompt shown when limit reached
- Premium users have unlimited items

## Deployment

### iOS App Store
1. Build with EAS: `eas build --platform ios`
2. Submit to App Store Connect
3. Typical review time: 1-3 days

### Google Play Store
1. Build with EAS: `eas build --platform android`
2. Submit to Google Play Console
3. Typical review time: hours to days

### Web
1. Export static site: `npm run build:web`
2. Deploy to Vercel/Netlify
3. Configure custom domain

## Environment Variables

Required environment variables:

- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `EXPO_PUBLIC_TMDB_API_KEY` - TMDB API key (get free at themoviedb.org)

## Future Enhancements

- Push notifications for invitations and updates
- Social features (share recommendations, watch parties)
- Streaming service integration (show where to watch)
- Advanced filtering (genre, year, rating)
- Watch together with synchronized playback
- Group spaces (more than 2 people)
- AI-powered recommendations
- Watch history tracking and statistics

## Support

For issues or questions, please open an issue in the repository.

## License

Copyright © 2024 Twovie. All rights reserved.
