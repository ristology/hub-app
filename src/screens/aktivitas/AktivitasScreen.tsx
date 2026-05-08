import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { aktivitasApi, type Aktivitas } from '../../api/aktivitas';

const HARI_INDO = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN_INDO_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Map tipe Bootstrap icons → Ionicons (mobile)
const TIPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  feed_post:            'newspaper',
  feed_tag:             'at',
  appointment:          'calendar',
  kontrak:              'document-text',
  kontrak_referral:     'person-add',
  kalender:             'calendar',
  task_buat:            'add-circle',
  task_selesai:         'checkbox',
  error_log_buat:       'bug',
  error_log_ditugaskan: 'person',
  error_log_handler:    'construct',
  prospek_buat:         'person-add',
  prospek_update:       'sync',
  prospek_kontrak:      'trophy',
  request_buat:         'mail',
  request_terima:       'checkmark-circle',
  request_proses:       'time',
  request_selesai:      'checkmark-done',
  komentar_feed:        'chatbubble',
  komentar_error_log:   'chatbubble',
  komentar_prospek:     'chatbubble',
  komentar_request:     'chatbubble',
  komentar_balas:       'arrow-undo',
};

function dateKey(s: string): string {
  return s.slice(0, 10);
}

function formatGroupHeader(key: string): string {
  const d = new Date(key + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const target = new Date(d); target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime())     return 'Hari ini';
  if (target.getTime() === yesterday.getTime()) return 'Kemarin';
  return `${HARI_INDO[d.getDay()]}, ${d.getDate()} ${BULAN_INDO_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(s: string): string {
  return new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function AktivitasScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [tipe, setTipe] = useState<string | null>(null);

  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteAktivitas(tipe);

  const { data: stats } = useQuery({
    queryKey: ['aktivitas-stats'],
    queryFn:  aktivitasApi.stats,
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Flatten paginated pages, group by date
  const groups = useMemo(() => {
    const flat: Aktivitas[] = data?.pages.flatMap(p => p.data) ?? [];
    const map = new Map<string, Aktivitas[]>();
    for (const a of flat) {
      const key = dateKey(a.created_at);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [data]);

  const totalAll = stats?.data.reduce((sum, s) => sum + s.count, 0) ?? 0;

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
        <Text style={styles.topTitle}>Log Aktivitas</Text>
      </View>

      {/* Filter chips */}
      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          <TouchableOpacity
            onPress={() => setTipe(null)}
            style={[styles.chip, tipe === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, tipe === null && styles.chipTextActive]}>
              Semua ({totalAll})
            </Text>
          </TouchableOpacity>
          {stats?.data.filter(s => s.count > 0).map((s) => (
            <TouchableOpacity
              key={s.tipe}
              onPress={() => setTipe(s.tipe)}
              style={[
                styles.chip,
                tipe === s.tipe && { backgroundColor: s.warna + '30', borderColor: s.warna },
              ]}
            >
              <View style={[styles.chipDot, { backgroundColor: s.warna }]} />
              <Text style={[
                styles.chipText,
                tipe === s.tipe && { color: s.warna, fontWeight: '700' },
              ]}>{s.label} ({s.count})</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item[0]}
        renderItem={({ item }) => {
          const [key, list] = item;
          return (
            <View style={styles.group}>
              <Text style={styles.groupHeader}>{formatGroupHeader(key)}</Text>
              {list.map((a) => <AktivitasItem key={a.id} a={a} />)}
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isFetchingNextPage
            ? <ActivityIndicator color="#3b82f6" style={{ paddingVertical: 16 }} />
            : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="pulse-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>Belum ada aktivitas tercatat.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function AktivitasItem({ a }: { a: Aktivitas }) {
  const iconName = TIPE_ICON[a.tipe] ?? 'pulse';

  return (
    <View style={styles.item}>
      <View style={[styles.iconWrap, { backgroundColor: a.warna + '22' }]}>
        <Ionicons name={iconName} size={16} color={a.warna} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{a.label_tipe}</Text>
        <Text style={styles.itemJudul} numberOfLines={2}>{a.judul}</Text>
        <Text style={styles.itemTime}>{formatTime(a.created_at)}</Text>
      </View>
    </View>
  );
}

function useInfiniteAktivitas(tipe: string | null) {
  return useInfiniteQuery({
    queryKey: ['aktivitas', tipe],
    queryFn: ({ pageParam }) =>
      aktivitasApi.list({ tipe: tipe ?? undefined, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const cur = lastPage.meta.current_page;
      const max = lastPage.meta.last_page;
      return cur < max ? cur + 1 : undefined;
    },
  });
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

  filtersWrap: { marginTop: 8, marginBottom: 4 },
  filtersContent: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 16, paddingVertical: 4, alignItems: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive: { backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
  chipDot:    { width: 6, height: 6, borderRadius: 3 },
  chipText:   { color: '#c5cdd9', fontSize: 12 },
  chipTextActive: { color: '#3b82f6', fontWeight: '600' },

  list: { padding: 16, paddingTop: 8 },
  empty: { color: '#8a94a6', fontSize: 14 },

  group: { marginBottom: 16 },
  groupHeader: {
    color: '#3b82f6', fontSize: 12, fontWeight: '700',
    letterSpacing: 0.5, marginBottom: 8,
    textTransform: 'uppercase',
  },

  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, padding: 12, marginBottom: 6,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  itemLabel: { color: '#8a94a6', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  itemJudul: { color: '#fff', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  itemTime:  { color: '#6b7280', fontSize: 11, marginTop: 4 },
});
