import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PerformanceItem } from '../../../api/performance';

type Props = {
  item: PerformanceItem;
  onPress?: () => void;
};

function formatDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNilai(n: string | null): string | null {
  if (!n) return null;
  const num = Number(n);
  if (Number.isNaN(num)) return null;
  return 'Rp ' + num.toLocaleString('id-ID');
}

export default function PerformanceCard({ item, onPress }: Props) {
  const isKontrak = item.jenis === 'kontrak';
  const color = isKontrak ? '#22c55e' : '#3b82f6';
  const icon  = isKontrak ? 'document-text' : 'calendar';
  const tgl   = formatDate(item.tanggal);
  const nilai = formatNilai(item.nilai_kontrak);

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <View style={[styles.jenisPill, { backgroundColor: color + '22' }]}>
            <Text style={[styles.jenisText, { color }]}>{item.jenis_label}</Text>
          </View>
          {tgl && <Text style={styles.tglText}>{tgl}</Text>}
        </View>

        <Text style={styles.namaKlien} numberOfLines={1}>{item.nama_klien}</Text>

        {item.pic && (
          <View style={styles.metaRow}>
            {item.pic.foto ? (
              <Image source={{ uri: item.pic.foto }} style={styles.miniAvatar} />
            ) : (
              <View style={[styles.miniAvatar, styles.miniAvatarFb]}>
                <Text style={styles.miniAvatarText}>{item.pic.nama.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.metaText} numberOfLines={1}>PIC: {item.pic.nama}</Text>
          </View>
        )}

        {isKontrak && nilai && (
          <Text style={styles.nilaiText}>{nilai}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginBottom: 8, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  jenisPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  jenisText: { fontSize: 10, fontWeight: '700' },
  tglText:   { color: '#8a94a6', fontSize: 11, marginLeft: 'auto' },
  namaKlien: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  miniAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#1c2333' },
  miniAvatarFb: { alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  metaText:  { color: '#8a94a6', fontSize: 11, flex: 1 },
  nilaiText: { color: '#22c55e', fontSize: 12, fontWeight: '700', marginTop: 4 },
});
