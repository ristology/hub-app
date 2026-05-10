import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet, Alert,
  TouchableOpacity, TouchableWithoutFeedback, TextInput, Keyboard, Platform,
  Dimensions, ScrollView, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { feedApi, type Feed, type FeedFilters, type KaryawanRingkas } from '../../api/feed';
import FeedCard from './components/FeedCard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import KaryawanPicker from '../../components/KaryawanPicker';
import PickerSheet, { type PickerOption } from '../../components/PickerSheet';
import DatePickerInput from '../../components/DatePickerInput';
import HamburgerButton from '../../components/HamburgerButton';

type FeedStackParamList = {
  FeedList: undefined;
  FeedDetail: { id: number };
  CreateFeed: undefined;
};

const BULAN_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function countActiveFilters(f: FeedFilters): number {
  let n = 0;
  if (f.search?.trim()) n++;
  if (f.karyawan_id)    n++;
  if (f.kategori_id)    n++;
  if (f.tanggal)        n++;
  if (f.bulan)          n++;
  return n;
}

function formatBulan(s?: string): string {
  if (!s) return '';
  const [y, m] = s.split('-');
  const i = Number(m) - 1;
  if (i < 0 || i > 11) return s;
  return `${BULAN_INDO[i]} ${y}`;
}

function formatTanggal(s?: string): string {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function FeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FeedStackParamList>>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Applied filters (used for query)
  const [filters, setFilters] = useState<FeedFilters>({});

  // Filter sheet state — overlay (not Modal) so picker Modals stack cleanly on top
  const [filterOpen, setFilterOpen]     = useState(false);
  const [draft, setDraft]               = useState<FeedFilters>({});
  const [karyawanNama, setKaryawanNama] = useState('');
  const [pickerOpen, setPickerOpen]     = useState<'karyawan' | 'kategori' | 'bulan' | null>(null);

  const openFilterSheet = () => {
    setDraft(filters);
    setFilterOpen(true);
  };

  // Kategori list — fetched at this level so PickerSheet outside the sheet can use it
  const { data: kategoriData } = useQuery({
    queryKey: ['feed-kategori'],
    queryFn:  feedApi.kategori,
    enabled:  filterOpen || pickerOpen === 'kategori',
  });

  const kategoriOptions: PickerOption[] = useMemo(() => {
    const list: PickerOption[] = [{ id: null, label: 'Semua kategori' }];
    (kategoriData?.data ?? []).forEach((k) => list.push({ id: k.id, label: k.nama }));
    return list;
  }, [kategoriData]);

  // Bulan options — 24 bulan terakhir, format id = "YYYY-MM"
  const bulanOptions: PickerOption[] = useMemo(() => {
    const list: PickerOption[] = [{ id: null, label: 'Semua bulan' }];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const id = `${y}-${String(m + 1).padStart(2, '0')}`;
      list.push({ id, label: `${BULAN_INDO[m]} ${y}` });
    }
    return list;
  }, []);

  const handlePickKaryawan = (k: KaryawanRingkas) => {
    setDraft((d) => ({ ...d, karyawan_id: k.id }));
    setKaryawanNama(k.nama);
    setPickerOpen(null);
  };

  const handlePickKategori = (opt: PickerOption) => {
    setDraft((d) => ({ ...d, kategori_id: opt.id == null ? null : Number(opt.id) }));
    setPickerOpen(null);
  };

  const handlePickBulan = (opt: PickerOption) => {
    setDraft((d) => ({ ...d, bulan: opt.id == null ? undefined : String(opt.id) }));
    setPickerOpen(null);
  };

  const handleApply = (applied: FeedFilters) => {
    setFilters(applied);
    setFilterOpen(false);
  };

  const {
    data, isLoading, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed', filters],
    queryFn:  ({ pageParam }) => feedApi.list(pageParam as number, filters),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta;
      if (!meta) return undefined;
      return meta.current_page < meta.last_page ? meta.current_page + 1 : undefined;
    },
  });

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  const likeMutation = useMutation({
    mutationFn: (id: number) => feedApi.toggleLike(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
    onError:    (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal like.'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = ({ item }: { item: Feed }) => (
    <FeedCard
      feed={item}
      onPress={() => navigation.navigate('FeedDetail', { id: item.id })}
      onLike={() => likeMutation.mutate(item.id)}
    />
  );

  const activeCount = countActiveFilters(filters);

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
        <HamburgerButton style={{ marginLeft: -4 }} />
        <Text style={styles.title}>Feed</Text>
        <TouchableOpacity
          onPress={openFilterSheet}
          style={[styles.searchBtn, activeCount > 0 && styles.searchBtnActive]}
          hitSlop={8}
        >
          <Ionicons name="search" size={20} color={activeCount > 0 ? '#3b82f6' : '#fff'} />
          {activeCount > 0 && (
            <View style={styles.searchBadge}>
              <Text style={styles.searchBadgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeCount > 0 && (
        <View style={styles.filterChipsRow}>
          {filters.search?.trim() && (
            <FilterChip label={`"${filters.search.trim()}"`} onClear={() => setFilters({ ...filters, search: '' })} />
          )}
          {filters.karyawan_id && (
            <FilterChip label="Pencatat ✓" onClear={() => setFilters({ ...filters, karyawan_id: null })} />
          )}
          {filters.kategori_id && (
            <FilterChip label="Kategori ✓" onClear={() => setFilters({ ...filters, kategori_id: null })} />
          )}
          {filters.bulan && (
            <FilterChip label={formatBulan(filters.bulan)} onClear={() => setFilters({ ...filters, bulan: undefined })} />
          )}
          {filters.tanggal && (
            <FilterChip label={formatTanggal(filters.tanggal)} onClear={() => setFilters({ ...filters, tanggal: undefined })} />
          )}
          <TouchableOpacity onPress={() => setFilters({})} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color="#3b82f6" />
            </View>
          ) : !hasNextPage && items.length > 0 ? (
            <Text style={styles.footerEnd}>— Sudah sampai bawah —</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="newspaper-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>
              {activeCount > 0 ? 'Tidak ada feed yang cocok.' : 'Belum ada feed.'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateFeed')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Filter sheet — animated overlay (not a Modal) so pickers can stack on top */}
      <FeedFilterSheet
        visible={filterOpen}
        draft={draft}
        karyawanNama={karyawanNama}
        kategoriOptions={kategoriOptions}
        bulanOptions={bulanOptions}
        onDraftChange={setDraft}
        onClearKaryawan={() => { setDraft((d) => ({ ...d, karyawan_id: null })); setKaryawanNama(''); }}
        onOpenKaryawan={() => setPickerOpen('karyawan')}
        onOpenKategori={() => setPickerOpen('kategori')}
        onOpenBulan={() => setPickerOpen('bulan')}
        onClose={() => setFilterOpen(false)}
        onApply={handleApply}
        onReset={() => { setDraft({}); setKaryawanNama(''); }}
      />

      {/* Pickers (Modals) — render above the filter overlay since Modals are window-level on iOS/Android */}
      <KaryawanPicker
        visible={pickerOpen === 'karyawan'}
        mode="single"
        onClose={() => setPickerOpen(null)}
        onPick={handlePickKaryawan}
        title="Pilih Pencatat"
      />

      <PickerSheet
        visible={pickerOpen === 'kategori'}
        title="Pilih Kategori"
        options={kategoriOptions}
        selectedId={draft.kategori_id ?? null}
        onPick={handlePickKategori}
        onClose={() => setPickerOpen(null)}
        searchable
      />

      <PickerSheet
        visible={pickerOpen === 'bulan'}
        title="Pilih Bulan"
        options={bulanOptions}
        selectedId={draft.bulan ?? null}
        onPick={handlePickBulan}
        onClose={() => setPickerOpen(null)}
      />
    </SafeAreaView>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <View style={styles.filterChip}>
      <Text style={styles.filterChipText} numberOfLines={1}>{label}</Text>
      <TouchableOpacity onPress={onClear} hitSlop={6}>
        <Ionicons name="close-circle" size={14} color="#3b82f6" />
      </TouchableOpacity>
    </View>
  );
}

type FilterSheetProps = {
  visible: boolean;
  draft: FeedFilters;
  karyawanNama: string;
  kategoriOptions: PickerOption[];
  bulanOptions: PickerOption[];
  onDraftChange: (d: FeedFilters) => void;
  onClearKaryawan: () => void;
  onOpenKaryawan: () => void;
  onOpenKategori: () => void;
  onOpenBulan: () => void;
  onClose: () => void;
  onApply: (f: FeedFilters) => void;
  onReset: () => void;
};

function FeedFilterSheet({
  visible, draft, karyawanNama, kategoriOptions, bulanOptions,
  onDraftChange, onClearKaryawan, onOpenKaryawan, onOpenKategori, onOpenBulan,
  onClose, onApply, onReset,
}: FilterSheetProps) {
  const insets  = useSafeAreaInsets();
  const screenH = Dimensions.get('window').height;
  const [kbHeight, setKbHeight] = useState(0);
  const [mounted, setMounted]   = useState(visible);
  const slideY    = useRef(new Animated.Value(screenH)).current;
  const backdropO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Slide up on open / slide down on close — then unmount
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideY,    { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropO, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideY,    { toValue: screenH, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropO, { toValue: 0,       duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  // Android back button → treat as close while overlay is visible
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [mounted, onClose]);

  const ANDROID_IME_SAFETY = 60;
  const effectiveKb = kbHeight > 0
    ? kbHeight + (Platform.OS === 'android' ? ANDROID_IME_SAFETY : 0)
    : 0;
  const availableH     = screenH - insets.top - 40;
  const sheetH         = effectiveKb > 0
    ? Math.max(320, availableH - effectiveKb)
    : Math.min(640, availableH);
  const backdropPadBottom = effectiveKb;
  const sheetPadBottom    = kbHeight > 0 ? 12 : insets.bottom + 12;

  const selectedKategoriLabel = useMemo(() => {
    if (!draft.kategori_id) return 'Semua kategori';
    const k = kategoriOptions.find((o) => o.id === draft.kategori_id);
    return k?.label ?? '—';
  }, [draft.kategori_id, kategoriOptions]);

  const selectedBulanLabel = useMemo(() => {
    if (!draft.bulan) return 'Semua bulan';
    const b = bulanOptions.find((o) => o.id === draft.bulan);
    return b?.label ?? formatBulan(draft.bulan);
  }, [draft.bulan, bulanOptions]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.fsBackdrop, { opacity: backdropO, paddingBottom: backdropPadBottom }]} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[
          styles.fsSheetOverlay,
          { height: sheetH, paddingBottom: sheetPadBottom, transform: [{ translateY: slideY }] },
        ]}
      >
          <View style={styles.fsHandle} />
          <View style={styles.fsHeader}>
            <Text style={styles.fsTitle}>Filter Feed</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fsLabel}>Cari teks</Text>
            <View style={styles.fsSearchBox}>
              <Ionicons name="search" size={16} color="#6b7280" />
              <TextInput
                style={styles.fsSearchInput}
                placeholder="Kata kunci di postingan..."
                placeholderTextColor="#6b7280"
                value={draft.search ?? ''}
                onChangeText={(t) => onDraftChange({ ...draft, search: t })}
                autoCapitalize="none"
              />
              {draft.search ? (
                <TouchableOpacity onPress={() => onDraftChange({ ...draft, search: '' })} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color="#6b7280" />
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.fsLabel}>Pencatat</Text>
            <FieldButton
              value={draft.karyawan_id ? (karyawanNama || 'Karyawan terpilih') : 'Semua karyawan'}
              empty={!draft.karyawan_id}
              onPress={onOpenKaryawan}
              onClear={draft.karyawan_id ? onClearKaryawan : undefined}
            />

            <Text style={styles.fsLabel}>Kategori</Text>
            <FieldButton
              value={selectedKategoriLabel}
              empty={!draft.kategori_id}
              onPress={onOpenKategori}
              onClear={draft.kategori_id ? () => onDraftChange({ ...draft, kategori_id: null }) : undefined}
            />

            <Text style={styles.fsLabel}>Bulan</Text>
            <FieldButton
              value={selectedBulanLabel}
              empty={!draft.bulan}
              onPress={onOpenBulan}
              onClear={draft.bulan ? () => onDraftChange({ ...draft, bulan: undefined }) : undefined}
            />

            <Text style={styles.fsLabel}>Tanggal spesifik</Text>
            <View style={styles.fsRow}>
              <View style={{ flex: 1 }}>
                <DatePickerInput
                  value={draft.tanggal ?? null}
                  onChange={(v) => onDraftChange({ ...draft, tanggal: v })}
                  placeholder="Pilih tanggal..."
                />
              </View>
              {draft.tanggal && (
                <TouchableOpacity
                  onPress={() => onDraftChange({ ...draft, tanggal: undefined })}
                  style={styles.fsClearBtn}
                  hitSlop={6}
                >
                  <Ionicons name="close-circle" size={20} color="#8a94a6" />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 12 }} />
          </ScrollView>

          <View style={styles.fsActions}>
            <TouchableOpacity onPress={onReset} style={styles.fsResetBtn}>
              <Text style={styles.fsResetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onApply(draft)} style={styles.fsApplyBtn}>
              <Text style={styles.fsApplyText}>Terapkan</Text>
            </TouchableOpacity>
          </View>
      </Animated.View>
    </View>
  );
}

function FieldButton({ value, empty, onPress, onClear }: {
  value: string;
  empty?: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <View style={styles.fsRow}>
      <TouchableOpacity onPress={onPress} style={styles.fsField}>
        <Text style={[styles.fsFieldText, empty && { color: '#6b7280' }]} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color="#8a94a6" />
      </TouchableOpacity>
      {onClear && (
        <TouchableOpacity onPress={onClear} style={styles.fsClearBtn} hitSlop={6}>
          <Ionicons name="close-circle" size={20} color="#8a94a6" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  header:    {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8,
  },
  title:     { color: '#fff', fontSize: 24, fontWeight: '700', flex: 1 },
  searchBtn: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  searchBtnActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3b82f6' },
  searchBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16,
    paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
  },
  searchBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  filterChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.30)', borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    maxWidth: 200,
  },
  filterChipText: { color: '#3b82f6', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  clearAllBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  clearAllText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },

  list:      { padding: 16, paddingTop: 4 },
  empty:     { color: '#8a94a6', fontSize: 14, textAlign: 'center' },
  footerLoading: { paddingVertical: 16 },
  footerEnd:     { color: '#6b7280', fontSize: 11, textAlign: 'center', paddingVertical: 16 },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },

  // Filter sheet
  fsBackdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  fsSheet: {
    backgroundColor: '#0d1421',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16,
  },
  fsSheetOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#0d1421',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16,
  },
  fsHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginTop: 8, marginBottom: 12,
  },
  fsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  fsTitle:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  fsLabel:  { color: '#8a94a6', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  fsSearchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  fsSearchInput: { flex: 1, color: '#fff', paddingVertical: 6, fontSize: 14 },
  fsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fsField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  fsFieldText:  { flex: 1, color: '#fff', fontSize: 14 },
  fsClearBtn:   { padding: 4 },
  fsHint:       { color: '#8a94a6', fontSize: 11, marginTop: 4, fontStyle: 'italic' },

  fsActions: {
    flexDirection: 'row', gap: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  fsResetBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  fsResetText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  fsApplyBtn: {
    flex: 2, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#3b82f6',
  },
  fsApplyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
