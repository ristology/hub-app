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

import { cashbackApi, type Cashback, type CashbackStatus, type MetodeBayar } from '../../api/cashback';
import KlienSearchBar, { type KlienRingkas } from '../../components/KlienSearchBar';
import SwipeableCard from '../../components/SwipeableCard';
import CashbackCard from './components/CashbackCard';
import TandaiPaidSheet, { type BuktiFile } from './components/TandaiPaidSheet';

type ParamList = {
  CashbackList: undefined;
  CashbackDetail: { id: number };
};

type Filter = 'semua' | CashbackStatus;

const FILTER_OPTIONS: { key: Filter; label: string; color: string }[] = [
  { key: 'semua',  label: 'Semua',  color: '#3b82f6' },
  { key: 'unpaid', label: 'Unpaid', color: '#f59e0b' },
  { key: 'paid',   label: 'Paid',   color: '#22c55e' },
];

function formatRupiahCompact(n: number): string {
  if (n >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1) + 'M';
  if (n >= 1_000_000)     return 'Rp ' + (n / 1_000_000).toFixed(1) + 'jt';
  if (n >= 1_000)         return 'Rp ' + (n / 1_000).toFixed(0) + 'rb';
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function CashbackScreen() {
  const navigation  = useNavigation<NativeStackNavigationProp<ParamList>>();
  const queryClient = useQueryClient();
  const insets      = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');
  const [klien, setKlien]   = useState<KlienRingkas | null>(null);
  const [paidTarget, setPaidTarget] = useState<Cashback | null>(null);

  const listParams = useMemo(() => ({
    ...(filter === 'semua' ? {} : { status: filter as CashbackStatus }),
    ...(klien ? { klien_id: klien.id } : {}),
  }), [filter, klien]);

  const {
    data, isLoading, refetch, error,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['cashback', listParams],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => cashbackApi.list({ ...listParams, page: pageParam as number }),
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta;
      if (!meta) return undefined;
      return meta.current_page < meta.last_page ? meta.current_page + 1 : undefined;
    },
  });

  const items     = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const totalItem = data?.pages[0]?.meta?.total ?? items.length;

  const { data: stats } = useQuery({
    queryKey: ['cashback-stats', klien?.id ?? null],
    queryFn:  () => cashbackApi.stats(klien ? { klien_id: klien.id } : {}),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const paidMut = useMutation({
    mutationFn: ({ id, metode, bukti }: { id: number; metode: MetodeBayar; bukti?: BuktiFile }) =>
      cashbackApi.markPaid(id, metode, bukti),
    onSuccess: () => setPaidTarget(null),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback'] });
      queryClient.invalidateQueries({ queryKey: ['cashback-stats'] });
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join('\n')
        ?? 'Gagal menandai cashback Paid.';
      Alert.alert('Error', msg);
    },
  });

  const renderItem = ({ item }: { item: Cashback }) => {
    const card = (
      <CashbackCard
        cashback={item}
        onPress={() => navigation.navigate('CashbackDetail', { id: item.id })}
      />
    );
    if (item.status_bayar === 'paid') return card;
    return (
      <SwipeableCard
        cardMarginBottom={8}
        rightAction={{
          icon: 'checkmark-done',
          label: 'Paid',
          color: '#16a34a',
          onPress: () => setPaidTarget(item),
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
        <View style={styles.topBar}><Text style={styles.topTitle}>Cashback</Text></View>
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
      <View style={styles.topBar}><Text style={styles.topTitle}>Cashback</Text></View>

      <KlienSearchBar
        selected={klien}
        onSelect={setKlien}
        fetcher={(q) => cashbackApi.klienList(q)}
        placeholder="Cari nama klien..."
      />

      {stats && (
        <View style={styles.statsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
            <StatBox label="Total Cashback" value={formatRupiahCompact(stats.total_nominal)} sub={`${stats.jumlah} catatan`}     color="#22c55e" />
            <StatBox label="Sudah Dibayar"  value={formatRupiahCompact(stats.total_paid)}    sub={`${stats.count_paid} catatan`}  color="#3b82f6" />
            <StatBox label="Belum Dibayar"  value={formatRupiahCompact(stats.total_unpaid)}  sub={`${stats.count_unpaid} catatan`} color="#f59e0b" />
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
            <Ionicons name="gift-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>
              {klien ? `Tidak ada cashback untuk ${klien.nama}.` : 'Belum ada catatan cashback.'}
            </Text>
            <Text style={styles.emptyHint}>
              Cashback otomatis tercatat saat invoice dengan nominal cashback ditandai lunas.
            </Text>
          </View>
        }
      />

      <TandaiPaidSheet
        visible={!!paidTarget}
        judul={paidTarget?.klien?.nama ?? ''}
        nominal={paidTarget ? 'Rp ' + paidTarget.nominal.toLocaleString('id-ID') : ''}
        submitting={paidMut.isPending}
        onClose={() => setPaidTarget(null)}
        onSubmit={({ metode, bukti }) => {
          if (!paidTarget) return;
          paidMut.mutate({ id: paidTarget.id, metode, bukti });
        }}
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
