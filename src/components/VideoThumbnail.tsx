import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDuration } from '../utils/videoPicker';

type Props = {
  thumbnailUri:  string;
  durationSec?:  number | null;
  onPress?:      () => void;
  height?:       number;
  borderRadius?: number;
  style?:        StyleProp<ViewStyle>;
};

/** Display thumbnail video dengan overlay play button + durasi.
 *  Untuk dipakai di FeedCard, FeedDetail, ErrorLogDetail, dan chat bubble. */
export default function VideoThumbnail({
  thumbnailUri, durationSec, onPress, height = 220, borderRadius = 12, style,
}: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.wrap, { height, borderRadius }, style]}
    >
      <Image source={{ uri: thumbnailUri }} style={[styles.image, { borderRadius }]} resizeMode="cover" />
      <View style={styles.overlay}>
        <View style={styles.playBtn}>
          <Ionicons name="play" size={28} color="#fff" />
        </View>
      </View>
      {durationSec != null && durationSec > 0 && (
        <View style={styles.durationBadge}>
          <Ionicons name="videocam" size={11} color="#fff" />
          <Text style={styles.durationText}>{formatDuration(durationSec)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%', position: 'relative',
    backgroundColor: '#1c2333', overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  durationBadge: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
