import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Invoice } from '../../../api/invoice';

type Props = {
  invoice: Invoice;
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

export default function InvoiceCard({ invoice, onPress }: Props) {
  const isLunas = invoice.status_bayar === 'lunas';
  const isTerlambat = invoice.is_terlambat;
  const statusColor = isLunas ? '#22c55e' : (isTerlambat ? '#ef4444' : '#f59e0b');
  const statusLabel = isLunas ? 'Lunas' : (isTerlambat ? 'Terlambat' : 'Belum Bayar');

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.noInvoice} numberOfLines={1}>{invoice.no_invoice}</Text>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {invoice.klien && (
        <Text style={styles.namaKlien} numberOfLines={1}>{invoice.klien.nama}</Text>
      )}

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={11} color="#8a94a6" />
        <Text style={styles.metaText}>{invoice.bulan_nama} {invoice.tahun}</Text>
        {invoice.ppn_mode !== 'tanpa' && (
          <View style={styles.ppnBadge}>
            <Text style={styles.ppnText}>+PPN</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.totalText}>{formatRupiah(invoice.total)}</Text>
        {invoice.tanggal_bayar && (
          <Text style={styles.tglBayar}>Bayar: {formatDate(invoice.tanggal_bayar)}</Text>
        )}
      </View>
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
  noInvoice: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },

  namaKlien: { color: '#c5cdd9', fontSize: 13, marginBottom: 6 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  metaText: { color: '#8a94a6', fontSize: 11 },
  ppnBadge: {
    backgroundColor: 'rgba(168,85,247,0.15)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    marginLeft: 6,
  },
  ppnText: { color: '#a855f7', fontSize: 9, fontWeight: '700' },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalText: { color: '#22c55e', fontSize: 14, fontWeight: '700' },
  tglBayar:  { color: '#8a94a6', fontSize: 11 },
});
