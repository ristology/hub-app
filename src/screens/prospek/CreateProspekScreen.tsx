import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { prospekApi, type ProspekStatus } from '../../api/prospek';
import DatePickerInput from '../../components/DatePickerInput';
import { useToast } from '../../components/Toast';

const STATUS_OPTIONS: { key: ProspekStatus; label: string; color: string }[] = [
  { key: 'prospek',   label: 'Prospek',   color: '#8a94a6' },
  { key: 'follow_up', label: 'Follow Up', color: '#06b6d4' },
  { key: 'proposal',  label: 'Proposal',  color: '#3b82f6' },
  { key: 'negosiasi', label: 'Negosiasi', color: '#f59e0b' },
];

function isValidDate(s: string): boolean {
  if (!s) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s).getTime());
}

export default function CreateProspekScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [namaKlien,    setNamaKlien]    = useState('');
  const [alamat,       setAlamat]       = useState('');
  const [kota,         setKota]         = useState('');
  const [kontakNama,   setKontakNama]   = useState('');
  const [kontakEmail,  setKontakEmail]  = useState('');
  const [kontakHp,     setKontakHp]     = useState('');
  const [status,       setStatus]       = useState<ProspekStatus>('prospek');
  const [tglPertama,   setTglPertama]   = useState('');
  const [tglBerikutnya, setTglBerikutnya] = useState('');

  const createMutation = useMutation({
    mutationFn: () => prospekApi.create({
      nama_klien:   namaKlien,
      alamat:       alamat       || undefined,
      kota:         kota         || undefined,
      kontak_nama:  kontakNama   || undefined,
      kontak_email: kontakEmail  || undefined,
      kontak_hp:    kontakHp     || undefined,
      status,
      tanggal_pertemuan_pertama:    tglPertama   || undefined,
      tanggal_pertemuan_berikutnya: tglBerikutnya || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospek'] });
      queryClient.invalidateQueries({ queryKey: ['prospek-stats'] });
      toast.success('Prospek berhasil dibuat.');
      navigation.goBack();
    },
    onError: (e: any) => {
      Alert.alert('Error', e.response?.data?.message ?? 'Gagal buat prospek.');
    },
  });

  const handleSubmit = () => {
    if (!namaKlien.trim()) { Alert.alert('Error', 'Nama klien wajib diisi.'); return; }
    if (tglPertama && !isValidDate(tglPertama))     { Alert.alert('Error', 'Format tanggal pertama salah. Pakai YYYY-MM-DD.'); return; }
    if (tglBerikutnya && !isValidDate(tglBerikutnya)) { Alert.alert('Error', 'Format tanggal berikutnya salah. Pakai YYYY-MM-DD.'); return; }
    createMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Prospek Baru</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={createMutation.isPending || !namaKlien.trim()}
            style={[styles.postBtn, (!namaKlien.trim() || createMutation.isPending) && styles.postBtnDisabled]}
          >
            {createMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.postBtnText}>Simpan</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Field label="Nama Klien *">
            <TextInput style={styles.input} placeholder="PT. Contoh Klien"
              placeholderTextColor="#6b7280" value={namaKlien} onChangeText={setNamaKlien}
              maxLength={200} />
          </Field>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Field label="Alamat">
                <TextInput style={styles.input} placeholder="Jalan, no, dll"
                  placeholderTextColor="#6b7280" value={alamat} onChangeText={setAlamat} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Kota">
                <TextInput style={styles.input} placeholder="Jakarta"
                  placeholderTextColor="#6b7280" value={kota} onChangeText={setKota} />
              </Field>
            </View>
          </View>

          <Field label="Kontak — Nama PIC">
            <TextInput style={styles.input} placeholder="Budi Santoso"
              placeholderTextColor="#6b7280" value={kontakNama} onChangeText={setKontakNama} />
          </Field>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Email">
                <TextInput style={styles.input} placeholder="email@klien.com"
                  placeholderTextColor="#6b7280" value={kontakEmail} onChangeText={setKontakEmail}
                  keyboardType="email-address" autoCapitalize="none" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="HP">
                <TextInput style={styles.input} placeholder="0812..."
                  placeholderTextColor="#6b7280" value={kontakHp} onChangeText={setKontakHp}
                  keyboardType="phone-pad" />
              </Field>
            </View>
          </View>

          <Field label="Status">
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setStatus(opt.key)}
                  style={[styles.chip, status === opt.key && {
                    backgroundColor: opt.color + '30', borderColor: opt.color,
                  }]}
                >
                  <Text style={[styles.chipText, status === opt.key && {
                    color: opt.color, fontWeight: '600',
                  }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Pertemuan Pertama">
                <DatePickerInput value={tglPertama} onChange={setTglPertama} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Pertemuan Berikutnya">
                <DatePickerInput value={tglBerikutnya} onChange={setTglBerikutnya} />
              </Field>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 12,
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
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipText: { color: '#8a94a6', fontSize: 13 },
});
