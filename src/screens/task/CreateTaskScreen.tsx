import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { tugasApi, type TugasPrioritas, type TugasStatus } from '../../api/tugas';
import { type KaryawanRingkas } from '../../api/feed';
import KaryawanPicker from '../../components/KaryawanPicker';
import DatePickerInput from '../../components/DatePickerInput';
import { useToast } from '../../components/Toast';

const PRIORITAS_OPTIONS: { key: TugasPrioritas; label: string; color: string }[] = [
  { key: 'rendah', label: 'Rendah', color: '#6b7280' },
  { key: 'sedang', label: 'Sedang', color: '#f59e0b' },
  { key: 'tinggi', label: 'Tinggi', color: '#ef4444' },
];

const STATUS_OPTIONS: { key: TugasStatus; label: string }[] = [
  { key: 'belum',   label: 'Belum' },
  { key: 'proses',  label: 'Proses' },
  { key: 'selesai', label: 'Selesai' },
];

function isValidDate(s: string): boolean {
  if (!s) return true; // optional, kosong OK
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

export default function CreateTaskScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [judul, setJudul]         = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [prioritas, setPrioritas] = useState<TugasPrioritas>('sedang');
  const [status, setStatus]       = useState<TugasStatus>('belum');
  const [tglMulai, setTglMulai]   = useState('');
  const [tglSelesai, setTglSelesai] = useState('');

  const [assignee, setAssignee] = useState<KaryawanRingkas | null>(null);
  const [tags, setTags]         = useState<KaryawanRingkas[]>([]);

  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [tagPickerOpen,      setTagPickerOpen]      = useState(false);

  const createMutation = useMutation({
    mutationFn: () => tugasApi.create({
      judul, deskripsi: deskripsi || undefined,
      prioritas, status,
      tanggal_mulai:   tglMulai   || undefined,
      tanggal_selesai: tglSelesai || undefined,
      karyawan_id: assignee?.id,
      tags: tags.length > 0 ? tags.map((t) => t.id) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tugas'] });
      queryClient.invalidateQueries({ queryKey: ['tugas-stats'] });
      toast.success('Task berhasil dibuat.');
      navigation.goBack();
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message ?? 'Gagal buat task.';
      Alert.alert('Error', msg);
    },
  });

  const handleSubmit = () => {
    if (!judul.trim()) {
      Alert.alert('Error', 'Judul wajib diisi.');
      return;
    }
    if (tglMulai && !isValidDate(tglMulai)) {
      Alert.alert('Error', 'Format tanggal mulai salah. Pakai YYYY-MM-DD (contoh 2026-05-15).');
      return;
    }
    if (tglSelesai && !isValidDate(tglSelesai)) {
      Alert.alert('Error', 'Format tanggal selesai salah. Pakai YYYY-MM-DD.');
      return;
    }
    createMutation.mutate();
  };

  const toggleTag = (k: KaryawanRingkas) => {
    setTags((prev) => prev.find((t) => t.id === k.id) ? prev.filter((t) => t.id !== k.id) : [...prev, k]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Task Baru</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={createMutation.isPending || !judul.trim()}
            style={[styles.postBtn, (!judul.trim() || createMutation.isPending) && styles.postBtnDisabled]}
          >
            {createMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.postBtnText}>Simpan</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Judul */}
          <Field label="Judul *">
            <TextInput
              style={styles.input}
              placeholder="Contoh: Review desain modul invoice"
              placeholderTextColor="#6b7280"
              value={judul}
              onChangeText={setJudul}
              maxLength={200}
            />
          </Field>

          {/* Deskripsi */}
          <Field label="Deskripsi (opsional)">
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Detail task..."
              placeholderTextColor="#6b7280"
              value={deskripsi}
              onChangeText={setDeskripsi}
              multiline
              maxLength={5000}
            />
          </Field>

          {/* Prioritas */}
          <Field label="Prioritas">
            <View style={styles.chipRow}>
              {PRIORITAS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setPrioritas(opt.key)}
                  style={[styles.chip, prioritas === opt.key && { backgroundColor: opt.color + '30', borderColor: opt.color }]}
                >
                  <View style={[styles.chipDot, { backgroundColor: opt.color }]} />
                  <Text style={[styles.chipText, prioritas === opt.key && { color: opt.color, fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {/* Status */}
          <Field label="Status">
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setStatus(opt.key)}
                  style={[styles.chip, status === opt.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, status === opt.key && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {/* Assignee */}
          <Field label="Ditugaskan ke (opsional, default diri sendiri)">
            <TouchableOpacity onPress={() => setAssigneePickerOpen(true)} style={styles.pickerBtn}>
              {assignee ? (
                <>
                  {assignee.foto ? (
                    <Image source={{ uri: assignee.foto }} style={styles.assigneeAvatar} />
                  ) : (
                    <View style={[styles.assigneeAvatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>{assignee.nama.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerValue}>{assignee.nama}</Text>
                    {assignee.jabatan && <Text style={styles.pickerSub}>{assignee.jabatan}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => setAssignee(null)}>
                    <Ionicons name="close-circle" size={20} color="#8a94a6" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={18} color="#3b82f6" />
                  <Text style={styles.pickerPlaceholder}>Pilih karyawan</Text>
                </>
              )}
            </TouchableOpacity>
          </Field>

          {/* Tanggal */}
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Field label="Tgl Mulai">
                <DatePickerInput value={tglMulai} onChange={setTglMulai} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Tgl Selesai">
                <DatePickerInput value={tglSelesai} onChange={setTglSelesai} />
              </Field>
            </View>
          </View>

          {/* Tag karyawan */}
          <Field label="Tag Karyawan (opsional)">
            <TouchableOpacity onPress={() => setTagPickerOpen(true)} style={styles.pickerBtn}>
              <Ionicons name="people-outline" size={18} color="#3b82f6" />
              <Text style={styles.pickerPlaceholder}>
                {tags.length === 0 ? 'Tag karyawan' : `${tags.length} dipilih · tap untuk ubah`}
              </Text>
            </TouchableOpacity>

            {tags.length > 0 && (
              <View style={styles.tagChips}>
                {tags.map((t) => (
                  <View key={t.id} style={styles.tagChip}>
                    {t.foto ? (
                      <Image source={{ uri: t.foto }} style={styles.tagAvatar} />
                    ) : (
                      <View style={[styles.tagAvatar, styles.avatarFallback]}>
                        <Text style={styles.avatarTextSmall}>{t.nama.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.tagText}>{t.nama}</Text>
                    <TouchableOpacity onPress={() => toggleTag(t)}>
                      <Ionicons name="close-circle" size={16} color="#8a94a6" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>

      <KaryawanPicker
        visible={assigneePickerOpen}
        onClose={() => setAssigneePickerOpen(false)}
        mode="single"
        onPick={(k) => setAssignee(k)}
        title="Pilih Penanggung Jawab"
        searchFn={tugasApi.searchKaryawan}
      />

      <KaryawanPicker
        visible={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        mode="multiple"
        selectedIds={tags.map((t) => t.id)}
        onPick={toggleTag}
        title="Tag Karyawan"
        searchFn={tugasApi.searchKaryawan}
      />
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { padding: 4 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  postBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontWeight: '600' },
  scroll: { padding: 16 },
  field: { marginBottom: 16 },
  label: { color: '#8a94a6', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive: { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: '#8a94a6', fontSize: 13 },
  chipTextActive: { color: '#3b82f6', fontWeight: '600' },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  pickerPlaceholder: { color: '#8a94a6', fontSize: 14, flex: 1 },
  pickerValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
  pickerSub:   { color: '#8a94a6', fontSize: 11, marginTop: 2 },
  assigneeAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  avatarTextSmall: { color: '#fff', fontWeight: '700', fontSize: 10 },
  dateRow: { flexDirection: 'row', gap: 12 },
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.30)',
    borderRadius: 16, paddingLeft: 4, paddingRight: 8, paddingVertical: 4,
    maxWidth: 200,
  },
  tagAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1c2333' },
  tagText: { color: '#3b82f6', fontSize: 12, fontWeight: '500', flexShrink: 1 },
});
