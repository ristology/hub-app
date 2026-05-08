import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { kalenderApi, type Kegiatan } from '../../api/kalender';
import KegiatanCard from './components/KegiatanCard';

type KalenderStackParamList = {
  KalenderList: undefined;
  KegiatanDetail: { id: number };
  CreateKegiatan: undefined;
};

const HARI_INDO = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date):   Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function toIso(d: Date): string { return d.toISOString().slice(0, 19); }

function dateKey(s: string): string {
  return s.slice(0, 10);
}

function formatGroupHeader(key: string): string {
  const d = new Date(key + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime())    return 'Hari ini';
  if (target.getTime() === tomorrow.getTime()) return 'Besok';
  return `${HARI_INDO[d.getDay()]}, ${d.getDate()} ${BULAN_INDO[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export default function KalenderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<KalenderStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());

  const start = startOfMonth(cursor);
  const end   = endOfMonth(cursor);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['kalender', start.toISOString(), end.toISOString()],
    queryFn:  () => kalenderApi.list({ start: toIso(start), end: toIso(end) }),
  });

  const { data: stats } = useQuery({
    queryKey: ['kalender-stats'],
    queryFn:  kalenderApi.stats,
  });

  const { data: googleStatus } = useQuery({
    queryKey: ['kalender-google-status'],
    queryFn:  kalenderApi.googleStatus,
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const groups = useMemo(() => {
    const list = data?.data ?? [];
    const map = new Map<string, Kegiatan[]>();
    for (const k of list) {
      const key = dateKey(k.mulai_at);
      const arr = map.get(key) ?? [];
      arr.push(k);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const renderItem = ({ item }: { item: [string, Kegiatan[]] }) => {
    const [key, list] = item;
    return (
      <View style={styles.group}>
        <Text style={styles.groupHeader}>{formatGroupHeader(key)}</Text>
        {list.map((k) => (
          <KegiatanCard
            key={k.id}
            kegiatan={k}
            onPress={() => navigation.navigate('KegiatanDetail', { id: k.id })}
          />
        ))}
      </View>
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
        <Text style={styles.title}>Kalender</Text>
        {googleStatus && (
          <View style={[
            styles.googleBadge,
            googleStatus.connected ? styles.googleConnected : styles.googleDisconnected,
          ]}>
            <Ionicons
              name={googleStatus.connected ? 'cloud-done' : 'cloud-offline'}
              size={11}
              color={googleStatus.connected ? '#22c55e' : '#8a94a6'}
            />
            <Text style={[
              styles.googleText,
              { color: googleStatus.connected ? '#22c55e' : '#8a94a6' },
            ]}>
              {googleStatus.connected ? 'Google Sync' : 'Not Connected'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCursor(new Date())} style={styles.monthLabel}>
          <Text style={styles.monthText}>
            {BULAN_INDO[cursor.getMonth()]} {cursor.getFullYear()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={styles.statsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContent}
          >
            <StatBox label="Hari ini"   value={stats.hari_ini}   color="#3b82f6" />
            <StatBox label="Minggu ini" value={stats.minggu_ini} color="#22c55e" />
            <StatBox label="Mendatang"  value={stats.mendatang}  color="#f59e0b" />
          </ScrollView>
        </View>
      )}

      <FlatList
        data={groups}
        keyExtractor={(item) => item[0]}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="calendar-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>Tidak ada jadwal di bulan ini.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateKegiatan')}
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
  header:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  title:     { color: '#fff', fontSize: 24, fontWeight: '700' },
  googleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1,
  },
  googleConnected:    { backgroundColor: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)' },
  googleDisconnected: { backgroundColor: 'rgba(138,148,166,0.10)', borderColor: 'rgba(138,148,166,0.25)' },
  googleText: { fontSize: 10, fontWeight: '600' },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, marginBottom: 8,
  },
  navBtn:     { padding: 8 },
  monthLabel: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  monthText:  { color: '#fff', fontSize: 16, fontWeight: '600' },

  statsWrap: { marginBottom: 10 },
  statsContent: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 4,
  },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 90,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 11, marginTop: 2 },

  list: { padding: 16, paddingTop: 4 },
  empty: { color: '#8a94a6', fontSize: 14 },

  group: { marginBottom: 14 },
  groupHeader: {
    color: '#3b82f6', fontSize: 12, fontWeight: '700',
    letterSpacing: 0.5, marginBottom: 8,
    textTransform: 'uppercase',
  },

  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
});
