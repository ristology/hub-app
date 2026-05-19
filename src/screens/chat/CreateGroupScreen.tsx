import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, ActivityIndicator, Alert, ScrollView, Keyboard, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { chatApi, type ChatUser } from '../../api/chat';

type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { roomId: number; nama: string; foto: string | null };
  NewChat: undefined;
  CreateGroup: undefined;
};

type Foto = { uri: string; name: string; type: string };

export default function CreateGroupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ChatStackParamList>>();
  const insets     = useSafeAreaInsets();

  const [nama, setNama]     = useState('');
  const [foto, setFoto]     = useState<Foto | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ChatUser[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selected, setSelected] = useState<ChatUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  // Search debounced
  useEffect(() => {
    setLoadingSearch(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await chatApi.searchUsers(search);
        setResults(data);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Manual keyboard handling — match feedback_mobile_keyboard_patterns
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const toggleSelect = useCallback((u: ChatUser) => {
    setSelected((prev) =>
      prev.find((x) => x.user_id === u.user_id)
        ? prev.filter((x) => x.user_id !== u.user_id)
        : [...prev, u]
    );
  }, []);

  const removeSelected = useCallback((userId: number) => {
    setSelected((prev) => prev.filter((x) => x.user_id !== userId));
  }, []);

  // "Pilih Semua" — toggle select/unselect seluruh karyawan yg sedang tampil
  // di list (respect filter search). Pattern sama dgn KaryawanPicker kalender.
  const allDisplayedSelected = results.length > 0
    && results.every((u) => selected.some((s) => s.user_id === u.user_id));

  const toggleSelectAll = useCallback(() => {
    if (allDisplayedSelected) {
      // Deselect yg sedang tampil — pertahankan selected lain (jaga-jaga
      // kalau user pernah select dari hasil search berbeda)
      setSelected((prev) =>
        prev.filter((s) => !results.some((r) => r.user_id === s.user_id))
      );
    } else {
      // Merge: pertahankan selected lama, tambah results yg belum ada
      setSelected((prev) => {
        const map = new Map(prev.map((s) => [s.user_id, s]));
        for (const r of results) map.set(r.user_id, r);
        return Array.from(map.values());
      });
    }
  }, [allDisplayedSelected, results]);

  const pickFoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Beri izin akses galeri di pengaturan HP.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setFoto({
        uri:  a.uri,
        name: a.fileName ?? `group-${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      });
    }
  };

  const submit = async () => {
    if (!nama.trim()) { Alert.alert('Validasi', 'Nama grup wajib diisi.'); return; }
    if (selected.length === 0) { Alert.alert('Validasi', 'Pilih minimal 1 anggota.'); return; }

    setSubmitting(true);
    try {
      const { data: room } = await chatApi.createGroup({
        nama:       nama.trim(),
        member_ids: selected.map((u) => u.user_id),
        ...(foto ? { foto } : {}),
      });
      navigation.replace('ChatRoom', {
        roomId: room.id,
        nama:   room.nama,
        foto:   room.foto,
      });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Gagal membuat grup.');
      setSubmitting(false);
    }
  };

  const isValid = nama.trim().length > 0 && selected.length > 0;

  const renderUser = ({ item }: { item: ChatUser }) => {
    const isSelected = !!selected.find((x) => x.user_id === item.user_id);
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => toggleSelect(item)}
        activeOpacity={0.7}
      >
        {item.foto ? (
          <Image source={{ uri: item.foto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFb]}>
            <Text style={styles.avatarTxt}>{item.nama.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.userName} numberOfLines={1}>{item.nama}</Text>
          {item.jabatan && <Text style={styles.userJabatan} numberOfLines={1}>{item.jabatan}</Text>}
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Buat Grup</Text>
        <TouchableOpacity
          onPress={submit}
          disabled={!isValid || submitting}
          style={[styles.submitBtn, (!isValid || submitting) && styles.submitBtnDisabled]}
          hitSlop={8}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitText}>Buat</Text>}
        </TouchableOpacity>
      </View>

      {/* Foto + nama header */}
      <View style={styles.headerForm}>
        <TouchableOpacity onPress={pickFoto} activeOpacity={0.8} style={styles.fotoBtn}>
          {foto ? (
            <Image source={{ uri: foto.uri }} style={styles.fotoImg} />
          ) : (
            <View style={[styles.fotoImg, styles.fotoFb]}>
              <Ionicons name="camera" size={26} color="#8a94a6" />
            </View>
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.namaInput}
          placeholder="Nama grup"
          placeholderTextColor="#6b7280"
          value={nama}
          onChangeText={setNama}
          maxLength={100}
        />
      </View>

      {/* Selected members chip-row */}
      {selected.length > 0 && (
        <View style={styles.chipsWrap}>
          <Text style={styles.chipsLabel}>{selected.length} anggota dipilih</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {selected.map((u) => (
              <View key={u.user_id} style={styles.chip}>
                {u.foto ? (
                  <Image source={{ uri: u.foto }} style={styles.chipAvatar} />
                ) : (
                  <View style={[styles.chipAvatar, styles.avatarFb]}>
                    <Text style={styles.chipAvatarTxt}>{u.nama.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.chipName} numberOfLines={1}>{u.nama}</Text>
                <TouchableOpacity onPress={() => removeSelected(u.user_id)} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color="#8a94a6" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Search box */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama karyawan..."
          placeholderTextColor="#6b7280"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
            <Ionicons name="close-circle" size={16} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {loadingSearch && results.length === 0 ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.user_id)}
          renderItem={renderUser}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: kbHeight > 0 ? kbHeight - insets.bottom + 20 : 20 },
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            results.length > 0 ? (
              <TouchableOpacity
                onPress={toggleSelectAll}
                style={styles.selectAllRow}
                activeOpacity={0.6}
              >
                <View style={[styles.checkbox, allDisplayedSelected && styles.checkboxOn]}>
                  {allDisplayedSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.selectAllText}>
                  {allDisplayedSelected ? 'Batal pilih semua' : 'Pilih semua'} ({results.length})
                </Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search ? 'Tidak ada karyawan ditemukan.' : 'Memuat daftar karyawan...'}
            </Text>
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 4 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },
  submitBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    minWidth: 60, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: 'rgba(59,130,246,0.30)' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  headerForm: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  fotoBtn:  { width: 60, height: 60 },
  fotoImg:  { width: 60, height: 60, borderRadius: 30 },
  fotoFb:   {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderStyle: 'dashed',
  },
  namaInput: {
    flex: 1, color: '#fff', fontSize: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)',
  },

  chipsWrap: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  chipsLabel: { color: '#8a94a6', fontSize: 11, fontWeight: '600', marginBottom: 6 },
  chipsRow:   { gap: 8, paddingRight: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.30)',
    maxWidth: 180,
  },
  chipAvatar:    { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1c2333' },
  chipAvatarTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chipName:      { color: '#fff', fontSize: 12, flexShrink: 1 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 12, marginHorizontal: 16, marginVertical: 12,
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },

  list:      { paddingHorizontal: 16 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 60 },
  selectAllRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 4,
  },
  selectAllText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  userItem:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  avatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1c2333' },
  avatarFb:  { alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  userName:  { color: '#fff', fontWeight: '500', fontSize: 14 },
  userJabatan: { color: '#8a94a6', fontSize: 12, marginTop: 2 },

  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },

  empty: { color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 30 },
});
