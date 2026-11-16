/**
 * Exportar subrayados y revisiones de Contigo: lee lo guardado en el móvil y
 * lo comparte como texto o como PDF. La forma del documento está en
 * `utils/contigoExport.ts`.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { loadLocalBookmarks } from '@/utils/contigoBookmarks';
import {
  collectExportDays,
  exportAsHtml,
  exportAsText,
  type ExportDay,
  type ExportOptions,
  type StoredRevision,
} from '@/utils/contigoExport';
import { printWhenReady } from '@/utils/printWhenReady';
import { shareText } from '@/utils/shareText';

const REVISION_PREFIX = '@contigo_revision_';

export async function loadRevisions(): Promise<StoredRevision[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
    k.startsWith(REVISION_PREFIX),
  );
  if (!keys.length) return [];
  const pairs = await AsyncStorage.multiGet(keys);
  const out: StoredRevision[] = [];
  for (const [key, raw] of pairs) {
    if (!raw) continue;
    try {
      const data = JSON.parse(raw) as StoredRevision;
      out.push({
        ...data,
        date: data.date || key.slice(REVISION_PREFIX.length),
      });
    } catch {
      // Una entrada rota no tumba la exportación.
    }
  }
  return out;
}

export async function loadExportDays(
  opts: ExportOptions,
): Promise<ExportDay[]> {
  const [bookmarks, revisions] = await Promise.all([
    opts.highlights ? loadLocalBookmarks() : Promise.resolve([]),
    opts.revisions ? loadRevisions() : Promise.resolve([]),
  ]);
  return collectExportDays(bookmarks, revisions, opts);
}

export async function shareExportText(
  days: ExportDay[],
  notify: (label: string) => void,
): Promise<void> {
  await shareText(exportAsText(days), { notify, copyOnDesktop: true });
}

export async function shareExportPdf(days: ExportDay[]): Promise<boolean> {
  const html = exportAsHtml(days);
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    void printWhenReady(w);
    w.document.close();
    return true;
  }
  const Print = await import('expo-print');
  const { uri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    margins: { top: 51, bottom: 51, left: 45, right: 45 },
  });
  const path = `${FileSystem.cacheDirectory}Contigo.pdf`;
  let final = uri;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: path });
    final = path;
  } catch {
    // Si no se puede renombrar, vale el original.
  }
  await Sharing.shareAsync(final, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
  return true;
}
