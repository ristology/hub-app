import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Feed } from '../../../api/feed';
import PhotoCarousel     from '../../../components/PhotoCarousel';
import VideoThumbnail    from '../../../components/VideoThumbnail';
import ImageViewerModal  from '../../../components/ImageViewerModal';
import MentionText       from '../../../components/MentionText';

type Props = {
  feed: Feed;
  onPress?: () => void;
  onLike?: () => void;
};

const { width } = Dimensions.get('window');
const PHOTO_HEIGHT = width - 32;

/**
 * Ringkas alamat panjang ke "Kota" saja untuk display di list.
 * Format yang masuk biasanya: "Tempat, Jalan, District, City, Region"
 * → ambil bagian setelah koma kedua dari belakang sebagai kota.
 */
function ringkasLokasi(lokasi: string): string {
  const parts = lokasi.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return lokasi;
  if (parts.length <= 2)  return parts.join(', ');
  // Untuk format panjang, ambil bagian kota (biasanya ke-2 atau ke-3 dari belakang).
  return parts[parts.length - 2] ?? parts[parts.length - 1];
}

export default function FeedCard({ feed, onPress, onLike }: Props) {
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  return (
    <View style={[styles.card, feed.has_unread_notif && styles.cardUnread]}>
      {feed.has_unread_notif && <View style={styles.unreadDot} />}
      {/* Header — avatar tap perbesar foto, sisanya tap masuk detail */}
      <View style={styles.header}>
        {feed.karyawan.foto ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setViewerUri(feed.karyawan.foto!)}>
            <Image source={{ uri: feed.karyawan.foto }} style={styles.avatar} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>
              {feed.karyawan.nama_lengkap?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.name} numberOfLines={1}>{feed.karyawan.nama_lengkap}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {feed.karyawan.jabatan ?? '—'}
            {feed.kategori ? ` · ${feed.kategori}` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Konten — tap masuk detail */}
      {feed.konten ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
          <MentionText text={feed.konten} style={styles.konten} numberOfLines={4} />
        </TouchableOpacity>
      ) : null}

      {/* Foto carousel — tap foto buka lightbox fullscreen, swipe untuk pindah halaman */}
      {feed.foto_urls?.length > 0 && (
        <View style={styles.photoWrap}>
          <PhotoCarousel
            fotos={feed.foto_urls}
            height={PHOTO_HEIGHT * 0.7}
            onPressPhoto={(uri) => setViewerUri(uri)}
          />
        </View>
      )}

      {/* Video thumbnail — tap card untuk masuk detail (player) */}
      {feed.video_thumbnail_url && (
        <View style={styles.photoWrap}>
          <VideoThumbnail
            thumbnailUri={feed.video_thumbnail_url}
            durationSec={feed.video_duration_sec}
            onPress={onPress}
            height={Math.round(PHOTO_HEIGHT * 0.6)}
          />
        </View>
      )}

      {/* Footer aksi */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={onLike} style={styles.action}>
          <Ionicons
            name={feed.sudah_like ? 'heart' : 'heart-outline'}
            size={22}
            color={feed.sudah_like ? '#ef4444' : '#8a94a6'}
          />
          <Text style={[styles.actionText, feed.sudah_like && { color: '#ef4444' }]}>
            {feed.jumlah_like}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onPress} style={styles.action}>
          <Ionicons name="chatbubble-outline" size={20} color="#8a94a6" />
          <Text style={styles.actionText}>{feed.jumlah_komentar}</Text>
        </TouchableOpacity>

        {feed.lokasi ? (
          <View style={styles.lokasi}>
            <Ionicons name="location-outline" size={13} color="#8a94a6" />
            <Text style={styles.lokasiText} numberOfLines={1} ellipsizeMode="tail">
              {ringkasLokasi(feed.lokasi)}
            </Text>
          </View>
        ) : null}
      </View>

      <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, marginBottom: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  /** Border merah tipis + bg sedikit kemerahan saat ada notif unread. */
  cardUnread: {
    borderColor: 'rgba(239,68,68,0.45)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  /** Dot merah menyala di pojok kanan atas saat ada notif. */
  unreadDot: {
    position: 'absolute',
    top: -4, right: -4,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 2, borderColor: '#0d1421',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 10,
  },
  header:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: '#fff', fontWeight: '700' },
  name:      { color: '#fff', fontWeight: '600', fontSize: 14 },
  meta:      { color: '#8a94a6', fontSize: 11, marginTop: 1 },
  konten:    { color: '#d6dce6', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  photoWrap: { marginBottom: 10 },
  footer:    { flexDirection: 'row', alignItems: 'center', gap: 18 },
  action:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText:{ color: '#8a94a6', fontSize: 13 },
  lokasi:    {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginLeft: 'auto', flexShrink: 1, maxWidth: 140,
  },
  lokasiText:{ color: '#8a94a6', fontSize: 11 },
});
