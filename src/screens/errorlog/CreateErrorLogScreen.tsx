import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { errorLogApi } from '../../api/errorLog';
import { useToast } from '../../components/Toast';

const MAX_PHOTOS = 6;
type Foto = { uri: string; name: string; type: string };

export default function CreateErrorLogScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [klienId, setKlienId]     = useState<number | null>(null);
  const [kategoriId, setKategoriId] = useState<number | null>(null);
  const [keterangan, setKeterangan] = useState('');
  const [url, setUrl]             = useState('');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [fotos, setFotos]         = useState<Foto[]>([]);

  const { data: klienData }    = useQuery({ queryKey: ['error-log-klien'],    queryFn: errorLogApi.klien });
  const { data: kategoriData } = useQuery({ queryKey: ['error-log-kategori'], queryFn: errorLogApi.kategori });

  const createMutation = useMutation({
    mutationFn: () => errorLogApi.create({
      klien_id: klienId ?? undefined,
      kategori_error_id: kategoriId!,
      keterangan,
      url:      url      || undefined,
      username: username || undefined,
      password: password || undefined,
      fotos,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-log'] });
      queryClient.invalidateQueries({ queryKey: ['error-log-stats'] });
      toast.success('Laporan error berhasil dibuat.');
      navigation.goBack();
    },
    onError: (e: any) => {
      Alert.alert('Error', e.response?.data?.message ?? 'Gagal buat laporan.');
    },
  });

  const pickImages = async () => {
    if (fotos.length >= MAX_PHOTOS) {
      Alert.alert('Maksimal', `Maksimal ${MAX_PHOTOS} foto.`);
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Beri izin akses galeri.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - fotos.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newFotos: Foto[] = result.assets.map((a) => ({
        uri:  a.uri,
        name: a.fileName ?? `error-${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      }));
      setFotos((prev) => [...prev, ...newFotos].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (fotos.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Beri izin akses kamera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setFotos((p) => [...p, { uri: a.uri, name: a.fileName ?? `cam-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' }].slice(0, MAX_PHOTOS));
    }
  };

  const handleSubmit = () => {
    if (!keterangan.trim()) { Alert.alert('Error', 'Keterangan wajib diisi.'); return; }
    if (!kategoriId)        { Alert.alert('Error', 'Pilih kategori error.'); return; }
    createMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Laporan Error</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={createMutation.isPending || !keterangan.trim() || !kategoriId}
            style={[styles.postBtn, (!keterangan.trim() || !kategoriId || createMutation.isPending) && styles.postBtnDisabled]}
          >
            {createMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.postBtnText}>Kirim</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Klien (optional) */}
          <Field label="Klien (opsional)">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  onPress={() => setKlienId(null)}
                  style={[styles.chip, klienId === null && styles.chipActive]}
                >
                  <Text style={[styles.chipText, klienId === null && styles.chipTextActive]}>Tanpa Klien</Text>
                </TouchableOpacity>
                {klienData?.data.map((k) => (
                  <TouchableOpacity
                    key={k.id}
                    onPress={() => setKlienId(k.id)}
                    style={[styles.chip, klienId === k.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, klienId === k.id && styles.chipTextActive]}>{k.nama}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Field>

          {/* Kategori (required) */}
          <Field label="Kategori Error *">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {kategoriData?.data.map((k) => (
                  <TouchableOpacity
                    key={k.id}
                    onPress={() => setKategoriId(k.id)}
                    style={[styles.chip, kategoriId === k.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, kategoriId === k.id && styles.chipTextActive]}>{k.nama}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Field>

          {/* Keterangan */}
          <Field label="Keterangan Error *">
            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder="Jelaskan error yang terjadi..."
              placeholderTextColor="#6b7280"
              value={keterangan}
              onChangeText={setKeterangan}
              multiline
              maxLength={5000}
            />
          </Field>

          {/* Foto */}
          <Field label={`Foto Error (opsional, ${fotos.length}/${MAX_PHOTOS})`}>
            {fotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {fotos.map((foto, idx) => (
                  <View key={idx} style={styles.fotoItem}>
                    <Image source={{ uri: foto.uri }} style={styles.fotoImage} />
                    <TouchableOpacity onPress={() => setFotos((p) => p.filter((_, i) => i !== idx))} style={styles.fotoRemove}>
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <View style={styles.mediaRow}>
              <TouchableOpacity onPress={pickImages} style={styles.mediaBtn}>
                <Ionicons name="image-outline" size={20} color="#3b82f6" />
                <Text style={styles.mediaText}>Galeri</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={takePhoto} style={styles.mediaBtn}>
                <Ionicons name="camera-outline" size={20} color="#3b82f6" />
                <Text style={styles.mediaText}>Kamera</Text>
              </TouchableOpacity>
            </View>
          </Field>

          {/* Akses (URL/Username/Password) */}
          <Field label="URL (opsional)">
            <TextInput
              style={styles.input}
              placeholder="https://klien.com/login"
              placeholderTextColor="#6b7280"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          </Field>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Username">
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#6b7280"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Password">
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#6b7280"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
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
  backBtn:   { padding: 4 },
  topTitle:  { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  postBtn:   { backgroundColor: '#3b82f6', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontWeight: '600' },
  scroll:    { padding: 16 },
  field:     { marginBottom: 16 },
  label:     { color: '#8a94a6', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipRow:    { flexDirection: 'row', gap: 8 },
  chip:       {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive: { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
  chipText:   { color: '#8a94a6', fontSize: 13 },
  chipTextActive: { color: '#3b82f6', fontWeight: '600' },
  fotoItem:   { marginRight: 8, position: 'relative' },
  fotoImage:  { width: 90, height: 90, borderRadius: 8, backgroundColor: '#1c2333' },
  fotoRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#0d1421', borderRadius: 11 },
  mediaRow:   { flexDirection: 'row', gap: 16, paddingTop: 4 },
  mediaBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mediaText:  { color: '#3b82f6', fontWeight: '500', fontSize: 13 },
});
