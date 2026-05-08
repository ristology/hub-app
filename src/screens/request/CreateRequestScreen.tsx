import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { requestApi, type CreateRequestPayload, type KlienRingkas } from '../../api/clientRequest';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CreateRequestScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [namaKlien, setNamaKlien]     = useState('');
  const [klienId, setKlienId]         = useState<number | null>(null);
  const [tanggalRequest, setTglReq]   = useState(todayISO());
  const [deadline, setDeadline]       = useState('');
  const [keterangan, setKeterangan]   = useState('');
  const [klienOpen, setKlienOpen]     = useState(false);

  const createMutation = useMutation({
    mutationFn: (payload: CreateRequestPayload) => requestApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['request-stats'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal simpan request.'),
  });

  const submit = () => {
    if (!namaKlien.trim())  return Alert.alert('Validasi', 'Nama klien wajib diisi.');
    if (!keterangan.trim()) return Alert.alert('Validasi', 'Keterangan wajib diisi.');
    if (!tanggalRequest)    return Alert.alert('Validasi', 'Tanggal request wajib diisi.');

    createMutation.mutate({
      nama_klien:      namaKlien.trim(),
      klien_id:        klienId,
      tanggal_request: tanggalRequest,
      deadline:        deadline || undefined,
      keterangan:      keterangan.trim(),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Request Baru</Text>
          <TouchableOpacity onPress={submit} disabled={createMutation.isPending} style={styles.saveBtn}>
            {createMutation.isPending
              ? <ActivityIndicator size="small" color="#3b82f6" />
              : <Text style={styles.saveText}>Simpan</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>Nama Klien <Text style={styles.req}>*</Text></Text>
          <TouchableOpacity style={styles.klienBox} onPress={() => setKlienOpen(true)}>
            <Text style={[styles.klienText, !namaKlien && styles.placeholder]} numberOfLines={1}>
              {namaKlien || 'Cari atau ketik nama klien...'}
            </Text>
            <Ionicons name="search" size={18} color="#8a94a6" />
          </TouchableOpacity>

          <Text style={styles.label}>Tanggal Request <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={tanggalRequest}
            onChangeText={setTglReq}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Deadline</Text>
          <TextInput
            style={styles.input}
            value={deadline}
            onChangeText={setDeadline}
            placeholder="YYYY-MM-DD (opsional)"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Keterangan <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={keterangan}
            onChangeText={setKeterangan}
            placeholder="Detail request dari klien..."
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <KlienPicker
        visible={klienOpen}
        onClose={() => setKlienOpen(false)}
        onPick={(k) => {
          setNamaKlien(k.nama);
          setKlienId(k.id);
          setKlienOpen(false);
        }}
        onPickFreeText={(text) => {
          setNamaKlien(text);
          setKlienId(null);
          setKlienOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function KlienPicker({ visible, onClose, onPick, onPickFreeText }: {
  visible: boolean;
  onClose: () => void;
  onPick: (k: KlienRingkas) => void;
  onPickFreeText: (text: string) => void;
}) {
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState<KlienRingkas[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await requestApi.searchKlien(search);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, visible]);

  useEffect(() => { if (visible) setSearch(''); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={pickerStyles.backdrop}
      >
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />

          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>Pilih Klien</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={pickerStyles.searchBox}>
            <Ionicons name="search" size={18} color="#6b7280" />
            <TextInput
              style={pickerStyles.searchInput}
              placeholder="Cari atau ketik nama klien..."
              placeholderTextColor="#6b7280"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="words"
            />
          </View>

          {search.trim() && !results.some(r => r.nama.toLowerCase() === search.trim().toLowerCase()) && (
            <TouchableOpacity
              style={pickerStyles.freeText}
              onPress={() => onPickFreeText(search.trim())}
            >
              <Ionicons name="add-circle-outline" size={18} color="#3b82f6" />
              <Text style={pickerStyles.freeTextLabel}>Pakai "{search.trim()}" (klien tidak terdaftar)</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => onPick(item)} style={pickerStyles.item}>
                  <Ionicons name="business-outline" size={18} color="#3b82f6" />
                  <Text style={pickerStyles.itemText}>{item.nama}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={pickerStyles.empty}>
                  {search ? 'Tidak ada klien terdaftar dengan nama ini.' : 'Mulai ketik untuk mencari.'}
                </Text>
              }
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  textArea: { minHeight: 120 },
  klienBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  klienText:   { color: '#fff', fontSize: 14, flex: 1 },
  placeholder: { color: '#6b7280' },
});

const pickerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d1421', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 24, maxHeight: '80%', minHeight: '60%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginTop: 8, marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  title:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 8,
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },
  freeText: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 8, marginBottom: 8,
  },
  freeTextLabel: { color: '#3b82f6', fontSize: 13, fontWeight: '500' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8,
  },
  itemText: { color: '#fff', fontSize: 14, flex: 1 },
  empty:    { color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 30 },
});
