import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dokumenApi } from '../../api/dokumen';

type RouteParams = { id?: number };

export default function ManageFolderScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const editId = route.params?.id;
  const queryClient = useQueryClient();

  const [nama, setNama]   = useState('');
  const [warna, setWarna] = useState<string | null>(null);

  const { data: foldersData } = useQuery({ queryKey: ['dokumen-folders'], queryFn: dokumenApi.folders });

  // Pre-fill saat edit
  useEffect(() => {
    if (!editId || !foldersData) return;
    const f = foldersData.data.find(x => x.id === editId);
    if (f) {
      setNama(f.nama);
      setWarna(f.warna);
    }
  }, [editId, foldersData]);

  const saveMut = useMutation({
    mutationFn: () =>
      editId
        ? dokumenApi.updateFolder(editId, { nama, warna: warna! })
        : dokumenApi.createFolder(nama, warna!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dokumen-folders'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal simpan folder.'),
  });

  const destroyMut = useMutation({
    mutationFn: (id: number) => dokumenApi.destroyFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dokumen-folders'] });
      queryClient.invalidateQueries({ queryKey: ['dokumen'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus folder.'),
  });

  const submit = () => {
    if (!nama.trim()) return Alert.alert('Validasi', 'Nama folder wajib diisi.');
    if (!warna)       return Alert.alert('Validasi', 'Pilih warna folder.');
    saveMut.mutate();
  };

  const onDelete = (id: number, name: string) => {
    Alert.alert(
      'Hapus Folder',
      `Yakin hapus folder "${name}"? Dokumen di dalamnya akan dipindah ke root.`,
      [
        { text: 'Batal' },
        { text: 'Hapus', style: 'destructive', onPress: () => destroyMut.mutate(id) },
      ]
    );
  };

  const warnaList = foldersData?.warna_list ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{editId ? 'Edit Folder' : 'Kelola Folder'}</Text>
          <TouchableOpacity onPress={submit} disabled={saveMut.isPending} style={styles.saveBtn}>
            {saveMut.isPending
              ? <ActivityIndicator size="small" color="#3b82f6" />
              : <Text style={styles.saveText}>{editId ? 'Update' : 'Buat'}</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>{editId ? 'Edit Nama Folder' : 'Nama Folder Baru'} <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={nama}
            onChangeText={setNama}
            placeholder="Mis: Kontrak Klien, HR, dll..."
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Pilih Warna <Text style={styles.req}>*</Text></Text>
          <View style={styles.colorGrid}>
            {warnaList.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setWarna(c)}
                style={[
                  styles.colorBox,
                  { backgroundColor: c },
                  warna === c && styles.colorBoxActive,
                ]}
              >
                {warna === c && <Ionicons name="checkmark" size={20} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Existing folder list (only when not editing) */}
          {!editId && foldersData && foldersData.data.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 24 }]}>Folder yang Ada</Text>
              <View style={styles.folderList}>
                {foldersData.data.map((f) => (
                  <View key={f.id} style={styles.folderItem}>
                    <Ionicons name="folder" size={18} color={f.warna} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.folderName}>{f.nama}</Text>
                      <Text style={styles.folderCount}>{f.jumlah_dokumen} dokumen</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('ManageFolder', { id: f.id })}
                      style={styles.folderAction}
                    >
                      <Ionicons name="create-outline" size={18} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(f.id, f.nama)}
                      style={styles.folderAction}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}

          {editId && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => {
                const f = foldersData?.data.find(x => x.id === editId);
                if (f) onDelete(f.id, f.nama);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.deleteText}>Hapus Folder Ini</Text>
            </TouchableOpacity>
          )}
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
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorBox: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorBoxActive: { borderColor: '#fff' },

  folderList: { gap: 6 },
  folderItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  folderName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  folderCount: { color: '#8a94a6', fontSize: 11, marginTop: 1 },
  folderAction: { padding: 6 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1, borderColor: '#ef4444',
    paddingVertical: 12, borderRadius: 10,
    marginTop: 24,
  },
  deleteText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
});
