import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet, Alert,
  TouchableOpacity, TouchableWithoutFeedback, TextInput, Keyboard, Platform,
  Dimensions, ScrollView, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { errorLogApi, type ErrorLog, type ErrorLogStatus } from '../../api/errorLog';
import type { KaryawanRingkas } from '../../api/feed';
import ErrorLogCard from './components/ErrorLogCard';
import SwipeableCard, { type SwipeAction } from '../../components/SwipeableCard';
import KaryawanPicker from '../../components/KaryawanPicker';
import PickerSheet, { type PickerOption } from '../../components/PickerSheet';

type ErrorLogStackParamList = {
  ErrorLogList: undefined;
  ErrorLogDetail: { id: number };
  CreateErrorLog: undefined;
};

const BULAN_INDO = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const STATUS_OPTIONS: PickerOption[] = [
  { id: null,           label: 'Semua status' },
  { id: 'open',         label: 'Open' },
  { id: 'in_progress',  label: 'Proses' },
  { id: 'resolved',     label: 'Resolved' },
  { id: 'closed',       label: 'Closed' },
];

type Filters = {
  search?:     string;
  status?:     ErrorLogStatus | null;
  kategori?:   number | null;
  klien?:      number | null;
  handler_id?: number | null;
  bulan?:      string;
};

