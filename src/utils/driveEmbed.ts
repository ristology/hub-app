/**
 * Helper deteksi link Google Drive di teks bebas user (mis. konten Feed).
 *
 * Pattern Drive link yg di-match:
 *   - https://drive.google.com/file/d/{ID}/view
 *   - https://drive.google.com/file/d/{ID}/preview
 *   - https://drive.google.com/open?id={ID}
 *   - https://drive.google.com/uc?id={ID}
 *
 * Return: array unique FILE_ID. Empty kalau tidak ada.
 *
 * Mobile mode (current — tanpa react-native-webview):
 *   - DriveLinkCard render preview card → tap → Linking.openURL ke Drive app/browser
 *
 * Future mode (kalau native rebuild + install react-native-webview):
 *   - DriveLinkCard render WebView dgn URL preview
 */
const DRIVE_URL_REGEX =
  /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]{20,})/gi;

export function extractDriveFileIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  // reset lastIndex utk safe re-use
  DRIVE_URL_REGEX.lastIndex = 0;
  while ((m = DRIVE_URL_REGEX.exec(text)) !== null) {
    const id = m[1];
    if (!seen.has(id)) { seen.add(id); ids.push(id); }
  }
  return ids;
}

/** URL preview Drive — embed-friendly. Butuh file di-share "Anyone with link". */
export function driveEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/** URL Drive yg buka di app/browser (full Drive UI). */
export function driveOpenUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** Thumbnail Drive — hanya jalan kalau file public. Cocok utk placeholder card. */
export function driveThumbnailUrl(fileId: string, size: number = 800): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}
