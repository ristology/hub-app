import React, { useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { dokumenApi } from '../../api/dokumen';
import { openDocumentExternal } from '../../utils/openDocument';

type RouteParams = { id: number };

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

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function DokumenDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const queryClient = useQueryClient();
  const [opening, setOpening] = useState(false);
  const [imgViewer, setImgViewer] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['dokumen', id],
    queryFn:  () => dokumenApi.detail(id),
  });

  const trackMut = useMutation({
    mutationFn: () => dokumenApi.trackDownload(id),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['dokumen', id] });
      queryClient.invalidateQueries({ queryKey: ['dokumen'] });
    },
  });

  const destroyMut = useMutation({
    mutationFn: () => dokumenApi.destroy(id),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['dokumen'] });
      queryClient.invalidateQueries({ queryKey: ['dokumen-folders'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus.'),
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  const dok   = data.data;
  const color = TIPE_COLOR[dok.tipe] ?? '#858796';
  const icon  = TIPE_ICON[dok.tipe]  ?? 'document-attach';

  const handleOpen = async () => {
    // Image: tampilkan di modal viewer in-app (tidak perlu download eksternal)
    if (dok.tipe === 'image') {
      setImgViewer(true);
      trackMut.mutate();
      return;
    }
    // Lainnya: download + open via OS
    setOpening(true);
    const ok = await openDocumentExternal(dok.file_url, dok.file_nama_asli);
    setOpening(false);
    if (ok) trackMut.mutate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Detail Dokumen</Text>
        {dok.can_delete && (
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Hapus Dokumen', 'Yakin hapus dokumen ini?', [
                { text: 'Batal' },
                { text: 'Hapus', style: 'destructive', onPress: () => destroyMut.mutate() },
              ])
            }
            style={styles.iconBtn}
          >
            <Ionicons name="trash-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <View style={[styles.bigIcon, { backgroundColor: color + '22' }]}>
            <Ionicons name={icon} size={48} color={color} />
          </View>
          <Text style={styles.judul}>{dok.judul}</Text>
          <Text style={styles.fileNama} numberOfLines={1}>{dok.file_nama_asli}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.tipeText, { color }]}>{dok.tipe.toUpperCase()}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.metaText}>{dok.ukuran_format}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.metaText}>{dok.kategori}</Text>
          </View>
        </View>

        {dok.deskripsi && (
          <>
            <Text style={styles.sectionLabel}>DESKRIPSI</Text>
            <Text style={styles.deskripsi}>{dok.deskripsi}</Text>
          </>
        )}

        <Text style={styles.sectionLabel}>INFO</Text>
        <View style={styles.infoBox}>
          {dok.folder && (
            <InfoRow icon="folder" label="Folder" value={dok.folder.nama} valueColor={dok.folder.warna} />
          )}
          {dok.pengunggah && (
            <InfoRow icon="person-outline" label="Pengunggah" value={dok.pengunggah.nama_lengkap} />
          )}
          <InfoRow icon="calendar-outline" label="Diunggah" value={formatDate(dok.created_at)} />
          <InfoRow icon="download-outline" label="Total Unduhan" value={`${dok.jumlah_unduhan}x`} />
        </View>

        {/* Action button */}
        <TouchableOpacity
          style={styles.openBtn}
          onPress={handleOpen}
          disabled={opening}
          activeOpacity={0.85}
        >
          {opening
            ? <ActivityIndicator color="#fff" />
            : (
              <>
                <Ionicons
                  name={dok.tipe === 'image' ? 'eye' : 'open'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.openText}>
                  {dok.tipe === 'image' ? 'Lihat Gambar' : 'Buka Dokumen'}
                </Text>
              </>
            )
          }
        </TouchableOpacity>
        <Text style={styles.openHint}>
          {dok.tipe === 'image'
            ? 'Tampilkan dalam aplikasi'
            : 'Akan dibuka dengan aplikasi yang terinstall di HP'}
        </Text>
      </ScrollView>

      {/* Image full-screen viewer */}
      {dok.tipe === 'image' && (
        <Modal visible={imgViewer} transparent animationType="fade" onRequestClose={() => setImgViewer(false)}>
          <View style={styles.imgOverlay}>
            <TouchableOpacity
              style={styles.imgClose}
              onPress={() => setImgViewer(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: dok.file_url }}
              style={styles.imgFull}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, valueColor }:
  { icon: any; label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color="#3b82f6" />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 8 },
  iconBtn:  { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },

  scroll: { padding: 16, paddingBottom: 32 },

  headerCard: {
    alignItems: 'center', padding: 20,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  bigIcon: {
    width: 80, height: 80, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  judul:    { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  fileNama: { color: '#8a94a6', fontSize: 12, textAlign: 'center', marginBottom: 12 },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipeText: { fontSize: 11, fontWeight: '700' },
  dot:      { color: '#6b7280', fontSize: 12 },
  metaText: { color: '#8a94a6', fontSize: 12 },

  sectionLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 18, marginBottom: 8,
  },
  deskripsi: { color: '#d6dce6', fontSize: 14, lineHeight: 21 },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  infoLabel: { color: '#8a94a6', fontSize: 11, marginBottom: 2 },
  infoValue: { color: '#fff', fontSize: 13, fontWeight: '500' },

  openBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14, borderRadius: 12,
    marginTop: 18,
  },
  openText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  openHint: { color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 8 },

  imgOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  imgClose:   {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 24, padding: 6,
  },
  imgFull:    { width: '100%', height: '100%' },
});
