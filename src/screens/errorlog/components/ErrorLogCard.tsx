import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ErrorLog } from '../../../api/errorLog';

type Props = {
  log: ErrorLog;
  onPress?: () => void;
};

const STATUS_STYLE = {
  open:        { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', label: 'Open' },
  in_progress: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Proses' },
  resolved:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', label: 'Resolved' },
  closed:      { bg: 'rgba(107,114,128,0.15)',color: '#8a94a6', label: 'Closed' },
} as const;

function formatDate(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ErrorLogCard({ log, onPress }: Props) {
  const statusStyle = STATUS_STYLE[log.status];

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      {/* Top row: status pill + kategori */}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
        </View>
        {log.kategori?.nama && (
          <Text style={styles.kategoriText} numberOfLines={1}>
            <Ionicons name="pricetag-outline" size={11} color="#8a94a6" /> {log.kategori.nama}
          </Text>
        )}
        <Text style={styles.dateText}>{formatDate(log.created_at)}</Text>
      </View>

      {/* Klien */}
      {log.klien?.nama && (
        <Text style={styles.klienText} numberOfLines={1}>
          <Ionicons name="business-outline" size={12} color="#3b82f6" /> {log.klien.nama}
        </Text>
      )}

      {/* Keterangan */}
      <Text style={styles.keterangan} numberOfLines={3}>{log.keterangan}</Text>

      {/* Footer: pelapor + handler + komentar count */}
      <View style={styles.footer}>
        {log.pelapor && (
          <View style={styles.userBox}>
            {log.pelapor.foto ? (
              <Image source={{ uri: log.pelapor.foto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{log.pelapor.nama_lengkap.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.userText} numberOfLines={1}>{log.pelapor.nama_lengkap}</Text>
          </View>
        )}

        {log.handler && (
          <>
            <Ionicons name="arrow-forward" size={12} color="#6b7280" />
            <View style={styles.userBox}>
              {log.handler.foto ? (
                <Image source={{ uri: log.handler.foto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{log.handler.nama_lengkap.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.userText} numberOfLines={1}>{log.handler.nama_lengkap}</Text>
            </View>
          </>
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
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  statusPill:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText:{ fontSize: 10, fontWeight: '600' },
  kategoriText: { color: '#8a94a6', fontSize: 11, flex: 1 },
  dateText:  { color: '#6b7280', fontSize: 10, marginLeft: 'auto' },
  klienText: { color: '#3b82f6', fontSize: 12, fontWeight: '500', marginBottom: 6 },
  keterangan:{ color: '#d6dce6', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  footer:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userBox:   { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 140 },
  avatar:    { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: '#fff', fontSize: 10, fontWeight: '700' },
  userText:  { color: '#c5cdd9', fontSize: 11, flexShrink: 1 },
});
