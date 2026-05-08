import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Dokumen } from '../../../api/dokumen';

type Props = {
  dokumen: Dokumen;
  onPress?: () => void;
};

const TIPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf:     'document-text',
  docx:    'document',
  pptx:    'easel',
  xlsx:    'grid',
  image:   'image',
  lainnya: 'document-attach',
};

const TIPE_COLOR: Record<string, string> = {
  pdf:     '#e74a3b',
  docx:    '#2b7cd3',
  pptx:    '#d04423',
  xlsx:    '#1d7044',
  image:   '#4f6af0',
  lainnya: '#858796',
};

export default function DokumenCard({ dokumen, onPress }: Props) {
  const color = TIPE_COLOR[dokumen.tipe] ?? '#858796';
  const icon  = TIPE_ICON[dokumen.tipe]  ?? 'document-attach';

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.judul} numberOfLines={2}>{dokumen.judul}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.tipeBadge, { color }]}>{dokumen.tipe.toUpperCase()}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{dokumen.ukuran_format}</Text>
          {dokumen.kategori && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>{dokumen.kategori}</Text>
            </>
          )}
        </View>
        <View style={styles.bottomRow}>
          {dokumen.pengunggah && (
            <Text style={styles.uploader} numberOfLines={1}>
              {dokumen.pengunggah.nama_lengkap}
            </Text>
          )}
          <View style={styles.dlBadge}>
            <Ionicons name="download-outline" size={10} color="#8a94a6" />
            <Text style={styles.dlCount}>{dokumen.jumlah_unduhan}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginBottom: 8, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  judul: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  tipeBadge: { fontSize: 10, fontWeight: '700' },
  metaDot:   { color: '#6b7280', fontSize: 11 },
  meta:      { color: '#8a94a6', fontSize: 11 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploader:  { color: '#8a94a6', fontSize: 11, flex: 1 },
  dlBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dlCount:   { color: '#8a94a6', fontSize: 10 },
});
