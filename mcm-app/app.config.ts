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
    // Sentry. El plugin va SIEMPRE (el SDK nativo tiene que estar en el
    // binario; añadirlo después por OTA es imposible). Que se reporte o no lo
    // decide `EXPO_PUBLIC_SENTRY_DSN` en runtime, no esto.
    //
    // `organization`/`project` solo sirven para subir los source maps al
    // compilar. Si no están, el plugin avisa y cae a las variables de entorno
    // SENTRY_ORG / SENTRY_PROJECT (más SENTRY_AUTH_TOKEN) durante el build:
    // sin ellas el build NO falla, simplemente los stack traces llegan sin
    // desminificar. Ver `docs/desarrollo/BUILD_AGOSTO_2026.md`.
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        ...(process.env.SENTRY_ORG
          ? { organization: process.env.SENTRY_ORG }
          : {}),
        ...(process.env.SENTRY_PROJECT
          ? { project: process.env.SENTRY_PROJECT }
          : {}),
      },
    ] as [string, object],
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
