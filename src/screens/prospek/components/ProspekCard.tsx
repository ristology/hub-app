import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Prospek } from '../../../api/prospek';

type Props = {
  prospek: Prospek;
  onPress?: () => void;
};

const STATUS_STYLE = {
  prospek:   { bg: 'rgba(107,114,128,0.15)', color: '#8a94a6', label: 'Prospek' },
  follow_up: { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4', label: 'Follow Up' },
  proposal:  { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', label: 'Proposal' },
  negosiasi: { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', label: 'Negosiasi' },
  trial:     { bg: 'rgba(168,85,247,0.15)',  color: '#a855f7', label: 'Trial' },
  kontrak:   { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Kontrak' },
  batal:     { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: 'Batal' },
} as const;

const FOLLOWUP_COLOR = {
  normal:  '#8a94a6',
  near:    '#f59e0b',
  overdue: '#ef4444',
} as const;

function formatDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProspekCard({ prospek, onPress }: Props) {
  const statusStyle = STATUS_STYLE[prospek.status];
  const followUpColor = FOLLOWUP_COLOR[prospek.follow_up_status];
  const tglBerikutnya = formatDate(prospek.tanggal_pertemuan_berikutnya);

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      {/* Top row: status + nama klien */}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
        </View>
        {prospek.is_overdue && (
          <View style={styles.overdueBadge}>
            <Ionicons name="alert-circle" size={11} color="#ef4444" />
            <Text style={styles.overdueText}>Overdue</Text>
          </View>
        )}
      </View>

      <Text style={styles.namaKlien} numberOfLines={1}>{prospek.nama_klien}</Text>

      {/* Kontak */}
      {prospek.kontak_nama && (
        <Text style={styles.kontak} numberOfLines={1}>
          <Ionicons name="person-outline" size={11} color="#8a94a6" /> {prospek.kontak_nama}
        </Text>
      )}
      {prospek.kota && (
        <Text style={styles.kota} numberOfLines={1}>
          <Ionicons name="location-outline" size={11} color="#8a94a6" /> {prospek.kota}
        </Text>
      )}

      {/* Tanggal pertemuan berikutnya */}
      {tglBerikutnya && (
        <View style={styles.followUpRow}>
          <Ionicons name="calendar-outline" size={12} color={followUpColor} />
          <Text style={[styles.followUpText, { color: followUpColor }]}>
            Pertemuan berikutnya: {tglBerikutnya}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginBottom: 10, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusPill:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText:{ fontSize: 10, fontWeight: '600' },
  overdueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(239,68,68,0.10)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    marginLeft: 'auto',
  },
  overdueText:{ color: '#ef4444', fontSize: 10, fontWeight: '600' },
  namaKlien: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  kontak:    { color: '#c5cdd9', fontSize: 12, marginBottom: 2 },
  kota:      { color: '#8a94a6', fontSize: 11, marginBottom: 6 },
  followUpRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  followUpText: { fontSize: 11, fontWeight: '500' },
});
