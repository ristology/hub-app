import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { dokumenApi, type Dokumen } from '../../api/dokumen';
import DokumenCard from './components/DokumenCard';
import FolderGrid from './components/FolderGrid';

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

      {/* Breadcrumb saat di dalam folder */}
      {activeFolder && (
        <View style={styles.breadcrumb}>
          <TouchableOpacity
            onPress={() => setFolderId(null)}
            style={styles.crumbBtn}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={16} color="#3b82f6" />
            <Text style={styles.crumbBack}>Root</Text>
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={14} color="#6b7280" />
          <Ionicons name="folder" size={14} color={activeFolder.warna} />
          <Text style={styles.crumbCurrent} numberOfLines={1}>{activeFolder.nama}</Text>
          <Text style={styles.crumbCount}>{activeFolder.jumlah_dokumen} dok</Text>
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
        ListHeaderComponent={
          folderId === null && !search && foldersData && foldersData.data.length > 0 ? (
            <View style={styles.gridWrap}>
              <FolderGrid
                folders={foldersData.data}
                onPress={(f) => setFolderId(f.id)}
                onLongPress={(f) => navigation.navigate('ManageFolder', { id: f.id })}
              />
              {(data?.data?.length ?? 0) > 0 && (
                <Text style={styles.docSection}>DOKUMEN DI ROOT</Text>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="folder-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>
              {search
                ? 'Tidak ada dokumen yang cocok.'
                : folderId === null
                  ? 'Tidak ada dokumen di root.'
                  : 'Folder ini masih kosong.'}
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

  breadcrumb: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
  },
  crumbBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  crumbBack:    { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  crumbCurrent: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1, marginLeft: 2 },
  crumbCount:   { color: '#8a94a6', fontSize: 11 },

  gridWrap:   { marginBottom: 4 },
  docSection: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 14, marginBottom: 6,
  },

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
