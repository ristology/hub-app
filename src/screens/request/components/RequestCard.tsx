import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClientRequest } from '../../../api/clientRequest';

type Props = {
  request: ClientRequest;
  onPress?: () => void;
};

const STATUS_STYLE = {
  menunggu: { bg: 'rgba(107,114,128,0.15)', color: '#8a94a6', label: 'Menunggu' },
  diterima: { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', label: 'Diterima' },
  proses:   { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', label: 'Proses' },
  selesai:  { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Selesai' },
  ditolak:  { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: 'Ditolak' },
} as const;

const DEADLINE_COLOR = {
  normal:  '#22c55e',
  near:    '#f59e0b',
  overdue: '#ef4444',
} as const;

function formatDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RequestCard({ request, onPress }: Props) {
  const statusStyle = STATUS_STYLE[request.status];
  const deadlineColor = DEADLINE_COLOR[request.deadline_status];
  const tglRequest = formatDate(request.tanggal_request);
  const tglDeadline = formatDate(request.deadline);

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.card, request.has_unread_notif && styles.cardUnread]}>
      {request.has_unread_notif && <View style={styles.unreadDot} />}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
        </View>
        {request.deadline_status === 'overdue' && (
          <View style={styles.overdueBadge}>
            <Ionicons name="alert-circle" size={11} color="#ef4444" />
            <Text style={styles.overdueText}>Overdue</Text>
          </View>
        )}
      </View>

      <Text style={styles.namaKlien} numberOfLines={1}>{request.nama_klien}</Text>
      <Text style={styles.keterangan} numberOfLines={2}>{request.keterangan}</Text>

      <View style={styles.metaRow}>
        {tglRequest && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={11} color="#8a94a6" />
            <Text style={styles.metaText}>{tglRequest}</Text>
          </View>
        )}
        {tglDeadline && (
          <View style={styles.metaItem}>
            <Ionicons name="flag-outline" size={11} color={deadlineColor} />
            <Text style={[styles.metaText, { color: deadlineColor }]}>{tglDeadline}</Text>
          </View>
        )}
        {request.jumlah_lampiran ? (
          <View style={styles.metaItem}>
            <Ionicons name="attach-outline" size={11} color="#8a94a6" />
            <Text style={styles.metaText}>{request.jumlah_lampiran}</Text>
          </View>
        ) : null}
        {request.jumlah_komentar ? (
          <View style={styles.metaItem}>
            <Ionicons name="chatbubble-outline" size={11} color="#8a94a6" />
            <Text style={styles.metaText}>{request.jumlah_komentar}</Text>
          </View>
        ) : null}
      </View>

      {request.pic && (
        <View style={styles.picRow}>
          <Ionicons name="person-circle-outline" size={12} color="#3b82f6" />
          <Text style={styles.picText} numberOfLines={1}>PIC: {request.pic.nama_lengkap}</Text>
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
    position: 'relative',
  },
  cardUnread: {
    borderColor: 'rgba(239,68,68,0.45)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  unreadDot: {
    position: 'absolute',
    top: -4, right: -4,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 2, borderColor: '#0d1421',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 10,
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
  namaKlien:  { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  keterangan: { color: '#c5cdd9', fontSize: 12, lineHeight: 17, marginBottom: 8 },
  metaRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  metaItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:   { color: '#8a94a6', fontSize: 11 },
  picRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  picText:    { color: '#3b82f6', fontSize: 11, fontWeight: '500', flex: 1 },
});
