import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
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

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: 'semua',    label: 'Semua' },
  { key: 'menunggu', label: 'Menunggu' },
  { key: 'diterima', label: 'Diterima' },
  { key: 'proses',   label: 'Proses' },
  { key: 'selesai',  label: 'Selesai' },
  { key: 'ditolak',  label: 'Ditolak' },
];

export default function RequestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RequestStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['request', filter],
    queryFn:  () => requestApi.list(filter === 'semua' ? {} : { status: filter }),
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
        <Text style={styles.title}>Request</Text>
      </View>

      {stats && (
        <View style={styles.statsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContent}
          >
            <StatBox label="Menunggu" value={stats.menunggu} color="#8a94a6" />
            <StatBox label="Diterima" value={stats.diterima} color="#3b82f6" />
            <StatBox label="Proses"   value={stats.proses}   color="#f59e0b" />
            <StatBox label="Selesai"  value={stats.selesai}  color="#22c55e" />
            <StatBox label="Overdue"  value={stats.overdue}  color="#ef4444" />
          </ScrollView>
        </View>
      )}

      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setFilter(opt.key)}
              style={[styles.chip, filter === opt.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === opt.key && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
            <Ionicons name="inbox-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>Belum ada request.</Text>
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
  header:    { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title:     { color: '#fff', fontSize: 24, fontWeight: '700' },

  statsWrap: { marginBottom: 10 },
  statsContent: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 4,
  },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 80,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 11, marginTop: 2 },

  filtersWrap: { marginBottom: 8 },
  filtersContent: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 16,
    paddingVertical: 4, alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
  chipText:   { color: '#c5cdd9', fontSize: 12 },
  chipTextActive: { color: '#3b82f6', fontWeight: '600' },

  list:  { padding: 16, paddingTop: 8 },
  empty: { color: '#8a94a6', fontSize: 14 },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
});
