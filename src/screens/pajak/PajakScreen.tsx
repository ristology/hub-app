import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { pajakApi, type Pajak, type PajakStatusFilter } from '../../api/pajak';
import KlienSearchBar, { type KlienRingkas } from '../../components/KlienSearchBar';
import SwipeableCard from '../../components/SwipeableCard';
import PajakCard from './components/PajakCard';

type ParamList = {
  PajakList: undefined;
  PajakDetail: { id: number };
};

type Filter = 'semua' | PajakStatusFilter;

const FILTER_OPTIONS: { key: Filter; label: string; color: string }[] = [
  { key: 'semua',     label: 'Semua',       color: '#3b82f6' },
  { key: 'belum',     label: 'Belum Setor', color: '#f59e0b' },
  { key: 'terlambat', label: 'Terlambat',   color: '#ef4444' },
  { key: 'paid',      label: 'Lunas',       color: '#22c55e' },
];

function formatRupiahCompact(n: number): string {
  if (n >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1) + 'M';
  if (n >= 1_000_000)     return 'Rp ' + (n / 1_000_000).toFixed(1) + 'jt';
  if (n >= 1_000)         return 'Rp ' + (n / 1_000).toFixed(0) + 'rb';
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function PajakScreen() {
  const navigation  = useNavigation<NativeStackNavigationProp<ParamList>>();
  const queryClient = useQueryClient();
  const insets      = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');
  const [klien, setKlien]   = useState<KlienRingkas | null>(null);

  const listParams = useMemo(() => ({
    ...(filter === 'semua' ? {} : { status: filter as PajakStatusFilter }),
    ...(klien ? { klien_id: klien.id } : {}),
  }), [filter, klien]);

  const {
    data, isLoading, refetch, error,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['pajak', listParams],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => pajakApi.list({ ...listParams, page: pageParam as number }),
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta;
      if (!meta) return undefined;
      return meta.current_page < meta.last_page ? meta.current_page + 1 : undefined;
    },
  });

  const items     = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const totalItem = data?.pages[0]?.meta?.total ?? items.length;

  // Stat box mengikuti filter klien (bukan filter status) — supaya angkanya
  // tetap bermakna sebagai ringkasan periode, bukan duplikat jumlah daftar.
  const { data: stats } = useQuery({
    queryKey: ['pajak-stats', klien?.id ?? null],
    queryFn:  () => pajakApi.stats(klien ? { klien_id: klien.id } : {}),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const paidMut = useMutation({
    mutationFn: (id: number) => pajakApi.markPaid(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pajak'] });
      queryClient.invalidateQueries({ queryKey: ['pajak-stats'] });
    },
    onError: (e: any) => {
      Alert.alert('Error', e.response?.data?.message ?? 'Gagal menandai pajak lunas.');
    },
  });

  const konfirmasiLunas = (p: Pajak) => {
    Alert.alert(
      'Tandai Pajak Lunas',
      `Tandai PPN ${p.bulan_nama} ${p.tahun} untuk ${p.klien?.nama ?? 'klien ini'} sebagai sudah disetor?`,
      [
        { text: 'Batal' },
        { text: 'Tandai Lunas', onPress: () => paidMut.mutate(p.id) },
      ],
    );
  };

  const renderItem = ({ item }: { item: Pajak }) => {
    const card = (
      <PajakCard
        pajak={item}
        onPress={() => navigation.navigate('PajakDetail', { id: item.id })}
      />
    );
    if (item.status_bayar === 'paid') return card;
    return (
      <SwipeableCard
        cardMarginBottom={8}
        rightAction={{
          icon: 'checkmark-done',
          label: 'Lunas',
          color: '#16a34a',
          onPress: () => konfirmasiLunas(item),
        }}
      >
        {card}
      </SwipeableCard>
    );
  };

  const errStatus = (error as any)?.response?.status;
  if (errStatus === 403) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}><Text style={styles.topTitle}>Pajak / PPN</Text></View>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#3b3f4a" />
          <Text style={styles.empty}>Akses hanya untuk Admin, Direktur, dan Karyawan Keuangan.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}><Text style={styles.topTitle}>Pajak / PPN</Text></View>

      <KlienSearchBar
        selected={klien}
        onSelect={setKlien}
        fetcher={(q) => pajakApi.klienList(q)}
        placeholder="Cari nama klien..."
      />

      {stats && (
        <View style={styles.statsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
            <StatBox label="Total PPN"  value={formatRupiahCompact(stats.total_pajak)} sub={`${stats.jumlah} faktur`}      color="#f59e0b" />
            <StatBox label="Total DPP"  value={formatRupiahCompact(stats.total_dpp)}   sub="dasar pengenaan"               color="#3b82f6" />
            <StatBox label="Belum Setor" value={String(stats.count_belum + stats.count_terlambat)} sub={`${stats.count_terlambat} terlambat`} color="#ef4444" />
          </ScrollView>
        </View>
      )}

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setFilter(opt.key)}
              style={[styles.chip, filter === opt.key && { backgroundColor: opt.color + '30', borderColor: opt.color }]}
            >
              <Text style={[styles.chipText, filter === opt.key && { color: opt.color, fontWeight: '700' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          items.length === 0 ? null : (
            <View style={styles.footer}>
              {isFetchingNextPage ? (
                <ActivityIndicator color="#3b82f6" />
              ) : (
                <Text style={styles.footerText}>
                  {hasNextPage
                    ? `Menampilkan ${items.length} dari ${totalItem} catatan`
                    : `${totalItem} catatan — semua sudah dimuat`}
                </Text>
              )}
            </View>
          )
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>
              {klien ? `Tidak ada catatan pajak untuk ${klien.nama}.` : 'Belum ada catatan pajak.'}
            </Text>
            <Text style={styles.emptyHint}>
              Pajak otomatis tercatat saat invoice diterbitkan dengan PPN lebih dari nol.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StatBox({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <View style={[styles.statBox, { borderColor: color + '40' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statCount}>{sub}</Text>
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
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },

  statsWrap: { marginTop: 10, marginBottom: 6 },
  statsContent: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 4 },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, minWidth: 140,
  },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { color: '#fff', fontSize: 11, marginTop: 2, fontWeight: '500' },
  statCount: { color: '#8a94a6', fontSize: 10, marginTop: 2 },

  filtersWrap: { marginBottom: 8 },
  filtersContent: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 4, alignItems: 'center' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipText: { color: '#c5cdd9', fontSize: 12 },

  list:      { padding: 16, paddingTop: 4 },
  empty:     { color: '#8a94a6', fontSize: 14, textAlign: 'center' },
  emptyHint: { color: '#6b7280', fontSize: 11, textAlign: 'center' },

  footer:     { paddingVertical: 16, alignItems: 'center' },
  footerText: { color: '#6b7280', fontSize: 11 },
});
