import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  performanceApi, type CreatePerformancePayload, type PerformanceJenis,
  type KaryawanRingkas as PerfKaryawanRingkas,
} from '../../api/performance';
import KaryawanPicker from '../../components/KaryawanPicker';
import DatePickerInput from '../../components/DatePickerInput';
import type { KaryawanRingkas } from '../../api/feed';

type RouteParams = { id?: number };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CreatePerformanceScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const editId = route.params?.id;
  const queryClient = useQueryClient();

  const [jenis, setJenis]                 = useState<PerformanceJenis>('appointment');
  const [namaKlien, setNamaKlien]         = useState('');
  const [pic, setPic]                     = useState<PerfKaryawanRingkas | null>(null);
  const [referral, setReferral]           = useState<PerfKaryawanRingkas | null>(null);
  const [tanggal, setTanggal]             = useState(todayISO());
  const [keterangan, setKeterangan]       = useState('');
  const [tglMulai, setTglMulai]           = useState('');
  const [tglBerakhir, setTglBerakhir]     = useState('');
  const [nilaiKontrak, setNilaiKontrak]   = useState('');
  const [picOpen, setPicOpen]             = useState(false);
  const [referralOpen, setReferralOpen]   = useState(false);

  const { data: existing } = useQuery({
    queryKey: ['performance', editId],
    queryFn:  () => performanceApi.detail(editId!),
    enabled:  !!editId,
  });

  useEffect(() => {
    if (!existing) return;
    const p = existing.data;
    setJenis(p.jenis);
    setNamaKlien(p.nama_klien);
    setTanggal(p.tanggal ?? todayISO());
    setKeterangan(p.keterangan ?? '');
    setTglMulai(p.tanggal_mulai_kontrak ?? '');
    setTglBerakhir(p.tanggal_berakhir_kontrak ?? '');
    setNilaiKontrak(p.nilai_kontrak ?? '');
    if (p.pic) {
      setPic({ id: p.pic.id, nama: p.pic.nama, jabatan: null, foto: p.pic.foto });
    }
    if (p.referral) {
      setReferral({ id: p.referral.id, nama: p.referral.nama, jabatan: null, foto: p.referral.foto });
    }
  }, [existing]);

  const saveMut = useMutation({
    mutationFn: (payload: CreatePerformancePayload) =>
      editId ? performanceApi.update(editId, payload) : performanceApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] });
      queryClient.invalidateQueries({ queryKey: ['performance-stats'] });
      if (editId) queryClient.invalidateQueries({ queryKey: ['performance', editId] });
      navigation.goBack();
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join('\n')
        ?? 'Gagal simpan catatan.';
      Alert.alert('Error', msg);
    },
  });

  const submit = () => {
    if (!namaKlien.trim()) return Alert.alert('Validasi', 'Nama klien wajib diisi.');
    if (!pic)              return Alert.alert('Validasi', 'PIC wajib dipilih.');
    if (!tanggal)          return Alert.alert('Validasi', 'Tanggal wajib diisi.');
    if (jenis === 'kontrak') {
      if (!tglMulai)    return Alert.alert('Validasi', 'Tanggal mulai kontrak wajib diisi.');
      if (!tglBerakhir) return Alert.alert('Validasi', 'Tanggal berakhir kontrak wajib diisi.');
    }

    saveMut.mutate({
      jenis,
      nama_klien:               namaKlien.trim(),
      pic_id:                   pic.id,
      referral_karyawan_id:     referral?.id ?? null,
      tanggal,
      keterangan:               keterangan.trim() || undefined,
      tanggal_mulai_kontrak:    jenis === 'kontrak' ? tglMulai : undefined,
      tanggal_berakhir_kontrak: jenis === 'kontrak' ? tglBerakhir : undefined,
      nilai_kontrak:            jenis === 'kontrak' && nilaiKontrak ? Number(nilaiKontrak) : null,
    });
  };

  const adaptKaryawan = (k: KaryawanRingkas): PerfKaryawanRingkas => ({
    id: k.id, nama: k.nama, jabatan: k.jabatan, foto: k.foto,
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{editId ? 'Edit Catatan' : 'Catatan Baru'}</Text>
          <TouchableOpacity onPress={submit} disabled={saveMut.isPending} style={styles.saveBtn}>
            {saveMut.isPending
              ? <ActivityIndicator size="small" color="#3b82f6" />
              : <Text style={styles.saveText}>Simpan</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>Jenis</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              onPress={() => setJenis('appointment')}
              style={[
                styles.chip,
                jenis === 'appointment' && { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
              ]}
            >
              <Ionicons name="calendar" size={14} color={jenis === 'appointment' ? '#3b82f6' : '#8a94a6'} />
              <Text style={[
                styles.chipText,
                jenis === 'appointment' && { color: '#3b82f6', fontWeight: '700' },
              ]}>Appointment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setJenis('kontrak')}
              style={[
                styles.chip,
                jenis === 'kontrak' && { backgroundColor: 'rgba(34,197,94,0.20)', borderColor: '#22c55e' },
              ]}
            >
              <Ionicons name="document-text" size={14} color={jenis === 'kontrak' ? '#22c55e' : '#8a94a6'} />
              <Text style={[
                styles.chipText,
                jenis === 'kontrak' && { color: '#22c55e', fontWeight: '700' },
              ]}>Goal Kontrak</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Nama Klien <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={namaKlien}
            onChangeText={setNamaKlien}
            placeholder="Nama klien (teks bebas)..."
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>PIC <Text style={styles.req}>*</Text></Text>
          <TouchableOpacity style={styles.input} onPress={() => setPicOpen(true)}>
            {pic ? (
              <View style={styles.userInline}>
                {pic.foto ? (
                  <Image source={{ uri: pic.foto }} style={styles.miniAvatar} />
                ) : (
                  <View style={[styles.miniAvatar, styles.miniAvatarFb]}>
                    <Text style={styles.miniAvatarText}>{pic.nama.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.userText}>{pic.nama}</Text>
              </View>
            ) : (
              <Text style={styles.placeholder}>Pilih PIC...</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Tanggal <Text style={styles.req}>*</Text></Text>
          <DatePickerInput value={tanggal} onChange={setTanggal} />

          {jenis === 'kontrak' && (
            <>
              <Text style={styles.label}>Tanggal Mulai Kontrak <Text style={styles.req}>*</Text></Text>
              <DatePickerInput value={tglMulai} onChange={setTglMulai} />

              <Text style={styles.label}>Tanggal Berakhir Kontrak <Text style={styles.req}>*</Text></Text>
              <DatePickerInput value={tglBerakhir} onChange={setTglBerakhir} />

              <Text style={styles.label}>Nilai Kontrak (opsional)</Text>
              <TextInput
                style={styles.input}
                value={nilaiKontrak}
                onChangeText={setNilaiKontrak}
                placeholder="0"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Karyawan Referral (opsional)</Text>
              <TouchableOpacity style={styles.input} onPress={() => setReferralOpen(true)}>
                {referral ? (
                  <View style={styles.userInline}>
                    {referral.foto ? (
                      <Image source={{ uri: referral.foto }} style={styles.miniAvatar} />
                    ) : (
                      <View style={[styles.miniAvatar, styles.miniAvatarFb]}>
                        <Text style={styles.miniAvatarText}>{referral.nama.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.userText}>{referral.nama}</Text>
                    <TouchableOpacity onPress={() => setReferral(null)}>
                      <Ionicons name="close-circle" size={16} color="#8a94a6" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.placeholder}>Pilih karyawan referral...</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.label}>Keterangan</Text>
          <TextInput
            style={[styles.input, { minHeight: 90 }]}
            value={keterangan}
            onChangeText={setKeterangan}
            placeholder="Keterangan (opsional)"
            placeholderTextColor="#6b7280"
            multiline
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <KaryawanPicker
        visible={picOpen}
        onClose={() => setPicOpen(false)}
        mode="single"
        onPick={(k) => { setPic(adaptKaryawan(k)); setPicOpen(false); }}
        title="Pilih PIC"
        searchFn={performanceApi.searchKaryawan}
      />

      <KaryawanPicker
        visible={referralOpen}
        onClose={() => setReferralOpen(false)}
        mode="single"
        onPick={(k) => { setReferral(adaptKaryawan(k)); setReferralOpen(false); }}
        title="Pilih Karyawan Referral"
        searchFn={performanceApi.searchKaryawan}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },
  saveBtn:  { paddingHorizontal: 12, paddingVertical: 8 },
  saveText: { color: '#3b82f6', fontWeight: '700', fontSize: 14 },
  scroll:   { padding: 16, paddingBottom: 32 },

  label: {
    color: '#8a94a6', fontSize: 12, fontWeight: '600',
    marginTop: 12, marginBottom: 6, letterSpacing: 0.5,
  },
  req: { color: '#ef4444' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10,
    fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
  },
  placeholder: { color: '#6b7280', fontSize: 14 },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipText: { color: '#c5cdd9', fontSize: 13 },
  userInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1c2333' },
  miniAvatarFb: { alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  userText: { color: '#fff', fontSize: 14, flex: 1 },
});
