# AGENTS guide

Welcome, Codex agent! This file explains how to move around this repository and what conventions to follow. Use it as your mission briefing.

## 1. Purpose

- Orient Codex on the repository layout.
- Clarify which folders are usually edited and which are read only.
- Summarize common commands (install, start, lint, build).
- Define code style rules and Pull Request requirements.
- Explain the hierarchy when multiple `AGENTS.md` files exist.

## 2. Project layout

Main folder: `mcm-app/` (Expo + React Native written in TypeScript).

```
root
├─ AGENTS.md   ← this guide
├─ README.md   ← general documentation
├─ mcm-app/    ← application source code
├─ songs/      ← .cho song files (read only)
├─ portadas-albumes/  ← static album art (read only)
├─ capturas-referencias/ ← reference screenshots (read only)
```

### Inside `mcm-app/`

- `app/` – screens and routes using Expo Router. Most views live here.
- `components/` – reusable React components.
- `constants/` – colors, spacing and misc constants. Includes `firebase.ts` with the Firebase config.
- `contexts/` – React context providers for global state.
- `hooks/` – custom hooks, including Firebase helpers.
- `notifications/` – push notification logic.
- `assets/` – images, fonts and several JSON files. **Do not change `assets/songs/` unless told so.**
- `android/` – generated native code. Treat as read only unless instructed.
- `scripts/` – utility scripts (e.g., `reset-project.js`).

### Entry points and navigation

The folder `app/(tabs)` contains the main tabs of the app. Each file defines a navigation stack and acts as the entry point of a feature:

- `cancionero.tsx` – songbook
- `fotos.tsx` – photo albums
- `calendario.tsx` – events calendar
- `comunica.tsx` – contact information
- `jubileo.tsx` – information for the Jubilee

Files inside `app/screens/` are the individual screens pushed on top of those stacks.
Tabs are for root navigation, screens are for detailed views within a tab.

## 3. Firebase & JSON data

The project retrieves data from Firebase Realtime Database. Environment variables with the Firebase credentials live in `.env.local` (see `README.md`).
The JSON files inside `mcm-app/assets/` mirror the structure stored in Firebase and act as examples/initial data:

- `songs.json` – categories and songs
- `albums.json` – album metadata
- `jubileo-horario.json`, `jubileo-materiales.json`, `jubileo-visitas.json`, `jubileo-profundiza.json`, `jubileo-grupos.json`, `jubileo-contactos.json` – sample Jubilee data

These JSON files are not user generated and should remain consistent with the database.

## 4. Components overview

`mcm-app/components/` contains the UI building blocks. Below is a short description of each:

- `AlbumCard` – card used in the photo albums tab
- `BottomSheet` – simple modal bottom sheet wrapper
- `Collapsible` – expandable/collapsible container
- `DateSelector` – horizontal list of selectable dates
- `EventItem` – calendar event row
- `ExternalLink` – opens a link in the system browser
- `HapticTab` – tab bar button with haptic feedback
- `HelloWave` – small greeting animation at startup
- `ParallaxScrollView` – scroll view with parallax header
- `ProgressWithMessage` – loading indicator with a text label
- `SettingsPanel` – overlay to change user preferences
- `SongControls` – buttons for song playback and font/transpose options
- `SongDisplay` – renders `.cho` files using a WebView
- `SongFontPanel` – adjusts song font size
- `SongListItem` – row element for song lists
- `SongSearch` – text input for searching songs
- `ThemedText` / `ThemedView` – theme-aware primitives
- `TransposePanel` – choose the transposition key
- `ui/IconSymbol` – cross-platform icon component
- `ui/TabBarBackground` – background for the bottom tab bar on iOS

## 5. Coding conventions

- **Language:** TypeScript + React Native with Expo.
- **Lint:** run `npm run lint` using the config in `eslint.config.js`.
- **Components and files:** use PascalCase for React components (`MyComponent.tsx`).
- **Imports:** prefer relative paths or the `@/*` alias defined in `tsconfig.json`.
- **Read‑only:** avoid touching `songs/`, `portadas-albumes/`, `capturas-referencias/` or `mcm-app/assets/songs/` unless explicitly allowed.

## 6. Useful commands

Run these inside `mcm-app/`:

```bash
npm install      # install dependencies
npm start        # start Expo dev server
npm run android  # open the Android app
npm run ios      # open the iOS app (macOS only)
npm run web      # run the web version
npm run lint     # check code style
```

There are currently no automated tests. Production builds are created with EAS CLI (`eas build`). See the README for full instructions.

## 7. Pull Request rules

1. Branch from `main` (or the branch indicated).
2. Ensure `npm run lint` succeeds and the app boots (`npm start`).
3. Title the PR concisely, e.g. `feat: add settings screen`.
4. Include a short summary, issue references and screenshots/GIFs if visual.
5. Merge only when all checks pass (lint and, if added, tests/build).

## 8. Automatic validation

Before committing run:

```bash
npm run lint
```

If tests appear in the future:

```bash
npm test
```

Fix issues before committing. Only commit when the commands succeed.

## 9. Hierarchy of AGENTS files

This is the root guide. If a subfolder contains its own `AGENTS.md`, its instructions override this file for that folder. Direct system or prompt instructions always win over any `AGENTS.md`.

## 10. Final tips

Navigate starting from `mcm-app/app/` to understand the routes. If unsure, read `README.md` or ask in the relevant issue. And remember: **don’t touch generated `/build` directories** – they’re meteorite zones 🚀.

Good luck exploring the project!
