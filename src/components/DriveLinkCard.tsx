/**
 * Card preview link Google Drive — auto-tampil di Feed kalau konten user
 * mengandung link Drive. Tap → buka di Drive app (kalau terinstall) atau
 * browser. Fallback thumbnail dari Drive API kalau file public.
 *
 * Tidak pakai WebView supaya bisa OTA tanpa native rebuild. Kalau nanti
 * mau full inline player, ganti komponen ini pakai react-native-webview.
 */
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { driveOpenUrl, driveThumbnailUrl } from '../utils/driveEmbed';

type Props = {
  fileId: string;
};

export default function DriveLinkCard({ fileId }: Props) {
  const [thumbErr, setThumbErr] = useState(false);

  const onPress = async () => {
    const url = driveOpenUrl(fileId);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Gagal buka link Google Drive.');
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.wrap}
    >
      <View style={styles.thumbBox}>
        {!thumbErr ? (
          <Image
            source={{ uri: driveThumbnailUrl(fileId, 800) }}
            style={styles.thumb}
            onError={() => setThumbErr(true)}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="logo-google" size={36} color="#4285F4" />
            <Text style={styles.fallbackText}>Google Drive</Text>
          </View>
        )}
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.95)" />
        </View>
      </View>

      <View style={styles.meta}>
        <View style={styles.driveIconWrap}>
          <Ionicons name="logo-google" size={14} color="#4285F4" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Video di Google Drive</Text>
          <Text style={styles.subtitle}>Tap untuk tonton</Text>
        </View>
        <Ionicons name="open-outline" size={16} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  thumbBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#111827',
  },
  fallbackText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  meta: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  driveIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(66,133,244,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { color: '#fff', fontSize: 13, fontWeight: '600' },
  subtitle: { color: '#9ca3af', fontSize: 11, marginTop: 1 },
});
