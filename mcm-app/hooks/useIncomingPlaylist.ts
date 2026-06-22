import { logger } from '@/utils/logger';
import { useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';

type ImportCallback = (songs: string[]) => void;

/**
 * Hook that listens for incoming .mcm file URLs (when the app is opened
 * via a file from WhatsApp, Files, etc.) and calls onImport with the
 * parsed playlist data.
 */
export function useIncomingPlaylist(onImport: ImportCallback) {
  const onImportRef = useRef(onImport);
  onImportRef.current = onImport;

  const handleUrl = useCallback(async (url: string) => {
    if (!url) return;

    try {
      // On iOS/Android, when opened via a file, the URL will be a
      // file:// or content:// URI pointing to the .mcm file
      const isFileUrl =
        url.startsWith('file://') || url.startsWith('content://');
      if (!isFileUrl) return;

      if (Platform.OS === 'web') return;

      const content = await FileSystem.readAsStringAsync(url, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = JSON.parse(content);
      let filenames: string[] | null = null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        filenames = parsed;
      } else if (
        parsed &&
        parsed.version === 2 &&
        Array.isArray(parsed.songs) &&
        parsed.songs.length > 0
      ) {
        filenames = (parsed.songs as { filename: string }[])
          .map((s) => s.filename)
          .filter(Boolean);
      }
      if (filenames && filenames.length > 0) {
        onImportRef.current(filenames);
      }
    } catch (err) {
      logger.error('Error handling incoming playlist file:', err);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Handle URL that launched the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Handle URL while app is already running (warm start)
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleUrl]);
}
