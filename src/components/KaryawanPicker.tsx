import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { feedApi, type KaryawanRingkas } from '../api/feed';

type SearchFn = (q: string) => Promise<{ data: KaryawanRingkas[] }>;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** multiple = pilih banyak (untuk tag feed). single = pilih satu (untuk @mention). */
  mode?: 'single' | 'multiple';
  /** ID yang sudah dipilih (untuk mode multiple) — supaya bisa toggle. */
  selectedIds?: number[];
  onPick: (karyawan: KaryawanRingkas) => void;
  title?: string;
  /** Default pakai feedApi.searchKaryawan. Override untuk modul lain (mis. tugasApi.searchKaryawan). */
  searchFn?: SearchFn;
};

export default function KaryawanPicker({
  visible, onClose, mode = 'multiple',
  selectedIds = [], onPick, title = 'Pilih Karyawan',
  searchFn,
}: Props) {
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState<KaryawanRingkas[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch: SearchFn = searchFn ?? feedApi.searchKaryawan;

  // Debounced search
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await doSearch(search);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, visible]);

  // Reset saat dibuka
  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  const renderItem = ({ item }: { item: KaryawanRingkas }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
        onPress={() => {
          onPick(item);
          if (mode === 'single') onClose();
        }}
        style={[styles.item, isSelected && styles.itemSelected]}
      >
        {item.foto ? (
          <Image source={{ uri: item.foto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{item.nama.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.name}>{item.nama}</Text>
          {item.jabatan ? <Text style={styles.jabatan}>{item.jabatan}</Text> : null}
        </View>
        {mode === 'multiple' && (
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={isSelected ? '#3b82f6' : '#6b7280'}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari nama karyawan..."
              placeholderTextColor="#6b7280"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {loading && results.length === 0 ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {search ? 'Tidak ada karyawan ditemukan.' : 'Mulai ketik untuk mencari.'}
                </Text>
              }
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}

          {mode === 'multiple' && (
            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Selesai ({selectedIds.length} dipilih)</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8,
  },
  itemSelected: { backgroundColor: 'rgba(59,130,246,0.10)' },
  avatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: '#fff', fontWeight: '700' },
  name:      { color: '#fff', fontSize: 14, fontWeight: '500' },
  jabatan:   { color: '#8a94a6', fontSize: 11, marginTop: 1 },
  empty:     { color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 30 },
  doneBtn:   {
    backgroundColor: '#3b82f6', paddingVertical: 13,
    borderRadius: 10, alignItems: 'center', marginTop: 8,
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
