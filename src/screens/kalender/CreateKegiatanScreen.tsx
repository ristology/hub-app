import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  kalenderApi, type CreateKegiatanPayload, type KategoriKegiatan, type Visibilitas,
  type KaryawanRingkas as KalenderKaryawanRingkas,
} from '../../api/kalender';
import KaryawanPicker from '../../components/KaryawanPicker';
import DatePickerInput from '../../components/DatePickerInput';
import SaveButton from '../../components/SaveButton';
import { REMINDER_PRESETS, formatOffset } from '../../utils/calendarReminders';
import type { KaryawanRingkas } from '../../api/feed';

type RouteParams = { id?: number };

const KATEGORI_OPTIONS: { key: KategoriKegiatan; label: string; color: string }[] = [
  { key: 'kegiatan',      label: 'Kegiatan', color: '#4f6af0' },
  { key: 'rapat',         label: 'Rapat',    color: '#3b82f6' },
  { key: 'deadline',      label: 'Deadline', color: '#e0245e' },
  { key: 'cuti',          label: 'Cuti',     color: '#34a853' },
  { key: 'lembur',        label: 'Lembur',   color: '#f9ab00' },
  { key: 'ujian_sekolah', label: 'Ujian',    color: '#8b5cf6' },
  { key: 'lainnya',       label: 'Lainnya',  color: '#9e9e9e' },
];

const VISIBILITAS_OPTIONS: { key: Visibilitas; label: string; icon: any }[] = [
  { key: 'private', label: 'Private', icon: 'lock-closed-outline' },
  { key: 'tim',     label: 'Tim',     icon: 'people-outline' },
  { key: 'publik',  label: 'Publik',  icon: 'globe-outline' },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalDatetime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return toLocalDatetime(d);
}

function plusHourLocal(s: string): string {
  const d = new Date(s);
  d.setHours(d.getHours() + 1);
  return toLocalDatetime(d);
}

