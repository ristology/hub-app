import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Kegiatan } from '../../../api/kalender';

type Props = {
  kegiatan: Kegiatan;
  onPress?: () => void;
};

const KATEGORI_LABEL: Record<string, string> = {
  kegiatan:      'Kegiatan',
  rapat:         'Rapat',
  deadline:      'Deadline',
  cuti:          'Cuti',
  lembur:        'Lembur',
  ujian_sekolah: 'Ujian Sekolah',
  lainnya:       'Lainnya',
};

function formatTime(s: string): string {
  return new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function KegiatanCard({ kegiatan, onPress }: Props) {
  const myRsvp = kegiatan.peserta?.find(p => p.is_me)?.status;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      <View style={[styles.colorBar, { backgroundColor: kegiatan.warna }]} />

      <View style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <Text style={styles.judul} numberOfLines={1}>{kegiatan.judul}</Text>
          {kegiatan.readonly && (
            <View style={styles.readonlyBadge}>
              <Ionicons name="link" size={10} color="#8a94a6" />
              <Text style={styles.readonlyText}>Task</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={11} color="#8a94a6" />
          <Text style={styles.metaText}>
            {kegiatan.seharian
              ? 'Sepanjang hari'
              : `${formatTime(kegiatan.mulai_at)} – ${formatTime(kegiatan.selesai_at)}`
            }
          </Text>
        </View>

        {kegiatan.lokasi && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={11} color="#8a94a6" />
            <Text style={styles.metaText} numberOfLines={1}>{kegiatan.lokasi}</Text>
          </View>
        )}

        <View style={styles.bottomRow}>
          <View style={[styles.kategoriPill, { backgroundColor: kegiatan.warna + '22' }]}>
            <Text style={[styles.kategoriText, { color: kegiatan.warna }]}>
              {KATEGORI_LABEL[kegiatan.kategori] ?? kegiatan.kategori}
            </Text>
          </View>

          {kegiatan.peserta && kegiatan.peserta.length > 0 && (
            <View style={styles.pesertaCount}>
              <Ionicons name="people-outline" size={11} color="#8a94a6" />
              <Text style={styles.pesertaText}>{kegiatan.peserta.length}</Text>
            </View>
          )}

          {myRsvp === 'menunggu' && (
            <View style={[styles.rsvpBadge, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Text style={[styles.rsvpText, { color: '#f59e0b' }]}>RSVP?</Text>
            </View>
          )}
          {myRsvp === 'diterima' && (
            <View style={[styles.rsvpBadge, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
              <Text style={[styles.rsvpText, { color: '#22c55e' }]}>Hadir</Text>
            </View>
          )}
          {myRsvp === 'ditolak' && (
            <View style={[styles.rsvpBadge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <Text style={[styles.rsvpText, { color: '#ef4444' }]}>Tidak hadir</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  colorBar: { width: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingBottom: 4 },
  judul:  { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  readonlyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(138,148,166,0.15)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  readonlyText: { color: '#8a94a6', fontSize: 9, fontWeight: '600' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, marginTop: 2 },
  metaText: { color: '#8a94a6', fontSize: 11, flex: 1 },

  bottomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10,
  },
  kategoriPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  kategoriText: { fontSize: 10, fontWeight: '600' },
  pesertaCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pesertaText:  { color: '#8a94a6', fontSize: 11 },
  rsvpBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 'auto' },
  rsvpText:  { fontSize: 10, fontWeight: '600' },
});
