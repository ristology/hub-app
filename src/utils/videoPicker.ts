import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video } from 'react-native-compressor';
import { Alert, Platform } from 'react-native';

export type VideoAsset = {
  uri: string;
  name: string;
  type: string;          // mime: 'video/mp4' biasanya
  durationSec: number;
};

export type VideoThumbnail = {
  uri: string;
  name: string;
  type: string;          // 'image/jpeg'
};

export type PickedVideo = {
  video:     VideoAsset;
  thumbnail: VideoThumbnail;
};

export const VIDEO_MAX_DURATION_SEC = 60;
export const VIDEO_MAX_SIZE_MB      = 30;

/** Buka picker video dari galeri (atau kamera). Hasil otomatis dikompres
 *  (react-native-compressor) lalu di-generate thumbnail (expo-video-thumbnails).
 *
 *  Return: { video, thumbnail } siap di-append ke FormData, atau null kalau
 *  user batal. Throw error dengan pesan jelas kalau gagal.
 *
 *  source: 'gallery' (default) atau 'camera'.
 */
export async function pickAndCompressVideo(source: 'gallery' | 'camera' = 'gallery'): Promise<PickedVideo | null> {
  // Permission
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Izin ditolak', `Beri izin akses ${source === 'camera' ? 'kamera' : 'galeri'} di pengaturan HP.`);
    return null;
  }

  const launch = source === 'camera'
    ? ImagePicker.launchCameraAsync
    : ImagePicker.launchImageLibraryAsync;

  const result = await launch({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    videoMaxDuration: VIDEO_MAX_DURATION_SEC,
    // Force quality medium di iOS → transcode HEVC → H.264 mp4 universal
    videoQuality: ImagePicker.UIImagePickerControllerQualityType?.Medium ?? 1,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const rawDurationMs = asset.duration ?? 0;
  const rawDurationSec = Math.max(1, Math.round(rawDurationMs / 1000));

  if (rawDurationSec > VIDEO_MAX_DURATION_SEC) {
    Alert.alert('Video terlalu panjang', `Maksimal ${VIDEO_MAX_DURATION_SEC} detik.`);
    return null;
  }

  // Kompresi via react-native-compressor — preset 'medium' = balance quality/size
  let compressedUri = asset.uri;
  try {
    compressedUri = await Video.compress(
      asset.uri,
      {
        compressionMethod: 'auto',
        maxSize:           720,        // resize ke max 720p
        bitrate:           1_500_000,  // ~1.5 Mbps → kualitas medium
      },
      (_progress) => { /* progress callback bisa dipakai untuk UI nanti */ },
    );
  } catch (e: any) {
    // Kalau kompresi gagal, pakai original. User masih bisa upload.
    console.warn('[videoPicker] compress gagal, pakai original:', e?.message);
  }

  // Generate thumbnail dari frame pertama
  let thumbUri = '';
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(compressedUri, {
      time:    500,    // ambil frame pada ms 500
      quality: 0.7,
    });
    thumbUri = uri;
  } catch (e: any) {
    throw new Error('Gagal membuat thumbnail video: ' + (e?.message ?? 'unknown'));
  }

  // Filename yang aman buat backend
  const stamp = Date.now();
  const ext   = Platform.OS === 'ios' ? 'mp4' : (compressedUri.split('.').pop() ?? 'mp4');

  return {
    video: {
      uri:         compressedUri,
      name:        `video-${stamp}.${ext}`,
      type:        ext === 'mov' ? 'video/quicktime' : 'video/mp4',
      durationSec: rawDurationSec,
    },
    thumbnail: {
      uri:  thumbUri,
      name: `video-${stamp}-thumb.jpg`,
      type: 'image/jpeg',
    },
  };
}

/** Format detik ke MM:SS untuk display di overlay thumbnail. */
export function formatDuration(sec?: number | null): string {
  if (!sec || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
