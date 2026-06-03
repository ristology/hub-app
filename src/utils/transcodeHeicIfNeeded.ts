import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Transcoding HEIC → JPEG di iPhone SEBELUM upload ke backend.
 *
 * Why: iPhone iOS 11+ default simpan foto sbg HEIC. libheif 1.12.0 (Ubuntu
 * 22.04 LTS yg dipakai server hub.afresto.id) PUNYA limit auxiliary image
 * references yg tidak cocok utk iPhone HEIC modern (multi-image: HDR gain
 * map, depth map, tile grid). Backend tolak dgn error 422.
 *
 * Workaround: convert HEIC → JPEG di iPhone via expo-image-manipulator
 * SEBELUM kirim ke backend. Backend (selalu) terima JPEG dgn tenang.
 *
 * Detection: cek mime type (image/heic, image/heif) atau filename ext
 * (.heic, .heif). Asset non-HEIC return as-is (zero overhead).
 *
 * NOTE: expo-image-manipulator adalah native module — butuh EAS rebuild,
 * tidak bisa OTA. Pastikan sudah include di batch rebuild sebelum dipakai
 * di production.
 */
type ImageAsset = {
  uri: string;
  name?: string | null;
  type?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export type TranscodedImage = {
  uri: string;
  name: string;
  type: string;
};

export async function transcodeHeicIfNeeded(asset: ImageAsset): Promise<TranscodedImage> {
  const name = asset.name ?? asset.fileName ?? `image-${Date.now()}.jpg`;
  const type = asset.type ?? asset.mimeType ?? 'image/jpeg';

  const lowerName = name.toLowerCase();
  const isHeic =
    type.toLowerCase().includes('heic') ||
    type.toLowerCase().includes('heif') ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif');

  if (!isHeic) {
    // Bukan HEIC → return as-is (paling cepat, no decode-encode cycle)
    return { uri: asset.uri, name, type };
  }

  // HEIC terdeteksi → transcode ke JPEG quality 0.85
  // (mirror dgn quality kompresi server-side di KompresGambar trait)
  const result = await ImageManipulator.manipulateAsync(asset.uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.85,
  });

  // Ganti ekstensi nama file jadi .jpg supaya backend & display konsisten
  const baseName = name.replace(/\.[^/.]+$/, '');
  return {
    uri: result.uri,
    name: `${baseName}.jpg`,
    type: 'image/jpeg',
  };
}
