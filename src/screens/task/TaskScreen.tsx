import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { tugasApi, type Tugas, type TugasStatus } from '../../api/tugas';
import TaskCard from './components/TaskCard';
import SwipeableCard, { type SwipeAction } from '../../components/SwipeableCard';

type TaskStackParamList = {
  TaskList: undefined;
  TaskDetail: { id: number };
  CreateTask: undefined;
};

type Filter = 'semua' | TugasStatus;

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: 'semua',   label: 'Semua' },
  { key: 'belum',   label: 'Belum' },
  { key: 'proses',  label: 'Proses' },
  { key: 'selesai', label: 'Selesai' },
];

export default function TaskScreen() {
  const navigation  = useNavigation<NativeStackNavigationProp<TaskStackParamList>>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tugas', filter],
    queryFn:  () => tugasApi.list(filter === 'semua' ? {} : { status: filter }),
  });

  const { data: stats } = useQuery({
    queryKey: ['tugas-stats'],
    queryFn:  tugasApi.stats,
  });

  const completeMut = useMutation({
    mutationFn: (id: number) => tugasApi.updateStatus(id, 'selesai'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tugas'] });
      queryClient.invalidateQueries({ queryKey: ['tugas-stats'] });
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal ubah status.'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleComplete = (item: Tugas) => {
    Alert.alert(
      'Tandai Selesai',
      `Tandai task "${item.judul.slice(0, 60)}${item.judul.length > 60 ? '...' : ''}" sebagai selesai?`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Selesai', style: 'default', onPress: () => completeMut.mutate(item.id) },
      ],
    );
  };

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
        <Text style={styles.title}>Task</Text>
      </View>

      {/* Stats summary */}
      {stats && (
        <View style={styles.statsRow}>
          <StatBox label="Belum"   value={stats.belum}   color="#6b7280" />
          <StatBox label="Proses"  value={stats.proses}  color="#3b82f6" />
          <StatBox label="Selesai" value={stats.selesai} color="#22c55e" />
        </View>
      )}

      {/* Filter chips */}
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

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const action: SwipeAction | undefined = item.status !== 'selesai' ? {
            icon: 'checkmark-done',
            label: 'Selesai',
            color: '#22c55e',
            onPress: () => handleComplete(item),
          } : undefined;
          return (
            <SwipeableCard rightAction={action}>
              <TaskCard task={item} onPress={() => navigation.navigate('TaskDetail', { id: item.id })} />
            </SwipeableCard>
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="checkbox-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>Belum ada task.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateTask')}
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
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 4 },
  title:     { color: '#fff', fontSize: 24, fontWeight: '700' },
  statsRow:  {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12,
  },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 11, marginTop: 2 },
  filters:   {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8, flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive: { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
  chipText:   { color: '#8a94a6', fontSize: 12 },
  chipTextActive: { color: '#3b82f6', fontWeight: '600' },
  list: { padding: 16, paddingTop: 8 },
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
