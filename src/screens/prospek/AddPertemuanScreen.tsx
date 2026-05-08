import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { prospekApi } from '../../api/prospek';
import DatePickerInput from '../../components/DatePickerInput';
import { useToast } from '../../components/Toast';

type RouteParams = { id: number };

function isValidDate(s: string): boolean {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s).getTime());
}

export default function AddPertemuanScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { id } = route.params;

  const [tanggal, setTanggal]                 = useState('');
  const [tanggalBerikutnya, setTanggalBerikutnya] = useState('');
  const [keterangan, setKeterangan]           = useState('');

  const mutation = useMutation({
    mutationFn: () => prospekApi.addPertemuan(id, {
      tanggal,
      tanggal_berikutnya: tanggalBerikutnya || undefined,
      keterangan,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospek', id] });
      queryClient.invalidateQueries({ queryKey: ['prospek'] });
      toast.success('Pertemuan dicatat.');
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal catat pertemuan.'),
  });

  const handleSubmit = () => {
    if (!isValidDate(tanggal)) { Alert.alert('Error', 'Tanggal pertemuan wajib (YYYY-MM-DD).'); return; }
    if (tanggalBerikutnya && !isValidDate(tanggalBerikutnya)) { Alert.alert('Error', 'Format tanggal berikutnya salah.'); return; }
    if (!keterangan.trim()) { Alert.alert('Error', 'Keterangan wajib diisi.'); return; }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Tambah Pertemuan</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={mutation.isPending}
            style={[styles.postBtn, mutation.isPending && styles.postBtnDisabled]}
          >
            {mutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.postBtnText}>Simpan</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Field label="Tanggal Pertemuan *">
            <DatePickerInput value={tanggal} onChange={setTanggal} />
          </Field>

          <Field label="Tanggal Pertemuan Berikutnya (opsional)">
            <DatePickerInput value={tanggalBerikutnya} onChange={setTanggalBerikutnya} />
          </Field>

          <Field label="Keterangan / Notes *">
            <TextInput
              style={[styles.input, { height: 150, textAlignVertical: 'top' }]}
              placeholder="Hasil pertemuan, kesepakatan, follow-up berikutnya..."
              placeholderTextColor="#6b7280"
              value={keterangan}
              onChangeText={setKeterangan}
              multiline
              maxLength={2000}
            />
          </Field>
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
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
});