export default function CreateKegiatanScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const editId = route.params?.id;
  const queryClient = useQueryClient();

  const [judul, setJudul]           = useState('');
  const [deskripsi, setDeskripsi]   = useState('');
  const [lokasi, setLokasi]         = useState('');
  const [mulaiAt, setMulaiAt]       = useState(nowLocal());
  const [selesaiAt, setSelesaiAt]   = useState(plusHourLocal(nowLocal()));
  const [seharian, setSeharian]     = useState(false);
  const [kategori, setKategori]     = useState<KategoriKegiatan>('kegiatan');
  const [visibilitas, setVisibilitas] = useState<Visibilitas>('tim');
  const [peserta, setPeserta]       = useState<KalenderKaryawanRingkas[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reminderOffset, setReminderOffset] = useState<number | null>(15);

  // Load existing kegiatan saat edit
  const { data: existing } = useQuery({
    queryKey: ['kalender', editId],
    queryFn:  () => kalenderApi.detail(editId!),
    enabled:  !!editId,
  });

  useEffect(() => {
    if (!existing) return;
    const k = existing.data;
    setJudul(k.judul);
    setDeskripsi(k.deskripsi ?? '');
    setLokasi(k.lokasi ?? '');
    setMulaiAt(toLocalDatetime(new Date(k.mulai_at)));
    setSelesaiAt(toLocalDatetime(new Date(k.selesai_at)));
    setSeharian(k.seharian);
    setKategori(k.kategori);
    setVisibilitas(k.visibilitas);
    if (k.peserta) {
      setPeserta(k.peserta.map(p => ({
        id: p.karyawan_id, nama: p.nama, jabatan: null, foto: p.foto,
      })));
    }
    setReminderOffset(k.reminder_offset_minutes);
  }, [existing]);

  const saveMut = useMutation({
    mutationFn: (payload: CreateKegiatanPayload) =>
      editId ? kalenderApi.update(editId, payload) : kalenderApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kalender'] });
      queryClient.invalidateQueries({ queryKey: ['kalender-stats'] });
      if (editId) queryClient.invalidateQueries({ queryKey: ['kalender', editId] });
      navigation.goBack();
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join('\n')
        ?? 'Gagal simpan jadwal.';
      Alert.alert('Error', msg);
    },
  });

  const submit = () => {
    if (!judul.trim()) return Alert.alert('Validasi', 'Judul wajib diisi.');
    if (!mulaiAt)      return Alert.alert('Validasi', 'Waktu mulai wajib diisi.');
    if (!selesaiAt)    return Alert.alert('Validasi', 'Waktu selesai wajib diisi.');

    saveMut.mutate({
      judul:       judul.trim(),
      deskripsi:   deskripsi.trim() || undefined,
      lokasi:      lokasi.trim() || undefined,
      mulai_at:    mulaiAt.replace('T', ' ') + ':00',
      selesai_at:  selesaiAt.replace('T', ' ') + ':00',
      seharian,
      kategori,
      visibilitas,
      reminder_offset_minutes: reminderOffset,
      peserta:     peserta.map(p => p.id),
    });
  };

  const togglePeserta = (k: KaryawanRingkas) => {
    setPeserta((prev) =>
      prev.some(p => p.id === k.id)
        ? prev.filter(p => p.id !== k.id)
        : [...prev, { id: k.id, nama: k.nama, jabatan: k.jabatan, foto: k.foto }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{editId ? 'Edit Jadwal' : 'Jadwal Baru'}</Text>
          <SaveButton onPress={submit} loading={saveMut.isPending} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>Judul <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={judul}
            onChangeText={setJudul}
            placeholder="Judul jadwal..."
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Kategori</Text>
          <View style={styles.chipRow}>
            {KATEGORI_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setKategori(opt.key)}
                style={[
                  styles.chip,
                  kategori === opt.key && { backgroundColor: opt.color + '30', borderColor: opt.color },
                ]}
              >
                <Text style={[
                  styles.chipText,
                  kategori === opt.key && { color: opt.color, fontWeight: '700' },
                ]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Seharian toggle */}
          <TouchableOpacity style={styles.toggleRow} onPress={() => setSeharian(s => !s)}>
            <Ionicons
              name={seharian ? 'checkbox' : 'square-outline'}
              size={22}
              color={seharian ? '#3b82f6' : '#8a94a6'}
            />
            <Text style={styles.toggleText}>Sepanjang hari</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Mulai <Text style={styles.req}>*</Text></Text>
          <DatePickerInput
            value={mulaiAt}
            onChange={setMulaiAt}
            mode={seharian ? 'date' : 'datetime'}
          />

          <Text style={styles.label}>Selesai <Text style={styles.req}>*</Text></Text>
          <DatePickerInput
            value={selesaiAt}
            onChange={setSelesaiAt}
            mode={seharian ? 'date' : 'datetime'}
          />

          <Text style={styles.label}>Lokasi</Text>
          <TextInput
            style={styles.input}
            value={lokasi}
            onChangeText={setLokasi}
            placeholder="Lokasi (opsional)"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Deskripsi</Text>
          <TextInput
            style={[styles.input, { minHeight: 90 }]}
            value={deskripsi}
            onChangeText={setDeskripsi}
            placeholder="Deskripsi (opsional)"
            placeholderTextColor="#6b7280"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Visibilitas</Text>
          <View style={styles.chipRow}>
            {VISIBILITAS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setVisibilitas(opt.key)}
                style={[
                  styles.chip,
                  visibilitas === opt.key && { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={13}
                  color={visibilitas === opt.key ? '#3b82f6' : '#8a94a6'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.chipText,
                  visibilitas === opt.key && { color: '#3b82f6', fontWeight: '700' },
                ]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>
            <Ionicons name="notifications-outline" size={13} color="#8a94a6" /> Reminder
          </Text>
          <View style={styles.chipRow}>
            {REMINDER_PRESETS.map((opt) => {
              const active = reminderOffset === opt.value;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  onPress={() => setReminderOffset(opt.value)}
                  style={[
                    styles.chip,
                    active && { backgroundColor: 'rgba(245,158,11,0.20)', borderColor: '#f59e0b' },
                  ]}
                >
                  <Text style={[
                    styles.chipText,
                    active && { color: '#f59e0b', fontWeight: '700' },
                  ]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {reminderOffset !== null && (
            <Text style={{ color: '#8a94a6', fontSize: 11, marginTop: 4, marginLeft: 2 }}>
              Notifikasi akan muncul {formatOffset(reminderOffset)} sebelum jadwal mulai.
            </Text>
          )}

          <Text style={styles.label}>Peserta</Text>
          <TouchableOpacity style={styles.input} onPress={() => setPickerOpen(true)}>
            <Text style={{ color: peserta.length ? '#fff' : '#6b7280', fontSize: 14 }}>
              {peserta.length === 0
                ? 'Tap untuk pilih peserta...'
                : `${peserta.length} peserta dipilih`}
            </Text>
          </TouchableOpacity>
          {peserta.length > 0 && (
            <View style={styles.pesertaList}>
              {peserta.map((p) => (
                <View key={p.id} style={styles.pesertaChip}>
                  <Text style={styles.pesertaName} numberOfLines={1}>{p.nama}</Text>
                  <TouchableOpacity onPress={() =>
                    setPeserta(prev => prev.filter(x => x.id !== p.id))
                  }>
                    <Ionicons name="close" size={14} color="#8a94a6" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <KaryawanPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode="multiple"
        selectedIds={peserta.map(p => p.id)}
        onPick={togglePeserta}
        title="Pilih Peserta"
        searchFn={kalenderApi.searchKaryawan}
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
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipText: { color: '#c5cdd9', fontSize: 12 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  toggleText: { color: '#fff', fontSize: 13 },

  pesertaList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pesertaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  pesertaName: { color: '#fff', fontSize: 12, maxWidth: 160 },
});
