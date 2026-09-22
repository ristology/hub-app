import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pajak } from '../../../api/pajak';

type Props = {
  pajak: Pajak;
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

export default function PajakCard({ pajak, onPress }: Props) {
  const isPaid      = pajak.status_bayar === 'paid';
  const isTerlambat = pajak.is_terlambat;
  const statusColor = isPaid ? '#22c55e' : (isTerlambat ? '#ef4444' : '#f59e0b');

  // Penanda oranye: invoice terkait sudah LUNAS tapi pajaknya belum disetor.
  // Sama dengan highlight .invoice-lunas di kartu web.
  const invoiceLunas = pajak.invoice?.status_bayar === 'lunas' && !isPaid;

  // Warna aksen tepi kiri — prioritas merah (terlambat) di atas oranye,
  // persis aturan web.
  const accent = isTerlambat ? '#ef4444' : (invoiceLunas ? '#f97316' : null);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.namaKlien} numberOfLines={1}>
          {pajak.klien?.nama ?? '—'}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{pajak.status_label}</Text>
        </View>
      </View>

      {invoiceLunas && (
        <View style={styles.flagRow}>
          <View style={styles.flagBadge}>
            <Ionicons name="cash-outline" size={10} color="#fff" />
            <Text style={styles.flagText}>Invoice Lunas — pajak belum disetor</Text>
          </View>
        </View>
      )}

      <View style={styles.metaRow}>
        <Ionicons name="receipt-outline" size={11} color="#8a94a6" />
        <Text style={styles.metaText}>{pajak.invoice?.no_invoice ?? '—'}</Text>
        <Text style={styles.metaDot}>•</Text>
        <Ionicons name="calendar-outline" size={11} color="#8a94a6" />
        <Text style={styles.metaText}>{pajak.bulan_nama} {pajak.tahun}</Text>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.nominalGroup}>
          <Text style={styles.nominalLabel}>DPP</Text>
          <Text style={styles.dppText}>{formatRupiah(pajak.dpp)}</Text>
        </View>
        <View style={[styles.nominalGroup, { alignItems: 'flex-end' }]}>
          <Text style={styles.nominalLabel}>PPN</Text>
          <Text style={styles.ppnText}>{formatRupiah(pajak.nominal_pajak)}</Text>
        </View>
      </View>

      <View style={styles.footRow}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeText}>{pajak.ppn_mode_label}</Text>
        </View>
        {pajak.dokumen_lengkap && (
          <View style={styles.dokBadge}>
            <Ionicons name="checkmark-done" size={10} color="#22c55e" />
            <Text style={styles.dokText}>Dokumen lengkap</Text>
          </View>
        )}
        {isPaid && pajak.tanggal_bayar && (
          <Text style={styles.tglBayar}>Disetor: {formatDate(pajak.tanggal_bayar)}</Text>
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
  namaKlien: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },

  flagRow: { flexDirection: 'row', marginBottom: 6 },
  flagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f97316',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  flagText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' },
  metaText: { color: '#8a94a6', fontSize: 11 },
  metaDot:  { color: '#4b5563', fontSize: 11 },

  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  nominalGroup: { gap: 1 },
  nominalLabel: { color: '#6b7280', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  dppText: { color: '#c5cdd9', fontSize: 13, fontWeight: '600' },
  ppnText: { color: '#f59e0b', fontSize: 14, fontWeight: '700' },

  footRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap',
  },
  modeBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  modeText: { color: '#3b82f6', fontSize: 9, fontWeight: '700' },
  dokBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dokText: { color: '#22c55e', fontSize: 9, fontWeight: '600' },
  tglBayar: { color: '#8a94a6', fontSize: 10, marginLeft: 'auto' },
});
