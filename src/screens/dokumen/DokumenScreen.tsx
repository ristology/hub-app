import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, ScrollView, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { dokumenApi, type Dokumen } from '../../api/dokumen';
import DokumenCard from './components/DokumenCard';
import FolderChip from './components/FolderChip';

type ParamList = {
  DokumenList: undefined;
  DokumenDetail: { id: number };
  UploadDokumen: { folderId?: number | null } | undefined;
  ManageFolder: { id?: number } | undefined;
};

export default function DokumenScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: foldersData } = useQuery({
    queryKey: ['dokumen-folders'],
    queryFn:  dokumenApi.folders,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dokumen', folderId, search],
    queryFn:  () => dokumenApi.list({
      folder_id: folderId,
      search:    search || undefined,
    }),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const submitSearch = () => setSearch(searchInput.trim());

  const renderItem = ({ item }: { item: Dokumen }) => (
    <DokumenCard
      dokumen={item}
      onPress={() => navigation.navigate('DokumenDetail', { id: item.id })}
    />
  );

  const activeFolder = foldersData?.data.find(f => f.id === folderId) ?? null;

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Dokumen</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('ManageFolder')}
          style={styles.iconBtn}
        >
          <Ionicons name="folder-open-outline" size={22} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#6b7280" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari dokumen..."
          placeholderTextColor="#6b7280"
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
        />
        {searchInput ? (
          <TouchableOpacity onPress={() => { setSearchInput(''); setSearch(''); }} style={{ paddingHorizontal: 12 }}>
            <Ionicons name="close-circle" size={16} color="#6b7280" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Folder chips */}
      {foldersData && foldersData.data.length > 0 && (
        <View style={styles.foldersWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.foldersContent}
          >
            <TouchableOpacity
              onPress={() => setFolderId(null)}
              style={[
                styles.rootChip,
                folderId === null && styles.rootChipActive,
              ]}
            >
              <Ionicons name="albums-outline" size={16} color={folderId === null ? '#3b82f6' : '#8a94a6'} />
              <Text style={[
                styles.rootChipText,
                folderId === null && { color: '#3b82f6', fontWeight: '700' },
              ]}>Root</Text>
            </TouchableOpacity>
            {foldersData.data.map((f) => (
              <FolderChip
                key={f.id}
                folder={f}
                active={folderId === f.id}
                onPress={() => setFolderId(f.id)}
                onLongPress={() => navigation.navigate('ManageFolder', { id: f.id })}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {activeFolder && (
        <View style={styles.activeFolderBar}>
          <Ionicons name="folder" size={14} color={activeFolder.warna} />
          <Text style={styles.activeFolderText}>{activeFolder.nama}</Text>
          <Text style={styles.activeFolderCount}>{activeFolder.jumlah_dokumen} dokumen</Text>
        </View>
      )}

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="folder-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>
              {search ? 'Tidak ada dokumen yang cocok.' : 'Belum ada dokumen di sini.'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('UploadDokumen', { folderId })}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 8 },
  iconBtn:  { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 },

  foldersWrap: { marginTop: 10 },
  foldersContent: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 4, alignItems: 'center',
  },
  rootChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
  },
  rootChipActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3b82f6' },
  rootChipText: { color: '#8a94a6', fontSize: 12 },

  activeFolderBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  activeFolderText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  activeFolderCount: { color: '#8a94a6', fontSize: 11 },

  list: { padding: 16, paddingTop: 8 },
  empty: { color: '#8a94a6', fontSize: 14, textAlign: 'center' },

  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
});
