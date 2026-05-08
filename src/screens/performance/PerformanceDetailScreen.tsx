import React from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { performanceApi } from '../../api/performance';

type RouteParams = { id: number };

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatNilai(n: string | null): string {
  if (!n) return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return 'Rp ' + num.toLocaleString('id-ID');
}

export default function PerformanceDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['performance', id],
    queryFn:  () => performanceApi.detail(id),
  });

  const destroyMut = useMutation({
    mutationFn: () => performanceApi.destroy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] });
      queryClient.invalidateQueries({ queryKey: ['performance-stats'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus catatan.'),
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  const p = data.data;
  const isKontrak = p.jenis === 'kontrak';
  const color = isKontrak ? '#22c55e' : '#3b82f6';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Detail Performance</Text>
        {p.milikku && (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreatePerformance', { id: p.id })}
              style={styles.iconBtn}
            >
              <Ionicons name="create-outline" size={22} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                Alert.alert('Hapus Catatan', 'Yakin hapus catatan performance ini?', [
                  { text: 'Batal' },
                  { text: 'Hapus', style: 'destructive', onPress: () => destroyMut.mutate() },
                ])
              }
              style={styles.iconBtn}
            >
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.headerCard, { borderLeftColor: color }]}>
          <View style={[styles.jenisPill, { backgroundColor: color + '22' }]}>
            <Ionicons
              name={isKontrak ? 'document-text' : 'calendar'}
              size={12}
              color={color}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.jenisText, { color }]}>{p.jenis_label}</Text>
          </View>
          <Text style={styles.namaKlien}>{p.nama_klien}</Text>
          <Text style={styles.tanggalText}>{formatDate(p.tanggal)}</Text>
        </View>

        {p.pic && (
          <>
            <Text style={styles.sectionLabel}>PIC</Text>
            <UserRow nama={p.pic.nama} foto={p.pic.foto} />
          </>
        )}

        {p.referral && (
          <>
            <Text style={styles.sectionLabel}>REFERRAL</Text>
            <UserRow nama={p.referral.nama} foto={p.referral.foto} />
          </>
        )}

        {isKontrak && (
          <>
            <Text style={styles.sectionLabel}>DETAIL KONTRAK</Text>
            <View style={styles.infoBox}>
              <InfoRow icon="play-outline" label="Tanggal Mulai" value={formatDate(p.tanggal_mulai_kontrak)} />
              <InfoRow icon="stop-outline" label="Tanggal Berakhir" value={formatDate(p.tanggal_berakhir_kontrak)} />
              {p.can_see_nilai ? (
                <InfoRow icon="cash-outline" label="Nilai Kontrak" value={formatNilai(p.nilai_kontrak)} valueColor="#22c55e" />
              ) : (
                <InfoRow icon="lock-closed-outline" label="Nilai Kontrak" value="Hanya Keuangan/Admin" valueColor="#6b7280" />
              )}
            </View>
          </>
        )}

        {p.keterangan && (
          <>
            <Text style={styles.sectionLabel}>KETERANGAN</Text>
            <Text style={styles.keterangan}>{p.keterangan}</Text>
          </>
        )}

        {p.pembuat && (
          <>
            <Text style={styles.sectionLabel}>DICATAT OLEH</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoValue}>{p.pembuat.nama_lengkap}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, valueColor }:
  { icon: any; label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color="#3b82f6" />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
      </View>
    </View>
  );
}

function UserRow({ nama, foto }: { nama: string; foto: string | null }) {
  return (
    <View style={styles.userRow}>
      {foto ? (
        <Image source={{ uri: foto }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{nama.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.userName}>{nama}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 8 },
  iconBtn:  { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },

  scroll: { padding: 16, paddingBottom: 32 },

  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderLeftWidth: 4, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  jenisPill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    marginBottom: 8,
  },
  jenisText: { fontSize: 11, fontWeight: '700' },
  namaKlien: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  tanggalText: { color: '#8a94a6', fontSize: 12 },

  sectionLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 18, marginBottom: 8,
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  infoLabel: { color: '#8a94a6', fontSize: 11, marginBottom: 2 },
  infoValue: { color: '#fff', fontSize: 13, fontWeight: '500' },
  keterangan: { color: '#d6dce6', fontSize: 14, lineHeight: 21 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  avatar:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  userName: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
