import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { requestApi, type ClientRequest, type RequestStatus } from '../../api/clientRequest';
import RequestCard from './components/RequestCard';

type RequestStackParamList = {
  RequestList: undefined;
  RequestDetail: { id: number };
  CreateRequest: undefined;
};

type Filter = 'semua' | RequestStatus;

const FILTER_OPTIONS: { key: Filter; label: string; color: string }[] = [
  { key: 'semua',    label: 'Semua',    color: '#3b82f6' },
  { key: 'menunggu', label: 'Menunggu', color: '#8a94a6' },
  { key: 'diterima', label: 'Diterima', color: '#3b82f6' },
  { key: 'proses',   label: 'Proses',   color: '#f59e0b' },
  { key: 'selesai',  label: 'Selesai',  color: '#22c55e' },
  { key: 'ditolak',  label: 'Ditolak',  color: '#ef4444' },
];

export default function RequestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RequestStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['request', filter, debouncedSearch],
    queryFn:  () => requestApi.list({
      ...(filter === 'semua' ? {} : { status: filter }),
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({
    queryKey: ['request-stats'],
    queryFn:  requestApi.stats,
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = ({ item }: { item: ClientRequest }) => (
    <RequestCard
      request={item}
      onPress={() => navigation.navigate('RequestDetail', { id: item.id })}
    />
  );

  const currentFilter = FILTER_OPTIONS.find((f) => f.key === filter) ?? FILTER_OPTIONS[0];

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Request</Text>
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <StatBox label="Menunggu" value={stats.menunggu} color="#8a94a6" />
          <StatBox label="Proses"   value={(stats.diterima ?? 0) + (stats.proses ?? 0)} color="#f59e0b" />
          <StatBox label="Selesai"  value={stats.selesai}  color="#22c55e" />
          <StatBox label="Overdue"  value={stats.overdue}  color="#ef4444" />
        </View>
      )}

      <View style={styles.toolsRow}>
        <TouchableOpacity
          style={[styles.statusBtn, { borderColor: currentFilter.color + '60' }]}
          onPress={() => setStatusOpen(true)}
        >
          <View style={[styles.statusDot, { backgroundColor: currentFilter.color }]} />
          <Text style={styles.statusText} numberOfLines={1}>{currentFilter.label}</Text>
          <Ionicons name="chevron-down" size={14} color="#8a94a6" />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari request..."
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
            <Ionicons name="mail-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>
              {search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada request.'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateRequest')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={statusOpen} transparent animationType="slide" onRequestClose={() => setStatusOpen(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setStatusOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filter Status</Text>
            {FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sheetItem, filter === opt.key && { backgroundColor: opt.color + '15' }]}
                onPress={() => { setFilter(opt.key); setStatusOpen(false); }}
              >
                <View style={[styles.sheetDot, { backgroundColor: opt.color }]} />
                <Text style={[styles.sheetItemText, filter === opt.key && { color: opt.color, fontWeight: '700' }]}>
                  {opt.label}
                </Text>
                {filter === opt.key && (
                  <Ionicons name="checkmark" size={18} color={opt.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12, gap: 4,
  },
  backBtn: { padding: 8 },
  title:   { color: '#fff', fontSize: 22, fontWeight: '700', flex: 1 },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 11, marginTop: 4 },

  toolsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 8,
  },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, borderWidth: 1,
    minWidth: 130,
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 0 },

  list:  { padding: 16, paddingTop: 8 },
  empty: { color: '#8a94a6', fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1c2333',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 30, paddingHorizontal: 12, paddingTop: 8,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: {
    color: '#8a94a6', fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 8,
    textTransform: 'uppercase',
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 10,
  },
  sheetDot: { width: 10, height: 10, borderRadius: 5 },
  sheetItemText: { color: '#fff', fontSize: 14, flex: 1 },
});
