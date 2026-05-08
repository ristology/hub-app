import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing    from 'expo-sharing';
import { Alert, Platform } from 'react-native';

/**
 * Download dokumen ke cache lokal lalu trigger native "Open with..." sheet.
 *
 * Pattern ala WhatsApp/Telegram: app unduh ke cache, OS yang handle pemilihan
 * aplikasi pembuka (Word, Excel, PDF reader, dll).
 */
export async function openDocumentExternal(
  fileUrl: string,
  filename: string,
  mimeType?: string,
  bearerToken?: string,
): Promise<boolean> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Tidak didukung', 'Sharing tidak tersedia di perangkat ini.');
      return false;
    }

    // Sanitize filename — buang karakter yang tidak valid utk filesystem
    const safeName = filename.replace(/[\/\\:*?"<>|]/g, '_');
    const localUri = (FileSystem.cacheDirectory ?? '') + safeName;

    // Cek cache — kalau sudah ada (file_url biasanya immutable), skip download
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      const headers: Record<string, string> = {};
      if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

      await FileSystem.downloadAsync(fileUrl, localUri, { headers });
    }

    await Sharing.shareAsync(localUri, {
      mimeType: mimeType ?? guessMime(filename),
      dialogTitle: 'Buka dokumen dengan...',
      UTI: Platform.OS === 'ios' ? guessUti(filename) : undefined,
    });

    return true;
  } catch (e: any) {
    Alert.alert('Gagal buka dokumen', e?.message ?? 'Terjadi kesalahan tidak dikenal.');
    return false;
  }
}

/** Bersihkan file cache lebih dari N hari (panggil saat app start) */
export async function pruneOldDokumenCache(maxAgeDays = 7): Promise<void> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return;
    const items = await FileSystem.readDirectoryAsync(dir);
    const cutoff = Date.now() - maxAgeDays * 86400_000;

    for (const name of items) {
      const path = dir + name;
      const info = await FileSystem.getInfoAsync(path, { md5: false });
      if (info.exists && !info.isDirectory && info.modificationTime) {
        // modificationTime is in seconds since epoch
        if (info.modificationTime * 1000 < cutoff) {
          await FileSystem.deleteAsync(path, { idempotent: true });
        }
      }
    }
  } catch {
    // best-effort, abaikan error
  }
}

function guessMime(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

function guessUti(filename: string): string | undefined {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return UTI_MAP[ext];
}

const MIME_MAP: Record<string, string> = {
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt:  'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  txt:  'text/plain',
  csv:  'text/csv',
  zip:  'application/zip',
};

const UTI_MAP: Record<string, string> = {
  pdf:  'com.adobe.pdf',
  doc:  'com.microsoft.word.doc',
  docx: 'org.openxmlformats.wordprocessingml.document',
  xls:  'com.microsoft.excel.xls',
  xlsx: 'org.openxmlformats.spreadsheetml.sheet',
  ppt:  'com.microsoft.powerpoint.ppt',
  pptx: 'org.openxmlformats.presentationml.presentation',
  jpg:  'public.jpeg',
  jpeg: 'public.jpeg',
  png:  'public.png',
};
