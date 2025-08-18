import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId ?? '';
export const GOOGLE_IOS_CLIENT_ID = extra.googleIosClientId ?? '';
export const GOOGLE_ANDROID_CLIENT_ID = extra.googleAndroidClientId ?? '';

// Optional proxy to bypass CORS when resolving Google Photos links on web.
// Example: 'https://cors.isomorphic-git.org/'
export const CORS_PROXY_URL = extra.googleCorsProxyUrl ?? '';
