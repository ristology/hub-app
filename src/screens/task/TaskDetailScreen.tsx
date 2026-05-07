import React from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { tugasApi, type TugasStatus } from '../../api/tugas';
import { useAuth } from '../../store/auth';

type RouteParams = { id: number };

const PRIORITAS_COLOR = { tinggi: '#ef4444', sedang: '#f59e0b', rendah: '#6b7280' } as const;

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function TaskDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation();
  const { id } = route.params;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['tugas', id],
    queryFn:  () => tugasApi.detail(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: TugasStatus) => tugasApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tugas', id] });
      queryClient.invalidateQueries({ queryKey: ['tugas'] });
      queryClient.invalidateQueries({ queryKey: ['tugas-stats'] });
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal ubah status.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tugasApi.destroy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tugas'] });
      queryClient.invalidateQueries({ queryKey: ['tugas-stats'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus task.'),
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  const task = data.data;
  const canDelete = user?.id === task.dibuat_oleh?.id || user?.role === 'admin' || user?.role === 'hr';

  const handleDelete = () => {
    Alert.alert(
      'Hapus Task?',
      `Yakin hapus task "${task.judul}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Detail Task</Text>
        {canDelete && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Prioritas + tanggal */}
        <View style={styles.metaRow}>
          <View style={[styles.dot, { backgroundColor: PRIORITAS_COLOR[task.prioritas] }]} />
          <Text style={styles.prioritasText}>Prioritas {task.prioritas}</Text>
        </View>

        {/* Judul */}
        <Text style={styles.judul}>{task.judul}</Text>

        {/* Deskripsi */}
        {task.deskripsi ? (
          <Text style={styles.deskripsi}>{task.deskripsi}</Text>
        ) : null}

        {/* Status switcher */}
        <Text style={styles.sectionLabel}>STATUS</Text>
        <View style={styles.statusGroup}>
          {(['belum', 'proses', 'selesai'] as TugasStatus[]).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => statusMutation.mutate(s)}
              disabled={statusMutation.isPending || task.status === s}
              style={[styles.statusBtn, task.status === s && styles.statusBtnActive]}
            >
              <Text style={[styles.statusBtnText, task.status === s && styles.statusBtnTextActive]}>
                {s === 'belum' ? 'Belum' : s === 'proses' ? 'Proses' : 'Selesai'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info detail */}
        <View style={styles.infoBox}>
          <InfoRow icon="person" label="Ditugaskan ke" value={task.karyawan?.nama_lengkap ?? '—'} avatar={task.karyawan?.foto} />
          <InfoRow icon="create-outline" label="Dibuat oleh" value={task.dibuat_oleh?.nama ?? '—'} />
          <InfoRow icon="calendar-outline" label="Tanggal Mulai" value={formatDate(task.tanggal_mulai)} />
          <InfoRow icon="flag-outline" label="Tanggal Selesai" value={formatDate(task.tanggal_selesai)} />
        </View>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>KARYAWAN DI-TAG</Text>
            <View style={styles.tagsWrap}>
              {task.tags.map((t) => (
                <View key={t.id} style={styles.tagChip}>
                  {t.foto ? (
                    <Image source={{ uri: t.foto }} style={styles.tagAvatar} />
                  ) : (
                    <View style={[styles.tagAvatar, styles.tagAvatarFallback]}>
                      <Text style={styles.tagAvatarText}>{t.nama_lengkap.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.tagText}>{t.nama_lengkap}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, avatar }: { icon: any; label: string; value: string; avatar?: string | null }) {
  return (
    <View style={infoStyles.row}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={infoStyles.avatar} />
      ) : (
        <View style={infoStyles.iconBox}>
          <Ionicons name={icon} size={16} color="#3b82f6" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  iconBox: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1c2333' },
  label: { color: '#8a94a6', fontSize: 11, marginBottom: 2 },
  value: { color: '#fff', fontSize: 14, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },
  deleteBtn: { padding: 8 },
  scroll: { padding: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  prioritasText: { color: '#8a94a6', fontSize: 12, fontWeight: '500' },
  judul: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8, lineHeight: 28 },
  deskripsi: { color: '#c5cdd9', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  sectionLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 16, marginBottom: 10 },
  statusGroup: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  statusBtnActive: { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
  statusBtnText: { color: '#8a94a6', fontSize: 13, fontWeight: '500' },
  statusBtnTextActive: { color: '#3b82f6', fontWeight: '700' },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
    borderRadius: 16, paddingLeft: 4, paddingRight: 10, paddingVertical: 4,
  },
  tagAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1c2333' },
  tagAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  tagAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tagText: { color: '#3b82f6', fontSize: 12, fontWeight: '500' },
});
