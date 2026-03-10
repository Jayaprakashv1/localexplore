# Travel Discover - Local Explore

A modern React Native mobile application for discovering amazing places, restaurants, and activities around the world.

## Features

### 🌟 Core Features
- **Location Discovery**: Search for any location and get curated results including:
  - Famous places
  - Restaurants with ratings
  - Activities and experiences
  - Special local foods to try
- **Save Places**: Bookmark your favorite destinations for later
- **Search History**: Quick access to your recent searches
- **User Authentication**: Secure login and registration with Supabase

### ✨ Enhanced User Experience
- **Pull-to-Refresh**: Refresh content on all screens with a simple pull gesture
- **Haptic Feedback**: Feel tactile responses for every interaction:
  - Button presses
  - Save/remove actions
  - Success/error notifications
  - Swipe gestures
- **Toast Notifications**: Clear, non-intrusive feedback messages for all actions
- **Loading Skeletons**: Beautiful animated placeholders instead of spinners
- **Swipe-to-Delete**: Easily remove saved places with a swipe gesture
- **Filter Saved Places**: Filter by place type (places, restaurants, activities, foods)
- **Trending Destinations**: Quick access to popular cities on the discover screen
- **Password Visibility Toggle**: Show/hide password on login and registration
- **Smooth Animations**: Card animations and transitions throughout the app

### 🎨 Design Highlights
- Clean, modern interface with consistent styling
- Intuitive navigation with bottom tabs
- Icon-driven design using Lucide icons
- Responsive layouts for all screen sizes
- Confirmation dialogs for destructive actions

## Technology Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router with file-based routing
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Haptics**: Expo Haptics
- **Icons**: Lucide React Native
- **Gestures**: React Native Gesture Handler

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/aazhitech/localexplore.git
cd localexplore
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the project root with your Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Apply database migrations** (required before running the app):

   **Option A — Supabase CLI (recommended):**
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   **Option B — Supabase Dashboard (SQL Editor):**
   Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql) for your project
   and run the migrations in order:
   1. `supabase/migrations/20251225031731_create_saved_places_schema.sql`
   2. `supabase/migrations/20260104130517_add_missing_rls_policies.sql`
   3. `supabase/migrations/20260310000001_create_trips_schema.sql`
   4. `supabase/migrations/20260310000002_add_trip_members_feed.sql`

   > **Already have the database set up but seeing 404 errors?**
   > Run the idempotent fix migration in the SQL Editor:
   > `supabase/migrations/20260310000003_complete_db_setup.sql`
   > This migration is safe to run multiple times and will create any missing
   > tables, columns, indexes, functions and RLS policies.

5. **Deploy the Edge Function** (required for the Discover screen):
   ```bash
   npx supabase functions deploy discover-location
   ```

6. Start the development server:
```bash
npm run dev
```

## Project Structure

```
localexplore/
├── app/                    # App screens (Expo Router)
│   ├── (tabs)/            # Main tab screens
│   │   ├── index.tsx      # Discover screen
│   │   ├── saved.tsx      # Saved places screen
│   │   ├── plan.tsx       # Trip planner screen
│   │   ├── feed.tsx       # Public trips feed screen
│   │   ├── profile.tsx    # Profile screen
│   │   └── _layout.tsx    # Tabs layout
│   ├── _layout.tsx        # Root layout with auth guard
│   ├── login.tsx          # Login screen
│   └── register.tsx       # Register screen
├── components/            # Reusable components
│   ├── Toast.tsx          # Toast notification component
│   ├── WeatherWidget.tsx  # Weather widget component
│   └── LoadingSkeleton.tsx # Loading skeleton component
├── contexts/              # React contexts
│   └── AuthContext.tsx    # Authentication context
├── lib/                   # Utility functions
│   ├── database.ts        # All database operations
│   └── supabase.ts        # Supabase client initialisation
├── hooks/                 # Custom hooks
├── supabase/
│   ├── config.toml        # Supabase CLI configuration
│   ├── functions/
│   │   └── discover-location/index.ts  # Edge function
│   └── migrations/        # Database migrations (apply in order)
│       ├── 20251225031731_create_saved_places_schema.sql
│       ├── 20260104130517_add_missing_rls_policies.sql
│       ├── 20260310000001_create_trips_schema.sql
│       ├── 20260310000002_add_trip_members_feed.sql
│       └── 20260310000003_complete_db_setup.sql  # Idempotent fix migration
└── assets/                # Images and fonts
```

## Key Features Implementation

### Haptic Feedback
The app provides haptic feedback for:
- **Light Impact**: Pull-to-refresh, quick taps, filter selection
- **Medium Impact**: Save/remove actions, search, authentication
- **Success Notification**: Successful operations (search, save, login)
- **Warning Notification**: Validation errors
- **Error Notification**: Failed operations

### Pull-to-Refresh
All main screens support pull-to-refresh:
- Discover: Refreshes search history
- Saved Places: Reloads saved items
- Profile: Updates profile data

### Toast Notifications
Three types of toast messages:
- **Success** (green): Successful operations
- **Error** (red): Failed operations
- **Info** (blue): General information

### Filter System
Saved places can be filtered by:
- All (default)
- Places
- Restaurants
- Activities
- Foods

## Scripts

- `npm run dev` - Start development server
- `npm run build:web` - Build for web
- `npm run lint` - Run linter
- `npm run typecheck` - Run TypeScript type checking

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Author

Created by aazhitech

