# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCM App is a React Native Expo application for MCM España (Misioneros y Misioneras Claretianos), a religious organization. The app provides a songbook (cancionero), calendar events, group information, reflections, photo galleries, and games (Wordle).

**Tech Stack:**
- React Native 0.81.4 with Expo 54
- Expo Router (file-based routing)
- Firebase Realtime Database
- React Native Paper (UI components)
- TypeScript (strict mode)
- ChordSheetJS (song chord processing)

## Development Commands

### Core Development
```bash
# Start development server
npm start

# Run on specific platforms
npm run android
npm run ios
npm run web

# Linting and formatting
npm run lint
npm run format

# Testing
npm test
```

### EAS Build Profiles
```bash
# Development build with dev client
eas build --profile development --platform ios/android

# Development build for iOS Simulator
eas build --profile development-simulator --platform ios

# Preview build (internal distribution)
eas build --profile preview --platform ios/android

# Production build
eas build --profile production --platform ios/android

# Submit to stores
eas submit --platform ios/android
```

### Platform-Specific Notes
- **iOS Bundle ID:** com.familiaconsolacion.mcmapp (Apple Team: 5P53S6QB23)
- **Android Package:** com.mcmespana.mcmapp
- **Web:** Metro bundler with static output

## Architecture

### Directory Structure

```
app/                        # Expo Router entry point & screens
├── _layout.tsx            # Root layout with context providers
├── (tabs)/                # Main tab navigation
│   ├── _layout.tsx        # Bottom tabs configuration
│   ├── index.tsx          # Home screen
│   ├── cancionero.tsx     # Songbook navigator
│   ├── calendario.tsx     # Calendar screen
│   ├── fotos.tsx          # Photos screen
│   └── mas.tsx            # More/Settings screen
└── screens/               # Individual screen components (20 screens)

components/                 # Reusable UI components (38 components)
├── ui/                    # Base UI components (ThemedText, ThemedView, etc.)
└── [feature components]   # Song controls, modals, content displays

contexts/                   # React Context providers (5 contexts)
├── FeatureFlagsContext.tsx
├── AppSettingsContext.tsx
├── UserProfileContext.tsx
├── SettingsContext.tsx    # Song-specific settings
└── SelectedSongsContext.tsx

hooks/                      # Custom hooks (15+ hooks)
├── useFirebaseData.ts     # Generic Firebase data fetching with caching
├── useSongProcessor.ts    # ChordPro to HTML processing
├── useCalendarEvents.ts   # ICS calendar parsing
└── [other hooks]

constants/                  # Configuration files
├── featureFlags.ts        # Toggle tabs and features
├── colors.ts              # Brand colors and theme
├── firebase.ts            # Firebase configuration
└── [other constants]

utils/                      # Utility functions
├── chordNotation.ts       # EN ↔ ES chord conversion
├── filterSongsData.ts     # Filter out draft/pending songs
└── songUtils.ts           # Category mapping, title cleaning
```

### Navigation Architecture

**Two-level navigation:**
1. **Root Layout (`app/_layout.tsx`)**: Stack navigator wrapping tab navigation
   - Routes: `(tabs)`, `wordle`, `notifications`
   - Wraps app with all context providers

2. **Bottom Tabs (`app/(tabs)/_layout.tsx`)**: Main navigation
   - Tabs: index (home), cancionero, calendario, fotos, mas
   - Controlled by feature flags in `constants/featureFlags.ts`

3. **Cancionero Nested Stack**: React Navigation stack for songbook
   - Flow: `Categories` → `SongsList` → `SongDetail` → `SongFullscreen`

**Path alias:** `@/*` maps to root directory (configured in `tsconfig.json`)

### State Management

**No Redux** - uses React Context API exclusively:

| Context | Purpose | Persistence |
|---------|---------|-------------|
| FeatureFlagsContext | Toggle tabs and features | In-memory |
| AppSettingsContext | Font scale, theme preference | AsyncStorage |
| UserProfileContext | User name, location | AsyncStorage |
| SettingsContext | Song display settings | AsyncStorage |
| SelectedSongsContext | Song playlist | In-memory |

All providers are nested in `app/_layout.tsx`. Settings auto-save to AsyncStorage.

### Firebase Data Layer

**Pattern:** `useFirebaseData<T>` hook (located in `hooks/useFirebaseData.ts`)

**Features:**
- Offline-first with AsyncStorage caching
- Automatic cache invalidation based on `updatedAt` timestamp
- Network status detection
- Optional data transformation functions
- Generic type support

