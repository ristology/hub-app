import React, { useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { invoiceApi } from '../../api/invoice';

type RouteParams = { id: number };

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

const PPN_LABEL: Record<string, string> = {
  tanpa:     'Tanpa PPN',
  eksklusif: 'PPN Eksklusif',
  inklusif:  'PPN Inklusif',
};

export default function InvoiceDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn:  () => invoiceApi.detail(id),
  });

  const toggleMut = useMutation({
    mutationFn: (bukti?: { uri: string; name: string; type: string }) =>
      invoiceApi.toggleLunas(id, bukti),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      setUploading(false);
    },
    onError: (e: any) => {
      setUploading(false);
      const msg = e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join('\n')
        ?? 'Gagal update status bayar.';
      Alert.alert('Error', msg);
    },
  });

  const pickAndUpload = async (source: 'camera' | 'gallery') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Aplikasi butuh akses kamera/galeri untuk upload bukti.');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploading(true);
    toggleMut.mutate({
      uri:  asset.uri,
      name: asset.fileName ?? `bukti_${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
  };

  const promptTandaiLunas = () => {
    Alert.alert('Tandai Lunas', 'Upload bukti transfer untuk menandai invoice ini lunas.', [
      { text: 'Batal' },
      { text: 'Foto Kamera',  onPress: () => pickAndUpload('camera') },
      { text: 'Pilih Galeri', onPress: () => pickAndUpload('gallery') },
    ]);
  };

  const promptResetBelum = () => {
    Alert.alert('Reset ke Belum Bayar', 'Status & bukti transfer akan dihapus. Yakin?', [
      { text: 'Batal' },
      { text: 'Reset', style: 'destructive', onPress: () => toggleMut.mutate(undefined) },
    ]);
  };

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  const inv = data.data;
  const isLunas = inv.status_bayar === 'lunas';
  const isTerlambat = inv.is_terlambat;
  const statusColor = isLunas ? '#22c55e' : (isTerlambat ? '#ef4444' : '#f59e0b');
  const statusLabel = isLunas ? 'Lunas' : (isTerlambat ? 'Terlambat' : 'Belum Bayar');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Detail Invoice</Text>
        <TouchableOpacity onPress={() => Linking.openURL(inv.view_url)} style={styles.iconBtn}>
          <Ionicons name="eye-outline" size={22} color="#3b82f6" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(inv.pdf_url)} style={styles.iconBtn}>
          <Ionicons name="download-outline" size={22} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.headerCard, { borderLeftColor: statusColor }]}>
          <View style={styles.statusRow}>
            <Text style={styles.noInvoice}>{inv.no_invoice}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.namaKlien}>{inv.klien?.nama ?? '—'}</Text>
          <Text style={styles.periode}>{inv.bulan_nama} {inv.tahun}</Text>
        </View>

        <Text style={styles.sectionLabel}>RINCIAN TAGIHAN</Text>
        <View style={styles.infoBox}>
          <DetailRow label="Tagihan Pokok" value={formatRupiah(inv.nominal_tagihan)} />
          {inv.nominal_pajak > 0 && (
            <DetailRow label={`PPN (${PPN_LABEL[inv.ppn_mode] ?? inv.ppn_mode})`} value={formatRupiah(inv.nominal_pajak)} />
          )}
          {inv.cashback > 0 && (
            <DetailRow label="Cashback" value={'- ' + formatRupiah(inv.cashback)} valueColor="#06b6d4" />
          )}
          <View style={styles.divider} />
          <DetailRow label="Total Tagihan" value={formatRupiah(inv.total)} valueColor="#22c55e" big />
        </View>

        {inv.perihal && (
          <>
            <Text style={styles.sectionLabel}>PERIHAL</Text>
            <Text style={styles.perihal}>{inv.perihal}</Text>
          </>
        )}

        {inv.keterangan && (
          <>
            <Text style={styles.sectionLabel}>KETERANGAN</Text>
            <Text style={styles.keterangan}>{inv.keterangan}</Text>
          </>
        )}

        <Text style={styles.sectionLabel}>STATUS PEMBAYARAN</Text>
        <View style={styles.infoBox}>
          <DetailRow label="Status" value={statusLabel} valueColor={statusColor} />
          {inv.tanggal_bayar && (
            <DetailRow label="Tanggal Bayar" value={formatDate(inv.tanggal_bayar)} />
          )}
          {inv.bukti_transfer && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.infoLabel}>Bukti Transfer</Text>
              <TouchableOpacity onPress={() => Linking.openURL(inv.bukti_transfer!)}>
                <Image source={{ uri: inv.bukti_transfer }} style={styles.buktiImage} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action button */}
        <View style={{ marginTop: 16 }}>
          {!isLunas ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
              onPress={promptTandaiLunas}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.actionText}>Tandai Lunas</Text>
                  </>
                )
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: '#ef4444' }]}
              onPress={promptResetBelum}
              disabled={toggleMut.isPending}
            >
              {toggleMut.isPending
                ? <ActivityIndicator color="#ef4444" />
                : (
                  <>
                    <Ionicons name="refresh" size={20} color="#ef4444" />
                    <Text style={[styles.actionText, { color: '#ef4444' }]}>Reset ke Belum Bayar</Text>
                  </>
                )
              }
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, valueColor, big }: {
  label: string; value: string; valueColor?: string; big?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[
        big ? styles.detailValueBig : styles.detailValue,
        valueColor && { color: valueColor },
      ]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderLeftWidth: 4, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  noInvoice: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700' },
  namaKlien: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  periode:   { color: '#8a94a6', fontSize: 13 },

  sectionLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 18, marginBottom: 8,
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },

  detailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel:    { color: '#8a94a6', fontSize: 13 },
  detailValue:    { color: '#fff', fontSize: 13, fontWeight: '600' },
  detailValueBig: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider:        { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 6 },

  perihal:    { color: '#fff', fontSize: 14, lineHeight: 21 },
  keterangan: { color: '#d6dce6', fontSize: 14, lineHeight: 21 },

  infoLabel: { color: '#8a94a6', fontSize: 11, marginBottom: 6 },
  buktiImage: {
    width: '100%', height: 200, borderRadius: 8,
    backgroundColor: '#1c2333',
  },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
  },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
