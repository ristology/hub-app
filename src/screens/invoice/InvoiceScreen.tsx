import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, ScrollView, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { invoiceApi, type Invoice, type StatusBayar } from '../../api/invoice';
import SwipeableInvoiceCard from './components/SwipeableInvoiceCard';

type ParamList = {
  InvoiceList: undefined;
  InvoiceDetail: { id: number };
};

type Filter = 'semua' | StatusBayar | 'terlambat';

const FILTER_OPTIONS: { key: Filter; label: string; color: string }[] = [
  { key: 'semua',       label: 'Semua',        color: '#3b82f6' },
  { key: 'belum_bayar', label: 'Belum Bayar',  color: '#f59e0b' },
  { key: 'lunas',       label: 'Lunas',        color: '#22c55e' },
];

function formatRupiahCompact(n: number): string {
  if (n >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1) + 'M';
  if (n >= 1_000_000)     return 'Rp ' + (n / 1_000_000).toFixed(1) + 'jt';
  if (n >= 1_000)         return 'Rp ' + (n / 1_000).toFixed(0) + 'rb';
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function InvoiceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamList>>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');
  const [openId, setOpenId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['invoice', filter],
    queryFn:  () => invoiceApi.list(
      filter === 'semua' ? {} : { status: filter as StatusBayar }
    ),
  });

  const { data: stats } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn:  () => invoiceApi.stats(),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const toggleMut = useMutation({
    mutationFn: ({ id, bukti }: { id: number; bukti?: { uri: string; name: string; type: string } }) =>
      invoiceApi.toggleLunas(id, bukti),
    onSettled: () => {
      setPendingId(null);
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join('\n')
        ?? 'Gagal update status bayar.';
      Alert.alert('Error', msg);
    },
  });

  const pickAndUpload = async (id: number, source: 'camera' | 'gallery') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Aplikasi butuh akses kamera/galeri.');
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPendingId(id);
    toggleMut.mutate({
      id,
      bukti: {
        uri:  asset.uri,
        name: asset.fileName ?? `bukti_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      },
    });
  };

  const handleToggleLunas = (inv: Invoice) => {
    setOpenId(null);
    if (inv.status_bayar === 'lunas') {
      Alert.alert('Reset ke Belum Bayar', `Reset status invoice ${inv.no_invoice}? Bukti transfer akan dihapus.`, [
        { text: 'Batal' },
        { text: 'Reset', style: 'destructive', onPress: () => {
            setPendingId(inv.id);
            toggleMut.mutate({ id: inv.id });
          },
        },
      ]);
    } else {
      Alert.alert('Tandai Lunas', `Upload bukti transfer untuk invoice ${inv.no_invoice}.`, [
        { text: 'Batal' },
        { text: 'Foto Kamera',  onPress: () => pickAndUpload(inv.id, 'camera') },
        { text: 'Pilih Galeri', onPress: () => pickAndUpload(inv.id, 'gallery') },
      ]);
    }
  };

  const handlePreview = (inv: Invoice) => {
    setOpenId(null);
    Linking.openURL(inv.view_url);
  };

  const renderItem = ({ item }: { item: Invoice }) => (
    <SwipeableInvoiceCard
      invoice={item}
      isOpen={openId === item.id}
      isPending={pendingId === item.id}
      onPress={() => navigation.navigate('InvoiceDetail', { id: item.id })}
      onSwipeOpen={() => setOpenId(item.id)}
      onSwipeClose={() => setOpenId(null)}
      onToggleLunas={() => handleToggleLunas(item)}
      onPreview={() => handlePreview(item)}
    />
  );

  // Forbidden case
  const errStatus = (error as any)?.response?.status;
  if (errStatus === 403) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Invoice</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#3b3f4a" />
          <Text style={styles.empty}>Akses hanya untuk Admin & Karyawan Keuangan.</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.topTitle}>Invoice</Text>
      </View>

      {stats && (
        <View style={styles.statsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContent}
          >
            <StatBox
              label="Lunas"
              value={formatRupiahCompact(stats.total_lunas)}
              count={stats.count_lunas}
              color="#22c55e"
            />
            <StatBox
              label="Belum Bayar"
              value={formatRupiahCompact(stats.total_belum)}
              count={stats.count_belum}
              color="#f59e0b"
            />
            <StatBox
              label={`Total ${stats.tahun}`}
              value={formatRupiahCompact(stats.total_all)}
              count={stats.count_lunas + stats.count_belum}
              color="#3b82f6"
            />
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
              style={[
                styles.chip,
                filter === opt.key && { backgroundColor: opt.color + '30', borderColor: opt.color },
              ]}
            >
              <Text style={[
                styles.chipText,
                filter === opt.key && { color: opt.color, fontWeight: '700' },
              ]}>{opt.label}</Text>
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
            <Ionicons name="receipt-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>Tidak ada invoice.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StatBox({ label, value, count, color }: {
  label: string; value: string; count: number; color: string;
}) {
  return (
    <View style={[styles.statBox, { borderColor: color + '40' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statCount}>{count} invoice</Text>
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
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1,
    minWidth: 140,
  },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { color: '#fff', fontSize: 11, marginTop: 2, fontWeight: '500' },
  statCount: { color: '#8a94a6', fontSize: 10, marginTop: 2 },

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
  chipText: { color: '#c5cdd9', fontSize: 12 },

  list:  { padding: 16, paddingTop: 4 },
  empty: { color: '#8a94a6', fontSize: 14 },
});
