import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { dokumenApi } from '../../api/dokumen';

type RouteParams = { folderId?: number | null };
type Picked = { uri: string; name: string; type: string; size: number };

function formatBytes(b: number): string {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.substring(0, i) : name;
}

export default function UploadDokumenScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const initialFolderId = route.params?.folderId ?? null;
  const queryClient = useQueryClient();

  const [judul, setJudul]         = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [kategori, setKategori]   = useState('Umum');
  const [folderId, setFolderId]   = useState<number | null>(initialFolderId);
  const [file, setFile]           = useState<Picked | null>(null);

  const { data: meta } = useQuery({ queryKey: ['dokumen-meta'], queryFn: dokumenApi.meta });
  const { data: foldersData } = useQuery({ queryKey: ['dokumen-folders'], queryFn: dokumenApi.folders });

  const uploadMut = useMutation({
    mutationFn: () => dokumenApi.upload({
      judul, deskripsi, kategori, folder_id: folderId, file: file!,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dokumen'] });
      queryClient.invalidateQueries({ queryKey: ['dokumen-folders'] });
      navigation.goBack();
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join('\n')
        ?? 'Gagal upload dokumen.';
      Alert.alert('Error', msg);
    },
  });

  const pickFromDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'application/vnd.ms-excel',
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
             'application/vnd.ms-powerpoint',
             'application/vnd.openxmlformats-officedocument.presentationml.presentation',
             'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 50 * 1024 * 1024) {
      Alert.alert('File terlalu besar', 'Maksimal 50 MB.');
      return;
    }
    const picked: Picked = {
      uri:  asset.uri,
      name: asset.name,
      type: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? 0,
    };
    setFile(picked);
    if (!judul) setJudul(stripExt(picked.name));
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Akses kamera dibutuhkan.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const picked: Picked = {
      uri:  asset.uri,
      name: asset.fileName ?? `foto_${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize ?? 0,
    };
    setFile(picked);
    if (!judul) setJudul(stripExt(picked.name));
  };

  const promptPickFile = () => {
    Alert.alert('Pilih File', 'Sumber file:', [
      { text: 'Batal' },
      { text: 'Galeri / File',  onPress: pickFromDocument },
      { text: 'Foto Kamera',    onPress: pickFromCamera },
    ]);
  };

  const submit = () => {
    if (!judul.trim()) return Alert.alert('Validasi', 'Judul wajib diisi.');
    if (!file)         return Alert.alert('Validasi', 'File wajib dipilih.');
    uploadMut.mutate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Upload Dokumen</Text>
          <TouchableOpacity onPress={submit} disabled={uploadMut.isPending} style={styles.saveBtn}>
            {uploadMut.isPending
              ? <ActivityIndicator size="small" color="#3b82f6" />
              : <Text style={styles.saveText}>Upload</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* File picker */}
          <Text style={styles.label}>File <Text style={styles.req}>*</Text></Text>
          <TouchableOpacity style={styles.filePicker} onPress={promptPickFile}>
            {file ? (
              <View style={styles.fileInfo}>
                <Ionicons name="document" size={28} color="#3b82f6" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.fileSize}>{formatBytes(file.size)}</Text>
                </View>
                <TouchableOpacity onPress={() => setFile(null)}>
                  <Ionicons name="close-circle" size={20} color="#8a94a6" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.filePlaceholder}>
                <Ionicons name="cloud-upload-outline" size={32} color="#8a94a6" />
                <Text style={styles.placeholderText}>Tap untuk pilih file</Text>
                <Text style={styles.placeholderSub}>PDF, Word, Excel, PPT, gambar (max 50 MB)</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Judul <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={judul}
            onChangeText={setJudul}
            placeholder="Judul dokumen..."
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Kategori</Text>
          <View style={styles.chipRow}>
            {(meta?.kategori_list ?? []).map((k) => (
              <TouchableOpacity
                key={k}
                onPress={() => setKategori(k)}
                style={[
                  styles.chip,
                  kategori === k && { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
                ]}
              >
                <Text style={[
                  styles.chipText,
                  kategori === k && { color: '#3b82f6', fontWeight: '700' },
                ]}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {foldersData && foldersData.data.length > 0 && (
            <>
              <Text style={styles.label}>Folder</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  onPress={() => setFolderId(null)}
                  style={[
                    styles.chip,
                    folderId === null && { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: '#fff' },
                  ]}
                >
                  <Text style={[styles.chipText, folderId === null && { color: '#fff', fontWeight: '700' }]}>
                    Tanpa Folder
                  </Text>
                </TouchableOpacity>
                {foldersData.data.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setFolderId(f.id)}
                    style={[
                      styles.chip,
                      folderId === f.id && { backgroundColor: f.warna + '30', borderColor: f.warna },
                    ]}
                  >
                    <Ionicons name="folder" size={12} color={folderId === f.id ? f.warna : '#8a94a6'} />
                    <Text style={[
                      styles.chipText,
                      folderId === f.id && { color: f.warna, fontWeight: '700' },
                    ]}>{f.nama}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>Deskripsi (opsional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 90 }]}
            value={deskripsi}
            onChangeText={setDeskripsi}
            placeholder="Keterangan tambahan..."
            placeholderTextColor="#6b7280"
            multiline
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  filePicker: {
    backgroundColor: 'rgba(59,130,246,0.05)',
    borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(59,130,246,0.40)',
    borderRadius: 12, padding: 16,
  },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  fileSize: { color: '#8a94a6', fontSize: 11, marginTop: 2 },
  filePlaceholder: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  placeholderText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  placeholderSub:  { color: '#8a94a6', fontSize: 11 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipText: { color: '#c5cdd9', fontSize: 12 },
});