**Usage example:**
```typescript
const { data, loading } = useFirebaseData<SongsData>(
  'songs',              // Firebase path
  'songs',              // Cache key
  filterSongsData       // Optional transform
);
```

**Firebase paths used:**
- `songs` - Song database (categories and ChordPro content)
- `jubileo/grupos` - Groups data
- `jubileo/compartiendo` - Reflections
- `jubileo/materiales` - Resources
- `jubileo/calendarios` - Calendar URLs (ICS format)

**Read-only except:** ReflexionesScreen allows writing new reflections

### Key Features

#### Songbook (Cancionero)
- **Format:** ChordPro → HTML via `chordsheetjs`
- **Capabilities:**
  - Live transposition with capo support
  - Chord notation switching (English ↔ Spanish)
  - Font customization (size, family)
  - Toggle chord visibility
  - Fullscreen mode
  - Song selection/playlists
- **Processing:** `useSongProcessor` hook handles transformation
- **Data filtering:** Excludes songs with status 'borrador' or 'pendiente'

#### Calendar
- **Format:** ICS files (RFC 5545) fetched from Firebase-stored URLs
- **Parser:** Custom `useCalendarEvents` hook
- **Features:** Multi-calendar support, all-day events, offline caching

#### Wordle Game
- **Storage:** AsyncStorage for stats and daily word
- **Hooks:** `useWordleGame`, `useWordleStats`, `useWordleLeaderboard`

### Theme & Styling

**Brand colors:**
```typescript
primary: '#253883'    // Dark blue
secondary: '#95d2f2'  // Light blue
accent: '#E15C62'     // Red
```

**Theme system:**
- React Navigation's ThemeProvider (light/dark)
- React Native Paper MD3 with custom primary color
- Auto-detect system theme via `useColorScheme`
- StatusBar adapts to current route

### Code Style

**Prettier config:**
- Single quotes
- Trailing commas
- 80 char line width
- Semicolons required

**ESLint:** Expo config + Prettier plugin

## Common Development Patterns

### Adding a New Screen
1. Create screen component in `app/screens/`
2. Add route in appropriate navigator (`app/(tabs)/_layout.tsx` or `app/_layout.tsx`)
3. Update feature flags if adding new tab
4. Use TypeScript path alias `@/` for imports

### Fetching Firebase Data
```typescript
// In component
const { data, loading, error } = useFirebaseData<YourType>(
  'firebase/path',
  'cache-key',
  optionalTransformFunction
);

if (loading) return <Loading />;
if (error) return <Error />;
// Use data...
```

### Creating a Persistent Setting
1. Add to appropriate context (AppSettingsContext, SettingsContext, etc.)
2. Use `AsyncStorage` for persistence
3. Implement auto-save in context provider
4. Access via `useContext` hook

### Working with Songs
- **Clean titles:** Use `cleanSongTitle()` from `utils/songUtils.ts`
- **Category mapping:** Use `getCategoryFromFirebaseCategory()`
- **Filter data:** Apply `filterSongsData()` to exclude drafts
- **Transpose:** Use `useSongProcessor` hook with transpose parameter
- **Chord notation:** Use `convertChordNotation()` from `utils/chordNotation.ts`

### Testing
- **Framework:** Jest with jest-expo preset
- **Testing Library:** @testing-library/react-native
- **Path mapping:** `@/` alias configured in jest.config.js
- Run tests: `npm test`

## Important Notes

### Feature Flags
Located in `constants/featureFlags.ts`:
```typescript
{
  tabs: { index: true, mas: true, cancionero: true, ... },
  defaultTab: 'index',
  showNotificationsIcon: false,
  showUserProfilePrompt: false
}
```

Modify these to enable/disable tabs and features.

### Environment Variables
Firebase config requires `.env` file (not in repo):
```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_DATABASE_URL=...
```

### No Authentication
The app is currently public with no auth system. UserProfileContext stores optional name/location only.

### Expo Updates
OTA updates enabled via EAS. Runtime version: `1.0.1`

### New Architecture
Expo's new architecture is enabled (`newArchEnabled: true`)

## Key Files Reference

- **Entry:** `app/_layout.tsx`
- **Tab navigation:** `app/(tabs)/_layout.tsx`
- **Firebase config:** `constants/firebase.ts`
- **Data fetching:** `hooks/useFirebaseData.ts`
- **Feature flags:** `constants/featureFlags.ts`
- **Theme:** `constants/colors.ts`, `app/styles/`
- **Song processing:** `hooks/useSongProcessor.ts`
- **Calendar parsing:** `hooks/useCalendarEvents.ts`
