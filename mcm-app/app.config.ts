import { ExpoConfig, ConfigContext } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  android: {
    ...config.android,
    // En builds de EAS se inyecta vía variable de entorno de fichero;
    // en local cae al fichero del disco (gitignored).
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
  extra: {
    ...config.extra,
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseDatabaseUrl: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  },
  plugins: [
    ...(Array.isArray(config.plugins) ? config.plugins : []),
    ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? [
          [
            '@react-native-google-signin/google-signin',
            {
              iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
              // reversed iOS client ID, required when not using the Firebase Expo plugin
              iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.split(
                '.',
              )
                .reverse()
                .join('.'),
            },
          ] as [string, object],
        ]
      : []),
  ],
});
