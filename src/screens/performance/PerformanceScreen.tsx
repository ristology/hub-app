import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { performanceApi, type PerformanceItem, type PerformanceJenis } from '../../api/performance';
import PerformanceCard from './components/PerformanceCard';

type ParamList = {
  PerformanceList: undefined;
  PerformanceDetail: { id: number };
  CreatePerformance: { id?: number } | undefined;
};

type Filter = 'semua' | PerformanceJenis;

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: 'semua',       label: 'Semua' },
  { key: 'appointment', label: 'Appointment' },
  { key: 'kontrak',     label: 'Goal Kontrak' },
];

export default function PerformanceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['performance', filter],
    queryFn:  () => performanceApi.list(filter === 'semua' ? {} : { jenis: filter }),
  });

  const { data: stats } = useQuery({
    queryKey: ['performance-stats'],
    queryFn:  () => performanceApi.stats(),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = ({ item }: { item: PerformanceItem }) => (
    <PerformanceCard
      item={item}
      onPress={() => navigation.navigate('PerformanceDetail', { id: item.id })}
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
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Performance</Text>
      </View>

      {stats && (
        <View style={[styles.statsWrap, styles.statsContent]}>
          <StatBox
            label={`Appointment ${stats.tahun}`}
            value={stats.total_appointment}
            color="#3b82f6"
            icon="calendar"
          />
          <StatBox
            label={`Kontrak ${stats.tahun}`}
            value={stats.total_kontrak}
            color="#22c55e"
            icon="document-text"
          />
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
            <Ionicons name="trending-up-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>Belum ada catatan performance.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePerformance')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: any;
}) {
  return (
    <View style={[styles.statBox, { borderColor: color + '40' }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },

  statsWrap: { marginTop: 10, marginBottom: 6 },
  statsContent: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 4,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 11 },

  filtersWrap: { marginBottom: 8 },
  filtersContent: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 16, paddingVertical: 4, alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive: { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
  chipText:   { color: '#c5cdd9', fontSize: 12 },
  chipTextActive: { color: '#3b82f6', fontWeight: '600' },

  list:  { padding: 16, paddingTop: 4 },
  empty: { color: '#8a94a6', fontSize: 14 },

  fab: {
    position: 'absolute', right: 20, bottom: Platform.OS === 'android' ? 140 : 110,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
});
