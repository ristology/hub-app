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

import { prospekApi, type Prospek, type ProspekStatus } from '../../api/prospek';
import ProspekCard from './components/ProspekCard';

type ProspekStackParamList = {
  ProspekList: undefined;
  ProspekDetail: { id: number };
  CreateProspek: undefined;
};

type Filter = 'semua' | ProspekStatus;

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: 'semua',     label: 'Semua' },
  { key: 'prospek',   label: 'Prospek' },
  { key: 'follow_up', label: 'Follow Up' },
  { key: 'proposal',  label: 'Proposal' },
  { key: 'negosiasi', label: 'Negosiasi' },
  { key: 'trial',     label: 'Trial' },
  { key: 'kontrak',   label: 'Kontrak' },
  { key: 'batal',     label: 'Batal' },
];

export default function ProspekScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProspekStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['prospek', filter],
    queryFn:  () => prospekApi.list(filter === 'semua' ? {} : { status: filter }),
  });

  const { data: stats } = useQuery({
    queryKey: ['prospek-stats'],
    queryFn:  prospekApi.stats,
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = ({ item }: { item: Prospek }) => (
    <ProspekCard
      prospek={item}
      onPress={() => navigation.navigate('ProspekDetail', { id: item.id })}
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
        <Text style={styles.title}>Prospek</Text>
      </View>

      {/* Stats */}
      {stats && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
          <View style={styles.statsRow}>
            <StatBox label="Aktif"    value={stats.prospek + stats.follow_up + stats.proposal + stats.negosiasi + stats.trial} color="#3b82f6" />
            <StatBox label="Kontrak"  value={stats.kontrak}  color="#22c55e" />
            <StatBox label="Overdue"  value={stats.overdue}  color="#ef4444" />
            <StatBox label="Batal"    value={stats.batal}    color="#6b7280" />
          </View>
        </ScrollView>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        <View style={styles.filters}>
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
        </View>
      </ScrollView>

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
            <Ionicons name="people-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>Belum ada prospek.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateProspek')}
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

  statsScroll: { marginBottom: 12, maxHeight: 70 },
  statsRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 80,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 10, marginTop: 2 },

  filtersScroll: { maxHeight: 40, marginBottom: 4 },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive: { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
  chipText:   { color: '#8a94a6', fontSize: 11 },
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
