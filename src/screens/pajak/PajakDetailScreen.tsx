import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';

import {
  pajakApi, JENIS_DOKUMEN_PAJAK,
  type Pajak, type JenisDokumenPajak,
} from '../../api/pajak';
import { transcodeHeicIfNeeded } from '../../utils/transcodeHeicIfNeeded';

type RouteParams = { id: number };

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatDateTime(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
       + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function PajakDetailScreen() {
  const route       = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation  = useNavigation<any>();
  const { id }      = route.params;
  const queryClient = useQueryClient();

  const [uploadingJenis, setUploadingJenis] = useState<JenisDokumenPajak | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pajak', id],
    queryFn:  () => pajakApi.detail(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pajak', id] });
    queryClient.invalidateQueries({ queryKey: ['pajak'] });
    queryClient.invalidateQueries({ queryKey: ['pajak-stats'] });
  };

  const statusMut = useMutation({
    mutationFn: (paid: boolean) => paid ? pajakApi.markPaid(id) : pajakApi.markUnpaid(id),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal mengubah status pajak.'),
  });

  const uploadMut = useMutation({
    mutationFn: ({ jenis, file }: {
      jenis: JenisDokumenPajak; file: { uri: string; name: string; type: string };
    }) => pajakApi.uploadDokumen(id, jenis, file),
    onSuccess: invalidate,
    onSettled: () => setUploadingJenis(null),
    onError: (e: any) => {
      const msg = e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join('\n')
        ?? 'Gagal upload dokumen.';
      Alert.alert('Error', msg);
    },
  });

  const hapusMut = useMutation({
    mutationFn: (jenis: JenisDokumenPajak) => pajakApi.hapusDokumen(id, jenis),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal menghapus dokumen.'),
  });

  const pilihDokumen = async (jenis: JenisDokumenPajak) => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    setUploadingJenis(jenis);
    try {
      // iPhone bisa menyerahkan HEIC — server hanya menerima pdf/jpg/png.
      const file = await transcodeHeicIfNeeded({
        uri:  asset.uri,
        name: asset.name ?? `dokumen_${Date.now()}`,
        type: asset.mimeType ?? 'application/octet-stream',
      });
      uploadMut.mutate({ jenis, file });
    } catch {
      setUploadingJenis(null);
      Alert.alert('Error', 'Gagal membaca file yang dipilih.');
    }
  };

  const konfirmasiHapus = (jenis: JenisDokumenPajak, label: string) => {
    Alert.alert('Hapus Dokumen', `Hapus ${label}? File akan dihapus permanen dari server.`, [
      { text: 'Batal' },
      { text: 'Hapus', style: 'destructive', onPress: () => hapusMut.mutate(jenis) },
    ]);
  };

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  const p           = data.data;
  const isPaid      = p.status_bayar === 'paid';
  const statusColor = isPaid ? '#22c55e' : (p.is_terlambat ? '#ef4444' : '#f59e0b');
  const invoiceLunas = p.invoice?.status_bayar === 'lunas' && !isPaid;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Detail Pajak</Text>
        {p.invoice && (
          <TouchableOpacity onPress={() => Linking.openURL(p.invoice!.view_url)} style={styles.iconBtn}>
            <Ionicons name="eye-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.headerCard, { borderLeftColor: statusColor }]}>
          <View style={styles.statusRow}>
            <Text style={styles.namaKlien} numberOfLines={2}>{p.klien?.nama ?? '—'}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{p.status_label}</Text>
            </View>
          </View>
          <Text style={styles.periode}>{p.bulan_nama} {p.tahun}</Text>
          {p.invoice && <Text style={styles.noInvoice}>{p.invoice.no_invoice}</Text>}
        </View>

        {invoiceLunas && (
          <View style={styles.warnBox}>
            <Ionicons name="alert-circle" size={16} color="#f97316" />
            <Text style={styles.warnText}>
              Invoice sudah lunas tapi PPN-nya belum disetor.
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>RINCIAN PPN</Text>
        <View style={styles.infoBox}>
          <DetailRow label="DPP (Dasar Pengenaan)" value={formatRupiah(p.dpp)} />
          <DetailRow label="Nominal PPN" value={formatRupiah(p.nominal_pajak)} valueColor="#f59e0b" big />
          <View style={styles.divider} />
          <DetailRow label="Mode PPN" value={p.ppn_mode_label} />
        </View>

        {p.keterangan && (
          <>
            <Text style={styles.sectionLabel}>KETERANGAN</Text>
            <Text style={styles.keterangan}>{p.keterangan}</Text>
          </>
        )}

        <Text style={styles.sectionLabel}>STATUS PENYETORAN</Text>
        <View style={styles.infoBox}>
          <DetailRow label="Status" value={p.status_label} valueColor={statusColor} />
          {isPaid && <DetailRow label="Disetor" value={formatDateTime(p.tanggal_bayar)} />}
        </View>

        <Text style={styles.sectionLabel}>DOKUMEN PENDUKUNG</Text>
        <View style={styles.infoBox}>
          {JENIS_DOKUMEN_PAJAK.map(({ key, label }, idx) => {
            const url     = p[key];
            const busy    = uploadingJenis === key;
            return (
              <View key={key} style={[styles.dokRow, idx > 0 && styles.dokRowBorder]}>
                <Ionicons
                  name={url ? 'document-text' : 'document-outline'}
                  size={18}
                  color={url ? '#22c55e' : '#6b7280'}
                />
                <Text style={styles.dokLabel}>{label}</Text>
                {busy ? (
                  <ActivityIndicator color="#3b82f6" />
                ) : url ? (
                  <View style={styles.dokActions}>
                    <TouchableOpacity onPress={() => Linking.openURL(url)} hitSlop={8}>
                      <Ionicons name="open-outline" size={18} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => pilihDokumen(key)} hitSlop={8}>
                      <Ionicons name="swap-horizontal-outline" size={18} color="#8a94a6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => konfirmasiHapus(key, label)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadBtn} onPress={() => pilihDokumen(key)}>
                    <Ionicons name="cloud-upload-outline" size={14} color="#3b82f6" />
                    <Text style={styles.uploadText}>Upload</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
        <Text style={styles.dokHint}>Format PDF, JPG, JPEG, atau PNG. Maksimal 5 MB per file.</Text>

        <View style={{ marginTop: 16 }}>
          {!isPaid ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
              onPress={() => statusMut.mutate(true)}
              disabled={statusMut.isPending}
            >
              {statusMut.isPending ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.actionText}>Tandai Sudah Disetor</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGhost]}
              onPress={() => Alert.alert('Kembalikan ke Belum Setor', 'Status pajak akan dikembalikan ke belum disetor. Yakin?', [
                { text: 'Batal' },
                { text: 'Kembalikan', style: 'destructive', onPress: () => statusMut.mutate(false) },
              ])}
              disabled={statusMut.isPending}
            >
              {statusMut.isPending ? <ActivityIndicator color="#ef4444" /> : (
                <>
                  <Ionicons name="refresh" size={20} color="#ef4444" />
                  <Text style={[styles.actionText, { color: '#ef4444' }]}>Kembalikan ke Belum Setor</Text>
                </>
              )}
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
        styles.detailValue,
        valueColor ? { color: valueColor } : null,
        big ? { fontSize: 15, fontWeight: '700' } : null,
      ]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll:    { padding: 16, paddingBottom: 60 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 8 },
  iconBtn:  { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },

  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  namaKlien: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  periode:    { color: '#c5cdd9', fontSize: 13, marginTop: 4 },
  noInvoice:  { color: '#8a94a6', fontSize: 12, marginTop: 2 },

  warnBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: 10, padding: 12, marginTop: 12,
  },
  warnText: { color: '#fdba74', fontSize: 12, flex: 1 },

  sectionLabel: {
    color: '#8a94a6', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, marginTop: 18, marginBottom: 8,
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, paddingVertical: 5,
  },
  detailLabel: { color: '#8a94a6', fontSize: 12, flex: 1 },
  detailValue: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'right' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 },

  keterangan: { color: '#c5cdd9', fontSize: 13, lineHeight: 19 },

  dokRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  dokRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  dokLabel: { color: '#fff', fontSize: 13, flex: 1 },
  dokActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
  },
  uploadText: { color: '#3b82f6', fontSize: 11, fontWeight: '700' },
  dokHint: { color: '#6b7280', fontSize: 10, marginTop: 6 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
  },
  actionBtnGhost: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1, borderColor: '#ef4444',
  },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
