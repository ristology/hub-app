import React, { useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { cashbackApi, type MetodeBayar } from '../../api/cashback';
import TandaiPaidSheet, { type BuktiFile } from './components/TandaiPaidSheet';

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

export default function CashbackDetailScreen() {
  const route       = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation  = useNavigation<any>();
  const { id }      = route.params;
  const queryClient = useQueryClient();

  const [paidOpen, setPaidOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cashback', id],
    queryFn:  () => cashbackApi.detail(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cashback', id] });
    queryClient.invalidateQueries({ queryKey: ['cashback'] });
    queryClient.invalidateQueries({ queryKey: ['cashback-stats'] });
  };

  const paidMut = useMutation({
    mutationFn: ({ metode, bukti }: { metode: MetodeBayar; bukti?: BuktiFile }) =>
      cashbackApi.markPaid(id, metode, bukti),
    onSuccess: () => { setPaidOpen(false); invalidate(); },
    onError: (e: any) => {
      const msg = e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join('\n')
        ?? 'Gagal menandai cashback Paid.';
      Alert.alert('Error', msg);
    },
  });

  const unpaidMut = useMutation({
    mutationFn: () => cashbackApi.markUnpaid(id),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal mengubah status.'),
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  const cb          = data.data;
  const isPaid      = cb.status_bayar === 'paid';
  const statusColor = isPaid ? '#22c55e' : '#f59e0b';
  const buktiPdf    = cb.bukti_transfer?.toLowerCase().endsWith('.pdf');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Detail Cashback</Text>
        {cb.invoice && (
          <TouchableOpacity onPress={() => Linking.openURL(cb.invoice!.view_url)} style={styles.iconBtn}>
            <Ionicons name="eye-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.headerCard, { borderLeftColor: statusColor }]}>
          <View style={styles.statusRow}>
            <Text style={styles.namaKlien} numberOfLines={2}>{cb.klien?.nama ?? '—'}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{cb.status_label}</Text>
            </View>
          </View>
          <Text style={styles.nominal}>{formatRupiah(cb.nominal)}</Text>
          <Text style={styles.periode}>{cb.bulan_nama} {cb.tahun}</Text>
          {cb.invoice && <Text style={styles.noInvoice}>{cb.invoice.no_invoice}</Text>}
        </View>

        {cb.keterangan && (
          <>
            <Text style={styles.sectionLabel}>KETERANGAN</Text>
            <Text style={styles.keterangan}>{cb.keterangan}</Text>
          </>
        )}

        <Text style={styles.sectionLabel}>STATUS PEMBAYARAN</Text>
        <View style={styles.infoBox}>
          <DetailRow label="Status" value={cb.status_label} valueColor={statusColor} />
          {isPaid && (
            <>
              <DetailRow label="Metode" value={cb.metode_bayar_label} />
              <DetailRow label="Dibayar" value={formatDateTime(cb.tanggal_bayar)} />
            </>
          )}
          {cb.bukti_transfer && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.infoLabel}>Bukti Transfer</Text>
              {buktiPdf ? (
                <TouchableOpacity style={styles.pdfBox} onPress={() => Linking.openURL(cb.bukti_transfer!)}>
                  <Ionicons name="document-text-outline" size={20} color="#ef4444" />
                  <Text style={styles.pdfText}>Buka bukti transfer (PDF)</Text>
                  <Ionicons name="open-outline" size={16} color="#8a94a6" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => Linking.openURL(cb.bukti_transfer!)}>
                  <Image source={{ uri: cb.bukti_transfer }} style={styles.buktiImage} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={{ marginTop: 16 }}>
          {!isPaid ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
              onPress={() => setPaidOpen(true)}
              disabled={paidMut.isPending}
            >
              {paidMut.isPending ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.actionText}>Tandai Paid</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGhost]}
              onPress={() => Alert.alert(
                'Kembalikan ke Unpaid',
                'Status, metode, dan bukti transfer akan dihapus. Yakin?',
                [
                  { text: 'Batal' },
                  { text: 'Kembalikan', style: 'destructive', onPress: () => unpaidMut.mutate() },
                ],
              )}
              disabled={unpaidMut.isPending}
            >
              {unpaidMut.isPending ? <ActivityIndicator color="#ef4444" /> : (
                <>
                  <Ionicons name="refresh" size={20} color="#ef4444" />
                  <Text style={[styles.actionText, { color: '#ef4444' }]}>Kembalikan ke Unpaid</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <TandaiPaidSheet
        visible={paidOpen}
        judul={cb.klien?.nama ?? ''}
        nominal={formatRupiah(cb.nominal)}
        submitting={paidMut.isPending}
        onClose={() => setPaidOpen(false)}
        onSubmit={(payload) => paidMut.mutate(payload)}
      />
    </SafeAreaView>
  );
}

function DetailRow({ label, value, valueColor }: {
  label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
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
  nominal:    { color: '#22c55e', fontSize: 20, fontWeight: '700', marginTop: 8 },
  periode:    { color: '#c5cdd9', fontSize: 13, marginTop: 4 },
  noInvoice:  { color: '#8a94a6', fontSize: 12, marginTop: 2 },

  sectionLabel: {
    color: '#8a94a6', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, marginTop: 18, marginBottom: 8,
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  infoLabel: { color: '#8a94a6', fontSize: 12, marginBottom: 6 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, paddingVertical: 5,
  },
  detailLabel: { color: '#8a94a6', fontSize: 12, flex: 1 },
  detailValue: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'right' },

  keterangan: { color: '#c5cdd9', fontSize: 13, lineHeight: 19 },

  buktiImage: {
    width: '100%', height: 220, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pdfBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pdfText: { color: '#fff', fontSize: 13, flex: 1 },

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
