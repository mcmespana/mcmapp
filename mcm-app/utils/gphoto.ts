import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  CORS_PROXY_URL,
} from '@/constants/google';

export type GPhotoStrategy = 'og-image' | 'photos-api';

interface Options {
  width?: number;
  preferOAuthOnWeb?: boolean;
  ttlMs?: number;
}

interface CacheEntry {
  url: string;
  strategy: GPhotoStrategy;
  ts: number;
}

export async function getGPhotoPreviewURL(
  sharedUrl: string,
  opts: Options = {},
): Promise<{ url: string; strategy: GPhotoStrategy }> {
  const width = opts.width ?? 600;
  const preferOAuthOnWeb =
    opts.preferOAuthOnWeb ?? (Platform.OS === 'web' ? true : false);
  const ttlMs = opts.ttlMs ?? 24 * 60 * 60 * 1000;

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${sharedUrl}|${width}`,
  );
  const cacheKey = `gphoto:${hash}`;
  const cachedRaw = await AsyncStorage.getItem(cacheKey);
  if (cachedRaw) {
    try {
      const cached: CacheEntry = JSON.parse(cachedRaw);
      if (Date.now() - cached.ts < ttlMs && cached.url) {
        return { url: cached.url, strategy: cached.strategy };
      }
    } catch {
      // ignore parse errors
    }
  }

  if (!(Platform.OS === 'web' && preferOAuthOnWeb)) {
    try {
      const url = await fetchOgImage(sharedUrl, width, preferOAuthOnWeb);
      const entry: CacheEntry = { url, strategy: 'og-image', ts: Date.now() };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      return entry;
    } catch {
      // fall back to OAuth
    }
  }

  const url = await fetchViaPhotosApi(sharedUrl, width);
  const entry: CacheEntry = { url, strategy: 'photos-api', ts: Date.now() };
  await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
  return entry;
}

async function fetchOgImage(
  sharedUrl: string,
  width: number,
  preferOAuthOnWeb: boolean,
): Promise<string> {
  let res: Response;
  if (Platform.OS === 'web') {
    if (preferOAuthOnWeb || !CORS_PROXY_URL) {
      throw new Error('CORS proxy missing');
    }
    res = await fetch(`${CORS_PROXY_URL}${encodeURIComponent(sharedUrl)}`);
  } else {
    res = await fetch(sharedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Mobile; Expo)' },
    });
  }

  const html = await res.text();
  const match =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(
      html,
    ) ||
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(
      html,
    );
  const imageUrl = match && match[1];
  if (!imageUrl || !imageUrl.startsWith('https://lh3.googleusercontent.com/')) {
    throw new Error('Invalid image URL');
  }
  const widthRegex = /=w\d+/;
  return widthRegex.test(imageUrl)
    ? imageUrl.replace(widthRegex, `=w${width}`)
    : `${imageUrl}=w${width}`;
}

async function fetchViaPhotosApi(
  sharedUrl: string,
  width: number,
): Promise<string> {
  const clientId = Platform.select({
    web: GOOGLE_WEB_CLIENT_ID,
    ios: GOOGLE_IOS_CLIENT_ID,
    android: GOOGLE_ANDROID_CLIENT_ID,
    default: GOOGLE_WEB_CLIENT_ID,
  });
  if (!clientId) {
    throw new Error('Missing Google OAuth client ID');
  }

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth' +
    `?response_type=token&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(
      'https://www.googleapis.com/auth/photoslibrary.readonly',
    )}`;

  const result = await AuthSession.startAsync({ authUrl });
  if (result.type !== 'success' || !result.params?.access_token) {
    throw new Error('OAuth failed');
  }
  const accessToken = result.params.access_token as string;

  const urlObj = new URL(sharedUrl);
  const shareToken = urlObj.searchParams.get('key');
  if (!shareToken) {
    throw new Error('Shared URL must include key parameter');
  }

  const joinRes = await fetch(
    'https://photoslibrary.googleapis.com/v1/sharedAlbums:join',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shareToken }),
    },
  );
  const joinJson = await joinRes.json();
  const albumId = joinJson?.id || joinJson?.sharedAlbum?.id;
  if (!albumId) {
    throw new Error('Unable to join shared album');
  }

  const searchRes = await fetch(
    'https://photoslibrary.googleapis.com/v1/mediaItems:search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ albumId, pageSize: 1 }),
    },
  );
  const searchJson = await searchRes.json();
  const baseUrl = searchJson?.mediaItems?.[0]?.baseUrl;
  if (!baseUrl) {
    throw new Error('No media items found');
  }

  return `${baseUrl}=w${width}`;
}
