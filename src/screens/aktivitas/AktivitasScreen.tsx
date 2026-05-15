import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { aktivitasApi, type Aktivitas } from '../../api/aktivitas';
import PickerSheet, { type PickerOption } from '../../components/PickerSheet';

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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tipeOpen, setTipeOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteAktivitas(tipe, debouncedSearch);

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

  // Resolver: model_type → navigation target. Kalau tipe tidak dikenal, return null.
  const getNavTarget = (a: Aktivitas): { tab: string; screen?: string; params?: any } | null => {
    if (!a.model_type || !a.model_id) return null;
    const id = a.model_id;
    const mt = a.model_type;

    if (mt.endsWith('\\Feed') || mt === 'App\\Models\\Feed') {
      return { tab: 'Feed', screen: 'FeedDetail', params: { id } };
    }
    if (mt.endsWith('\\Prospek') || mt === 'App\\Models\\Prospek') {
      return { tab: 'Prospek', screen: 'ProspekDetail', params: { id } };
    }
    if (mt.endsWith('\\ErrorLog') || mt === 'App\\Models\\ErrorLog') {
      return { tab: 'ErrorLog', screen: 'ErrorLogDetail', params: { id } };
    }
    if (mt.endsWith('\\ClientRequest') || mt === 'App\\Models\\ClientRequest') {
      return { tab: 'Request', screen: 'RequestDetail', params: { id } };
    }
    if (mt.endsWith('\\KalenderKegiatan') || mt === 'App\\Models\\KalenderKegiatan') {
      return { tab: 'Kalender', screen: 'KegiatanDetail', params: { id } };
    }
    if (mt.endsWith('\\Tugas') || mt === 'App\\Models\\Tugas') {
      return { tab: 'Task', screen: 'TaskDetail', params: { id } };
    }
    if (mt.endsWith('\\Performance') || mt === 'App\\Models\\Performance') {
      return { tab: 'Performance', screen: 'PerformanceDetail', params: { id } };
    }
    return null;
  };

  const handleTap = (a: Aktivitas) => {
    const target = getNavTarget(a);
    if (!target) return;
    if (target.screen) {
      // initial: false → stack tetap mulai dari list screen (mis. KalenderList),
      // detail di-push di atasnya. Tanpa ini, back langsung lompat ke Beranda
      // karena stack hanya berisi detail screen saja.
      navigation.navigate(target.tab, { screen: target.screen, initial: false, params: target.params });
    } else {
      navigation.navigate(target.tab, target.params);
    }
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
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Log Aktivitas</Text>
      </View>

      {/* Picker tipe + search bar */}
      <View style={styles.toolsRow}>
        <TouchableOpacity
          style={[styles.tipeBtn, tipe && {
            borderColor: (stats?.data.find(s => s.tipe === tipe)?.warna ?? '#3b82f6') + '60',
          }]}
          onPress={() => setTipeOpen(true)}
        >
          <View style={[styles.tipeDot, {
            backgroundColor: tipe
              ? (stats?.data.find(s => s.tipe === tipe)?.warna ?? '#3b82f6')
              : '#3b82f6',
          }]} />
          <Text style={styles.tipeText} numberOfLines={1}>
            {tipe
              ? (stats?.data.find(s => s.tipe === tipe)?.label ?? 'Kategori')
              : `Semua (${totalAll})`}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#8a94a6" />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari aktivitas..."
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
        data={groups}
        keyExtractor={(item) => item[0]}
        renderItem={({ item }) => {
          const [key, list] = item;
          return (
            <View style={styles.group}>
              <Text style={styles.groupHeader}>{formatGroupHeader(key)}</Text>
              {list.map((a) => {
                const navTarget = getNavTarget(a);
                return (
                  <AktivitasItem
                    key={a.id} a={a}
                    onPress={navTarget ? () => handleTap(a) : undefined}
                  />
                );
              })}
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
            <Text style={styles.empty}>
              {search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada aktivitas tercatat.'}
            </Text>
          </View>
        }
      />

      <PickerSheet
        visible={tipeOpen}
        onClose={() => setTipeOpen(false)}
        title="Filter Kategori"
        searchable
        searchPlaceholder="Cari kategori..."
        selectedId={tipe}
        options={[
          { id: null, label: `Semua (${totalAll})`, sublabel: 'Tampilkan semua kategori' } as PickerOption,
          ...(stats?.data.filter(s => s.count > 0).map<PickerOption>((s) => ({
            id: s.tipe,
            label: `${s.label} (${s.count})`,
          })) ?? []),
        ]}
        onPick={(opt) => setTipe(opt.id as string | null)}
      />
    </SafeAreaView>
  );
}

function AktivitasItem({ a, onPress }: { a: Aktivitas; onPress?: () => void }) {
  const iconName = TIPE_ICON[a.tipe] ?? 'pulse';

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} disabled={!onPress} style={styles.item}>
      <View style={[styles.iconWrap, { backgroundColor: a.warna + '22' }]}>
        <Ionicons name={iconName} size={16} color={a.warna} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{a.label_tipe}</Text>
        <Text style={styles.itemJudul} numberOfLines={2}>{a.judul}</Text>
        <Text style={styles.itemTime}>{formatTime(a.created_at)}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color="#6b7280" />}
    </TouchableOpacity>
  );
}

function useInfiniteAktivitas(tipe: string | null, search: string) {
  return useInfiniteQuery({
    queryKey: ['aktivitas', tipe, search],
    queryFn: ({ pageParam }) =>
      aktivitasApi.list({
        tipe:   tipe ?? undefined,
        search: search.trim() || undefined,
        page:   pageParam as number,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const cur = lastPage.meta.current_page;
      const max = lastPage.meta.last_page;
      return cur < max ? cur + 1 : undefined;
    },
    // Cegah keyboard dismiss saat search query ganti — keep data lama
    // sambil fetch yg baru, tidak unmount loading screen.
    placeholderData: keepPreviousData,
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

  toolsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginTop: 8, marginBottom: 8,
  },
  tipeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    minWidth: 130,
  },
  tipeDot:  { width: 8, height: 8, borderRadius: 4 },
  tipeText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 0 },

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