function countActive(f: Filters): number {
  let n = 0;
  if (f.search?.trim()) n++;
  if (f.status)         n++;
  if (f.kategori)       n++;
  if (f.klien)          n++;
  if (f.handler_id)     n++;
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

export default function ErrorLogScreen() {
  const navigation   = useNavigation<NativeStackNavigationProp<ErrorLogStackParamList>>();
  const queryClient  = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Applied filters
  const [filters, setFilters]   = useState<Filters>({});
  // Filter sheet state
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft]           = useState<Filters>({});
  const [karyawanNama, setKaryawanNama] = useState('');
  const [pickerOpen, setPickerOpen] = useState<'status' | 'kategori' | 'klien' | 'handler' | 'bulan' | null>(null);

  const openFilterSheet = () => {
    setDraft(filters);
    setFilterOpen(true);
  };

  // Fetch dropdown options when needed
  const { data: kategoriData } = useQuery({
    queryKey: ['error-log-kategori'],
    queryFn:  errorLogApi.kategori,
    enabled:  filterOpen || pickerOpen === 'kategori',
  });
  const { data: klienData } = useQuery({
    queryKey: ['error-log-klien'],
    queryFn:  errorLogApi.klien,
    enabled:  filterOpen || pickerOpen === 'klien',
  });

  const kategoriOptions: PickerOption[] = useMemo(() => {
    const list: PickerOption[] = [{ id: null, label: 'Semua kategori' }];
    (kategoriData?.data ?? []).forEach((k) => list.push({ id: k.id, label: k.nama }));
    return list;
  }, [kategoriData]);

  const klienOptions: PickerOption[] = useMemo(() => {
    const list: PickerOption[] = [{ id: null, label: 'Semua klien' }];
    (klienData?.data ?? []).forEach((k) => list.push({ id: k.id, label: k.nama }));
    return list;
  }, [klienData]);

  const bulanOptions: PickerOption[] = useMemo(() => {
    const list: PickerOption[] = [{ id: null, label: 'Semua bulan' }];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({ id, label: `${BULAN_INDO[d.getMonth()]} ${d.getFullYear()}` });
    }
    return list;
  }, []);

  const handlePickStatus   = (opt: PickerOption) => { setDraft((d) => ({ ...d, status:     (opt.id as ErrorLogStatus | null) })); setPickerOpen(null); };
  const handlePickKategori = (opt: PickerOption) => { setDraft((d) => ({ ...d, kategori:   opt.id == null ? null : Number(opt.id) })); setPickerOpen(null); };
  const handlePickKlien    = (opt: PickerOption) => { setDraft((d) => ({ ...d, klien:      opt.id == null ? null : Number(opt.id) })); setPickerOpen(null); };
  const handlePickHandler  = (k: KaryawanRingkas) => { setDraft((d) => ({ ...d, handler_id: k.id })); setKaryawanNama(k.nama); setPickerOpen(null); };
  const handlePickBulan    = (opt: PickerOption) => { setDraft((d) => ({ ...d, bulan:      opt.id == null ? undefined : String(opt.id) })); setPickerOpen(null); };

  const handleApply = (next: Filters) => { setFilters(next); setFilterOpen(false); };

  const apiParams = useMemo(() => ({
    ...(filters.status     && { status:     filters.status }),
    ...(filters.kategori   && { kategori:   filters.kategori }),
    ...(filters.klien      && { klien:      filters.klien }),
    ...(filters.handler_id && { handler_id: filters.handler_id }),
    ...(filters.bulan      && { bulan:      filters.bulan }),
    ...(filters.search?.trim() && { search: filters.search.trim() }),
  }), [filters]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['error-log', apiParams],
    queryFn:  () => errorLogApi.list(apiParams),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({ queryKey: ['error-log-stats'], queryFn: errorLogApi.stats });

  const resolveMut = useMutation({
    mutationFn: (id: number) => errorLogApi.updateStatus(id, 'resolved'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-log'] });
      queryClient.invalidateQueries({ queryKey: ['error-log-stats'] });
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal ubah status.'),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleResolve = (item: ErrorLog) => {
    Alert.alert('Tandai Resolved',
      `Tandai error "${item.keterangan.slice(0, 60)}${item.keterangan.length > 60 ? '...' : ''}" sebagai resolved?`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Resolved', style: 'default', onPress: () => resolveMut.mutate(item.id) },
      ],
    );
  };

  const renderItem = ({ item }: { item: ErrorLog }) => {
    const canResolve = item.can_update_status && item.status !== 'resolved';
    const action: SwipeAction | undefined = canResolve
      ? { icon: 'checkmark-done', label: 'Resolved', color: '#22c55e', onPress: () => handleResolve(item) }
      : undefined;
    return (
      <SwipeableCard rightAction={action}>
        <ErrorLogCard
          log={item}
          onPress={() => navigation.navigate('ErrorLogDetail', { id: item.id })}
        />
      </SwipeableCard>
    );
  };

  const activeCount = countActive(filters);

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  const statusLabel = STATUS_OPTIONS.find((o) => o.id === filters.status)?.label;
  const kategoriLabel = kategoriOptions.find((o) => o.id === filters.kategori)?.label;
  const klienLabel    = klienOptions.find((o) => o.id === filters.klien)?.label;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Error Log</Text>
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
        <View style={styles.chipsRow}>
          {filters.search?.trim() && (
            <Chip label={`"${filters.search.trim()}"`} onClear={() => setFilters({ ...filters, search: '' })} />
          )}
          {filters.status   && <Chip label={statusLabel ?? filters.status} onClear={() => setFilters({ ...filters, status: null })} />}
          {filters.kategori && <Chip label={kategoriLabel ?? 'Kategori ✓'} onClear={() => setFilters({ ...filters, kategori: null })} />}
          {filters.klien    && <Chip label={klienLabel ?? 'Klien ✓'} onClear={() => setFilters({ ...filters, klien: null })} />}
          {filters.handler_id && <Chip label="Handler ✓" onClear={() => setFilters({ ...filters, handler_id: null })} />}
          {filters.bulan    && <Chip label={formatBulan(filters.bulan)} onClear={() => setFilters({ ...filters, bulan: undefined })} />}
          <TouchableOpacity onPress={() => setFilters({})} style={styles.clearAll}>
            <Text style={styles.clearAllText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {stats && activeCount === 0 && (
        <View style={styles.statsRow}>
          <StatBox label="Open"     value={stats.open}        color="#ef4444" />
          <StatBox label="Proses"   value={stats.in_progress} color="#f59e0b" />
          <StatBox label="Resolved" value={stats.resolved}    color="#22c55e" />
          <StatBox label="Closed"   value={stats.closed}      color="#6b7280" />
        </View>
      )}

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="bug-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>
              {activeCount > 0 ? 'Tidak ada hasil dengan filter ini.' : 'Belum ada laporan error.'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateErrorLog')} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Filter sheet (Animated overlay, bukan Modal) */}
      <FilterSheet
        visible={filterOpen}
        draft={draft}
        karyawanNama={karyawanNama}
        statusLabel={STATUS_OPTIONS.find((o) => o.id === draft.status)?.label}
        kategoriLabel={kategoriOptions.find((o) => o.id === draft.kategori)?.label}
        klienLabel={klienOptions.find((o) => o.id === draft.klien)?.label}
        bulanLabel={bulanOptions.find((o) => o.id === draft.bulan)?.label}
        onDraftChange={setDraft}
        onClearHandler={() => { setDraft((d) => ({ ...d, handler_id: null })); setKaryawanNama(''); }}
        onOpenStatus={() => setPickerOpen('status')}
        onOpenKategori={() => setPickerOpen('kategori')}
        onOpenKlien={() => setPickerOpen('klien')}
        onOpenHandler={() => setPickerOpen('handler')}
        onOpenBulan={() => setPickerOpen('bulan')}
        onClose={() => setFilterOpen(false)}
        onApply={handleApply}
        onReset={() => { setDraft({}); setKaryawanNama(''); }}
      />

      {/* Pickers root level */}
      <PickerSheet
        visible={pickerOpen === 'status'}
        title="Pilih Status"
        options={STATUS_OPTIONS}
        selectedId={draft.status ?? null}
        onPick={handlePickStatus}
        onClose={() => setPickerOpen(null)}
      />
      <PickerSheet
        visible={pickerOpen === 'kategori'}
        title="Pilih Kategori Error"
        options={kategoriOptions}
        selectedId={draft.kategori ?? null}
        onPick={handlePickKategori}
        onClose={() => setPickerOpen(null)}
        searchable
      />
      <PickerSheet
        visible={pickerOpen === 'klien'}
        title="Pilih Klien"
        options={klienOptions}
        selectedId={draft.klien ?? null}
        onPick={handlePickKlien}
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
      <KaryawanPicker
        visible={pickerOpen === 'handler'}
        mode="single"
        title="Pilih Handler"
        onPick={handlePickHandler}
        onClose={() => setPickerOpen(null)}
      />
    </SafeAreaView>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
      <TouchableOpacity onPress={onClear} hitSlop={6}>
        <Ionicons name="close-circle" size={14} color="#3b82f6" />
      </TouchableOpacity>
    </View>
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

type FilterSheetProps = {
  visible: boolean;
  draft: Filters;
  karyawanNama: string;
  statusLabel?: string;
  kategoriLabel?: string;
  klienLabel?: string;
  bulanLabel?: string;
  onDraftChange: (d: Filters) => void;
  onClearHandler: () => void;
  onOpenStatus:   () => void;
  onOpenKategori: () => void;
  onOpenKlien:    () => void;
  onOpenHandler:  () => void;
  onOpenBulan:    () => void;
  onClose: () => void;
  onApply: (f: Filters) => void;
  onReset: () => void;
};

function FilterSheet({
  visible, draft, karyawanNama,
  statusLabel, kategoriLabel, klienLabel, bulanLabel,
  onDraftChange, onClearHandler,
  onOpenStatus, onOpenKategori, onOpenKlien, onOpenHandler, onOpenBulan,
  onClose, onApply, onReset,
}: FilterSheetProps) {
  const insets   = useSafeAreaInsets();
  const screenH  = Dimensions.get('window').height;
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

  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [mounted, onClose]);

  const ANDROID_IME_SAFETY = 60;
  const effectiveKb = kbHeight > 0
    ? kbHeight + (Platform.OS === 'android' ? ANDROID_IME_SAFETY : 0) : 0;
  const availableH  = screenH - insets.top - 40;
  const sheetH      = effectiveKb > 0
    ? Math.max(320, availableH - effectiveKb)
    : Math.min(640, availableH);
  // Clear tab bar (height 56 + safe-area inset) supaya tombol bawah tidak tertutup
  const tabBarH        = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);
  const sheetPadBottom = kbHeight > 0 ? 12 : tabBarH + 12;

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, fsStyles.backdrop, { opacity: backdropO }]} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[
          fsStyles.sheet,
          { height: sheetH, paddingBottom: sheetPadBottom, bottom: effectiveKb,
            transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={fsStyles.handle} />
        <View style={fsStyles.titleRow}>
          <Text style={fsStyles.title}>Filter Error Log</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <Label>Cari teks</Label>
          <View style={fsStyles.searchBox}>
            <Ionicons name="search" size={16} color="#6b7280" />
            <TextInput
              style={fsStyles.searchInput}
              placeholder="Kata kunci di keterangan / URL..."
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

          <Label>Status</Label>
          <Field value={statusLabel ?? 'Semua status'}     empty={!draft.status}     onPress={onOpenStatus}     onClear={draft.status ? () => onDraftChange({ ...draft, status: null }) : undefined} />

          <Label>Kategori</Label>
          <Field value={kategoriLabel ?? 'Semua kategori'} empty={!draft.kategori}  onPress={onOpenKategori}   onClear={draft.kategori ? () => onDraftChange({ ...draft, kategori: null }) : undefined} />

          <Label>Klien</Label>
          <Field value={klienLabel ?? 'Semua klien'}        empty={!draft.klien}     onPress={onOpenKlien}      onClear={draft.klien ? () => onDraftChange({ ...draft, klien: null }) : undefined} />

          <Label>Handler</Label>
          <Field
            value={draft.handler_id ? (karyawanNama || 'Karyawan terpilih') : 'Semua handler'}
            empty={!draft.handler_id}
            onPress={onOpenHandler}
            onClear={draft.handler_id ? onClearHandler : undefined}
          />

          <Label>Bulan</Label>
          <Field value={bulanLabel ?? 'Semua bulan'}        empty={!draft.bulan}     onPress={onOpenBulan}      onClear={draft.bulan ? () => onDraftChange({ ...draft, bulan: undefined }) : undefined} />

          <View style={{ height: 12 }} />
        </ScrollView>

        <View style={fsStyles.actions}>
          <TouchableOpacity onPress={onReset} style={fsStyles.resetBtn}>
            <Text style={fsStyles.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onApply(draft)} style={fsStyles.applyBtn}>
            <Text style={fsStyles.applyText}>Terapkan</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={fsStyles.label}>{children}</Text>;
}

function Field({ value, empty, onPress, onClear }: { value: string; empty?: boolean; onPress: () => void; onClear?: () => void }) {
  return (
    <View style={fsStyles.row}>
      <TouchableOpacity onPress={onPress} style={fsStyles.field}>
        <Text style={[fsStyles.fieldText, empty && { color: '#6b7280' }]} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color="#8a94a6" />
      </TouchableOpacity>
      {onClear && (
        <TouchableOpacity onPress={onClear} style={fsStyles.clearBtn} hitSlop={6}>
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

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.30)', borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    maxWidth: 200,
  },
  chipText:    { color: '#3b82f6', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  clearAll:    { paddingHorizontal: 8, paddingVertical: 4 },
  clearAllText:{ color: '#ef4444', fontSize: 11, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 11, marginTop: 4 },

  list:  { padding: 16, paddingTop: 4 },
  empty: { color: '#8a94a6', fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 20, bottom: Platform.OS === 'android' ? 120 : 110,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
});

const fsStyles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#0d1421',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginTop: 8, marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  label: { color: '#8a94a6', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 6, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  fieldText: { flex: 1, color: '#fff', fontSize: 14 },
  clearBtn:  { padding: 4 },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  resetBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  resetText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  applyBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, alignItems: 'center', backgroundColor: '#3b82f6' },
  applyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
