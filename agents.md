# AGENTS.md

This file serves as a guide for AI agents to understand and navigate this repository.

## Project Overview

The `mcm-app` project is a mobile application developed using Expo and React Native. It functions as a songbook application, providing users with access to a collection of songs and related features.

## Repository Structure

The main application code is located within the `mcm-app/` directory. Here's a breakdown of the key subdirectories:

*   `mcm-app/app/`: Contains the application screens and navigation logic, utilizing file-based routing.
*   `mcm-app/assets/`: Stores static assets such as fonts, images, and song data (e.g., `songs.json`, `.cho` files).
*   `mcm-app/components/`: Houses reusable React components used throughout the application.
*   `mcm-app/constants/`: Defines global constants for theming, such as colors, spacing, and typography.
*   `mcm-app/contexts/`: Manages global application state using React Context API.
*   `mcm-app/hooks/`: Contains custom React Hooks for reusable logic.
*   `mcm-app/notifications/`: Handles push notification setup and management.
*   `mcm-app/scripts/`: Includes utility scripts for project-related tasks.

## Key Files

Understanding these files will provide further insight into the project's configuration and dependencies:

*   `AGENTS.md`: (This file) Provides guidance for AI agents to understand and navigate the repository.
*   `README.md`: The main README for human developers, offering detailed information about the project.
*   `mcm-app/package.json`: Lists project dependencies, scripts (for building, running, testing), and project metadata.
*   `mcm-app/app.json`: Expo configuration file, defining app-specific settings like name, icon, splash screen, and supported platforms.
*   `mcm-app/babel.config.js`: Configuration file for Babel, the JavaScript compiler.
*   `mcm-app/metro.config.js`: Configuration file for the Metro bundler, used by React Native.
*   `mcm-app/expo-router/entry.js`: The main entry point for the application when using Expo Router.

## Commands and Scripts

The following commands are essential for working with the `mcm-app` project. Ensure you are in the `mcm-app/` directory before running them:

*   **Install Dependencies:**
    ```bash
    npm install
    ```
    This command downloads and installs all the necessary project dependencies defined in `package.json`.

*   **Start Development Server:**
    ```bash
    npm start
    ```
    or
    ```bash
    npx expo start
    ```
    This command starts the Expo development server, allowing you to run the app on emulators, physical devices, or in a web browser.

*   **Run on Android:**
    ```bash
    npm run android
    ```
    or
    ```bash
    expo run:android
    ```
    This command builds and runs the application on a connected Android device or emulator.

*   **Run on iOS:**
    ```bash
    npm run ios
    ```
    or
    ```bash
    expo run:ios
    ```
    This command builds and runs the application on a connected iOS device or simulator (macOS only).

*   **Run on Web:**
    ```bash
    npm run web
    ```
    or
    ```bash
    expo start --web
    ```
    This command launches the application in your default web browser.

*   **Lint Code:**
    ```bash
    npm run lint
    ```
    or
    ```bash
    expo lint
    ```
    This command runs the ESLint checker to identify and report on patterns found in ECMAScript/JavaScript code.

## Navigation Guide for AI Agents

To effectively understand and interact with this codebase, AI agents should consider the following:

*   **Primary Codebase:** The core application logic resides in the `mcm-app/` directory.
*   **Screen Structure:** Application screens are defined as React components within the `mcm-app/app/` directory. Expo Router uses a file-based routing system, meaning the file and directory structure within `mcm-app/app/` dictates the navigation paths.
    *   `(tabs)` subdirectories often represent groups of screens accessible via a tab bar.
    *   `_layout.tsx` files within screen directories define shared layout components for those routes.
*   **UI Components:** Reusable UI elements are located in `mcm-app/components/`. Understanding these components is crucial for analyzing the application's visual structure and user interface.
*   **State Management:** Global state is managed via React Context, found in `mcm-app/contexts/`.
*   **Data Sources:**
    *   Song data is primarily stored in `mcm-app/assets/songs.json` and individual ChordPro files (`.cho`) in `mcm-app/assets/songs/`.
    *   Album information can be found in `mcm-app/assets/albums.json`.
*   **Functionality Entry Points:**
    *   For the songbook features, examine files related to `cancionero` within `mcm-app/app/(tabs)/` and components like `SongListItem.tsx`, `SongDetailScreen.tsx`.
    *   For calendar features, look into `calendario.tsx`.
    *   For photo gallery features, investigate `fotos.tsx`.
*   **Understanding Code Modifications:** When asked to modify or add features, identify the relevant screens in `mcm-app/app/`, components in `mcm-app/components/`, and any associated contexts or hooks.

## Feature Flags

The application supports feature flags defined in `mcm-app/constants/featureFlags.ts` and accessed via `FeatureFlagsProvider` in `mcm-app/contexts/FeatureFlagsContext.tsx`. Flags allow enabling or disabling sections like tabs or UI elements. Update the configuration file to control which tabs are visible, set the default tab, or hide the notifications icon on the home screen.
