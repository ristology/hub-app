import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Cashback } from '../../../api/cashback';

type Props = {
  cashback: Cashback;
  onPress?: () => void;
};

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CashbackCard({ cashback, onPress }: Props) {
  const isPaid      = cashback.status_bayar === 'paid';
  const statusColor = isPaid ? '#22c55e' : '#f59e0b';

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.namaKlien} numberOfLines={1}>
          {cashback.klien?.nama ?? '—'}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{cashback.status_label}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="receipt-outline" size={11} color="#8a94a6" />
        <Text style={styles.metaText}>{cashback.invoice?.no_invoice ?? '—'}</Text>
        <Text style={styles.metaDot}>•</Text>
        <Ionicons name="calendar-outline" size={11} color="#8a94a6" />
        <Text style={styles.metaText}>{cashback.bulan_nama} {cashback.tahun}</Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.nominal}>{formatRupiah(cashback.nominal)}</Text>
        {isPaid && cashback.metode_bayar && (
          <View style={[
            styles.metodeBadge,
            cashback.metode_bayar === 'dipotong' && styles.metodeBadgePotong,
          ]}>
            <Ionicons
              name={cashback.metode_bayar === 'dibayarkan' ? 'card-outline' : 'cut-outline'}
              size={10}
              color={cashback.metode_bayar === 'dibayarkan' ? '#3b82f6' : '#06b6d4'}
            />
            <Text style={[
              styles.metodeText,
              cashback.metode_bayar === 'dipotong' && { color: '#06b6d4' },
            ]}>{cashback.metode_bayar_label}</Text>
          </View>
        )}
      </View>

      {isPaid && cashback.tanggal_bayar && (
        <Text style={styles.tglBayar}>Dibayar: {formatDate(cashback.tanggal_bayar)}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginBottom: 8, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  namaKlien: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' },
  metaText: { color: '#8a94a6', fontSize: 11 },
  metaDot:  { color: '#4b5563', fontSize: 11 },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nominal: { color: '#22c55e', fontSize: 15, fontWeight: '700' },

  metodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  metodeBadgePotong: { backgroundColor: 'rgba(6,182,212,0.15)' },
  metodeText: { color: '#3b82f6', fontSize: 9, fontWeight: '700' },

  tglBayar: { color: '#8a94a6', fontSize: 10, marginTop: 6 },
});
