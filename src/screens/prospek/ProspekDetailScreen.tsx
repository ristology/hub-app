import React, { useState } from 'react';
import {
  View, Text, ScrollView, Image, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { prospekApi, type ProspekStatus, type ProspekKomentar } from '../../api/prospek';

type RouteParams = { id: number };

const STATUS_OPTIONS: { key: ProspekStatus; label: string; color: string }[] = [
  { key: 'prospek',   label: 'Prospek',   color: '#8a94a6' },
  { key: 'follow_up', label: 'Follow Up', color: '#06b6d4' },
  { key: 'proposal',  label: 'Proposal',  color: '#3b82f6' },
  { key: 'negosiasi', label: 'Negosiasi', color: '#f59e0b' },
  { key: 'trial',     label: 'Trial',     color: '#a855f7' },
  { key: 'kontrak',   label: 'Kontrak',   color: '#22c55e' },
  { key: 'batal',     label: 'Batal',     color: '#ef4444' },
];

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ProspekDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const queryClient = useQueryClient();
  const [komentar, setKomentar] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['prospek', id],
    queryFn:  () => prospekApi.detail(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: ProspekStatus) => prospekApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospek', id] });
      queryClient.invalidateQueries({ queryKey: ['prospek'] });
      queryClient.invalidateQueries({ queryKey: ['prospek-stats'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => prospekApi.comment(id, text),
    onSuccess: () => {
      setKomentar('');
      queryClient.invalidateQueries({ queryKey: ['prospek', id] });
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal kirim komentar.'),
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

  const p = data.data;
  const komentarList = data.komentar.data;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Detail Prospek</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddPertemuan', { id })} style={styles.addBtn}>
            <Ionicons name="add-circle-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Nama klien */}
          <Text style={styles.namaKlien}>{p.nama_klien}</Text>
          {p.kota && <Text style={styles.subInfo}>📍 {p.kota}</Text>}

          {/* Status switcher */}
          <Text style={styles.sectionLabel}>STATUS</Text>
          <View style={styles.statusGroup}>
            {STATUS_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s.key}
                onPress={() => statusMutation.mutate(s.key)}
                disabled={statusMutation.isPending || p.status === s.key}
                style={[styles.statusBtn, p.status === s.key && {
                  backgroundColor: s.color + '30', borderColor: s.color,
                }]}
              >
                <Text style={[styles.statusBtnText, p.status === s.key && {
                  color: s.color, fontWeight: '700',
                }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Kontak */}
          <Text style={styles.sectionLabel}>KONTAK</Text>
          <View style={styles.infoBox}>
            {p.kontak_nama && <InfoRow icon="person-outline" label="Nama" value={p.kontak_nama} />}
            {p.kontak_email && <InfoRow icon="mail-outline" label="Email" value={p.kontak_email}
              onPress={() => Linking.openURL(`mailto:${p.kontak_email}`)} />}
            {p.kontak_hp && <InfoRow icon="call-outline" label="HP" value={p.kontak_hp}
              onPress={() => Linking.openURL(`tel:${p.kontak_hp}`)} />}
            {p.alamat && <InfoRow icon="location-outline" label="Alamat" value={p.alamat} />}
          </View>

          {/* Tanggal pertemuan */}
          <Text style={styles.sectionLabel}>JADWAL</Text>
          <View style={styles.infoBox}>
            <InfoRow icon="calendar-outline" label="Pertemuan Pertama" value={formatDate(p.tanggal_pertemuan_pertama)} />
            <InfoRow icon="calendar-clear-outline" label="Pertemuan Terakhir" value={formatDate(p.tanggal_pertemuan_terakhir)} />
            <InfoRow
              icon="calendar-number-outline"
              label="Pertemuan Berikutnya"
              value={formatDate(p.tanggal_pertemuan_berikutnya)}
              valueColor={p.is_overdue ? '#ef4444' : undefined}
            />
          </View>

          {/* Riwayat pertemuan */}
          {p.pertemuan && p.pertemuan.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>RIWAYAT PERTEMUAN ({p.pertemuan.length})</Text>
              {p.pertemuan.map((pt) => (
                <View key={pt.id} style={styles.pertemuanItem}>
                  <View style={styles.pertemuanDate}>
                    <Ionicons name="calendar" size={14} color="#3b82f6" />
                    <Text style={styles.pertemuanDateText}>{formatDate(pt.tanggal)}</Text>
                  </View>
                  <Text style={styles.pertemuanKet}>{pt.keterangan}</Text>
                  {pt.tanggal_berikutnya && (
                    <Text style={styles.pertemuanNext}>
                      → Lanjut: {formatDate(pt.tanggal_berikutnya)}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Komentar */}
          <Text style={styles.sectionLabel}>KOMENTAR ({komentarList.length})</Text>
          {komentarList.length > 0 ? (
            komentarList.map((k) => <KomentarItem key={k.id} k={k} />)
          ) : (
            <Text style={styles.emptyText}>Belum ada komentar.</Text>
          )}
        </ScrollView>

        {/* Input komentar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Tulis komentar..."
            placeholderTextColor="#6b7280"
            value={komentar}
            onChangeText={setKomentar}
            multiline
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => komentar.trim() && commentMutation.mutate(komentar.trim())}
            disabled={!komentar.trim() || commentMutation.isPending}
          >
            {commentMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, onPress, valueColor }:
  { icon: any; label: string; value: string; onPress?: () => void; valueColor?: string }) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={infoStyles.row} onPress={onPress}>
      <Ionicons name={icon} size={14} color="#3b82f6" />
      <View style={{ flex: 1 }}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, valueColor && { color: valueColor }]}>{value}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={14} color="#6b7280" />}
    </Wrapper>
  );
}

function KomentarItem({ k }: { k: ProspekKomentar }) {
  return (
    <View style={komStyles.item}>
      {k.foto ? (
        <Image source={{ uri: k.foto }} style={komStyles.avatar} />
      ) : (
        <View style={[komStyles.avatar, komStyles.avatarFallback]}>
          <Text style={komStyles.avatarText}>{k.nama.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={komStyles.nama}>{k.nama}</Text>
        <Text style={komStyles.text}>{k.komentar}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  label: { color: '#8a94a6', fontSize: 11, marginBottom: 2 },
  value: { color: '#fff', fontSize: 13, fontWeight: '500' },
});

const komStyles = StyleSheet.create({
  item: { flexDirection: 'row', marginBottom: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  nama: { color: '#fff', fontWeight: '600', fontSize: 13 },
  text: { color: '#c5cdd9', fontSize: 13, marginTop: 2, lineHeight: 18 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },
  addBtn:   { padding: 8 },
  scroll: { padding: 16, paddingBottom: 24 },
  namaKlien: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subInfo: { color: '#8a94a6', fontSize: 13, marginTop: 4 },
  sectionLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 18, marginBottom: 8,
  },
  statusGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  statusBtnText: { color: '#8a94a6', fontSize: 12 },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  pertemuanItem: {
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.20)',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  pertemuanDate: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  pertemuanDateText: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  pertemuanKet: { color: '#d6dce6', fontSize: 13, lineHeight: 19 },
  pertemuanNext: { color: '#22c55e', fontSize: 11, marginTop: 4 },
  emptyText: { color: '#6b7280', fontSize: 12, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row', padding: 8, gap: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0a0f1a',
  },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    maxHeight: 100, fontSize: 14,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
});
