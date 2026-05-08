import React from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { kalenderApi, type Peserta } from '../../api/kalender';

type RouteParams = { id: number };

const KATEGORI_LABEL: Record<string, string> = {
  kegiatan:      'Kegiatan',
  rapat:         'Rapat',
  deadline:      'Deadline',
  cuti:          'Cuti',
  lembur:        'Lembur',
  ujian_sekolah: 'Ujian Sekolah',
  lainnya:       'Lainnya',
};

const VISIBILITAS_LABEL: Record<string, string> = {
  private: 'Private',
  tim:     'Tim',
  publik:  'Publik',
};

function formatDateTime(s: string, allDay = false): string {
  const d = new Date(s);
  if (allDay) {
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function KegiatanDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['kalender', id],
    queryFn:  () => kalenderApi.detail(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['kalender', id] });
    queryClient.invalidateQueries({ queryKey: ['kalender'] });
    queryClient.invalidateQueries({ queryKey: ['kalender-stats'] });
  };

  const rsvpMut = useMutation({
    mutationFn: (status: 'diterima' | 'ditolak') => kalenderApi.rsvp(id, status),
    onSuccess: () => invalidate(),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal RSVP.'),
  });

  const destroyMut = useMutation({
    mutationFn: () => kalenderApi.destroy(id),
    onSuccess: () => { invalidate(); navigation.goBack(); },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus jadwal.'),
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  const k = data.data;
  const myRsvp = k.peserta?.find(p => p.is_me)?.status;
  const isInvited = !!myRsvp;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Detail Jadwal</Text>
        {k.milikku && !k.readonly && (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateKegiatan', { id: k.id })}
              style={styles.iconBtn}
            >
              <Ionicons name="create-outline" size={22} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                Alert.alert('Hapus Jadwal', 'Yakin hapus jadwal ini?', [
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
        <View style={[styles.judulRow, { borderLeftColor: k.warna }]}>
          <Text style={styles.judul}>{k.judul}</Text>
          <View style={styles.kategoriRow}>
            <View style={[styles.kategoriPill, { backgroundColor: k.warna + '22' }]}>
              <Text style={[styles.kategoriText, { color: k.warna }]}>
                {KATEGORI_LABEL[k.kategori] ?? k.kategori}
              </Text>
            </View>
            <View style={styles.visibilitasPill}>
              <Ionicons
                name={k.visibilitas === 'private' ? 'lock-closed-outline' :
                      k.visibilitas === 'tim'     ? 'people-outline' :
                                                    'globe-outline'}
                size={11}
                color="#8a94a6"
              />
              <Text style={styles.visibilitasText}>{VISIBILITAS_LABEL[k.visibilitas]}</Text>
            </View>
            {k.readonly && (
              <View style={styles.readonlyBadge}>
                <Ionicons name="link" size={10} color="#8a94a6" />
                <Text style={styles.readonlyText}>Linked Task</Text>
              </View>
            )}
          </View>
        </View>

        {/* Waktu */}
        <Text style={styles.sectionLabel}>WAKTU</Text>
        <View style={styles.infoBox}>
          <InfoRow icon="play-outline" label="Mulai" value={formatDateTime(k.mulai_at, k.seharian)} />
          <InfoRow icon="stop-outline" label="Selesai" value={formatDateTime(k.selesai_at, k.seharian)} />
          {k.seharian && (
            <View style={styles.allDayBadge}>
              <Ionicons name="time-outline" size={12} color="#3b82f6" />
              <Text style={styles.allDayText}>Sepanjang hari</Text>
            </View>
          )}
        </View>

        {k.lokasi && (
          <>
            <Text style={styles.sectionLabel}>LOKASI</Text>
            <View style={styles.infoBox}>
              <View style={styles.lokasiRow}>
                <Ionicons name="location-outline" size={16} color="#3b82f6" />
                <Text style={styles.lokasiText}>{k.lokasi}</Text>
              </View>
            </View>
          </>
        )}

        {k.deskripsi && (
          <>
            <Text style={styles.sectionLabel}>DESKRIPSI</Text>
            <Text style={styles.deskripsi}>{k.deskripsi}</Text>
          </>
        )}

        {k.pembuat && (
          <>
            <Text style={styles.sectionLabel}>PEMBUAT</Text>
            <View style={styles.userRow}>
              {k.pembuat.foto ? (
                <Image source={{ uri: k.pembuat.foto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{k.pembuat.nama.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.userName}>{k.pembuat.nama}</Text>
            </View>
          </>
        )}

        {k.peserta && k.peserta.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>PESERTA ({k.peserta.length})</Text>
            {k.peserta.map((p) => <PesertaItem key={p.karyawan_id} p={p} />)}
          </>
        )}

        {/* RSVP */}
        {isInvited && (
          <>
            <Text style={styles.sectionLabel}>RSVP UNDANGAN</Text>
            <View style={styles.rsvpRow}>
              <TouchableOpacity
                style={[
                  styles.rsvpBtn,
                  myRsvp === 'diterima' && { backgroundColor: 'rgba(34,197,94,0.20)', borderColor: '#22c55e' },
                ]}
                onPress={() => rsvpMut.mutate('diterima')}
                disabled={rsvpMut.isPending}
              >
                <Ionicons name="checkmark" size={16} color={myRsvp === 'diterima' ? '#22c55e' : '#8a94a6'} />
                <Text style={[styles.rsvpBtnText, myRsvp === 'diterima' && { color: '#22c55e' }]}>Hadir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.rsvpBtn,
                  myRsvp === 'ditolak' && { backgroundColor: 'rgba(239,68,68,0.20)', borderColor: '#ef4444' },
                ]}
                onPress={() => rsvpMut.mutate('ditolak')}
                disabled={rsvpMut.isPending}
              >
                <Ionicons name="close" size={16} color={myRsvp === 'ditolak' ? '#ef4444' : '#8a94a6'} />
                <Text style={[styles.rsvpBtnText, myRsvp === 'ditolak' && { color: '#ef4444' }]}>Tidak hadir</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color="#3b82f6" />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function PesertaItem({ p }: { p: Peserta }) {
  const statusColor =
    p.status === 'diterima' ? '#22c55e' :
    p.status === 'ditolak'  ? '#ef4444' : '#8a94a6';
  const statusLabel =
    p.status === 'diterima' ? 'Hadir' :
    p.status === 'ditolak'  ? 'Tidak hadir' : 'Belum jawab';

  return (
    <View style={styles.pesertaItem}>
      {p.foto ? (
        <Image source={{ uri: p.foto }} style={styles.pesertaAvatar} />
      ) : (
        <View style={[styles.pesertaAvatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{p.nama.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.pesertaNama}>{p.nama}{p.is_me && ' (Saya)'}</Text>
      <Text style={[styles.pesertaStatus, { color: statusColor }]}>{statusLabel}</Text>
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

  scroll:    { padding: 16, paddingBottom: 32 },
  judulRow:  { borderLeftWidth: 4, paddingLeft: 12, marginBottom: 8 },
  judul:     { color: '#fff', fontSize: 20, fontWeight: '700' },
  kategoriRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  kategoriPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  kategoriText: { fontSize: 11, fontWeight: '600' },
  visibilitasPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(138,148,166,0.10)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  visibilitasText: { color: '#8a94a6', fontSize: 11 },
  readonlyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(138,148,166,0.15)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  readonlyText: { color: '#8a94a6', fontSize: 11, fontWeight: '600' },

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
  allDayBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(59,130,246,0.10)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    alignSelf: 'flex-start', marginTop: 6,
  },
  allDayText: { color: '#3b82f6', fontSize: 11, fontWeight: '500' },
  lokasiRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lokasiText: { color: '#fff', fontSize: 14, flex: 1 },
  deskripsi:  { color: '#d6dce6', fontSize: 14, lineHeight: 21 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  userName: { color: '#fff', fontSize: 13, fontWeight: '500' },

  pesertaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
  },
  pesertaAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1c2333' },
  pesertaNama:   { color: '#fff', fontSize: 13, flex: 1 },
  pesertaStatus: { fontSize: 11, fontWeight: '600' },

  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  rsvpBtnText: { color: '#8a94a6', fontWeight: '600', fontSize: 13 },
});
