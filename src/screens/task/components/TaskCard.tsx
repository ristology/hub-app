import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Tugas } from '../../../api/tugas';

type Props = {
  task: Tugas;
  onPress?: () => void;
};

const PRIORITAS_COLOR = {
  tinggi: '#ef4444',
  sedang: '#f59e0b',
  rendah: '#6b7280',
} as const;

const STATUS_STYLE = {
  belum:   { bg: 'rgba(107,114,128,0.15)', color: '#8a94a6', label: 'Belum' },
  proses:  { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', label: 'Proses' },
  selesai: { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Selesai' },
} as const;

function formatDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TaskCard({ task, onPress }: Props) {
  const statusStyle = STATUS_STYLE[task.status];
  const isLate = task.tanggal_selesai
    && task.status !== 'selesai'
    && new Date(task.tanggal_selesai) < new Date();

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      {/* Top row: status pill + prioritas dot */}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: PRIORITAS_COLOR[task.prioritas] }]} />
        <Text style={styles.prioritasText}>{task.prioritas.toUpperCase()}</Text>
        {isLate && (
          <View style={styles.lateBadge}>
            <Ionicons name="alert-circle" size={11} color="#ef4444" />
            <Text style={styles.lateText}>Terlambat</Text>
          </View>
        )}
      </View>

      {/* Judul */}
      <Text style={styles.judul} numberOfLines={2}>{task.judul}</Text>

      {/* Deskripsi (kalau ada) */}
      {task.deskripsi ? (
        <Text style={styles.deskripsi} numberOfLines={2}>{task.deskripsi}</Text>
      ) : null}

      {/* Footer: assignee + tanggal */}
      <View style={styles.footer}>
        {task.karyawan?.foto ? (
          <Image source={{ uri: task.karyawan.foto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>
              {task.karyawan?.nama_lengkap?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <Text style={styles.assignee} numberOfLines={1}>
          {task.karyawan?.nama_lengkap ?? '—'}
        </Text>

        {task.tanggal_selesai && (
          <View style={styles.dateBox}>
            <Ionicons name="calendar-outline" size={11} color="#8a94a6" />
            <Text style={styles.dateText}>{formatDate(task.tanggal_selesai)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginBottom: 10, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  prioritasText: { color: '#8a94a6', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  lateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(239,68,68,0.10)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    marginLeft: 'auto',
  },
  lateText: { color: '#ef4444', fontSize: 10, fontWeight: '600' },
  judul: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  deskripsi: { color: '#8a94a6', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  assignee: { color: '#c5cdd9', fontSize: 12, flex: 1 },
  dateBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { color: '#8a94a6', fontSize: 11 },
});
