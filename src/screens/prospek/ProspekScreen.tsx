import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, TouchableWithoutFeedback, TextInput, Keyboard, Platform,
  Dimensions, ScrollView, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { prospekApi, type Prospek, type ProspekStatus } from '../../api/prospek';
import ProspekCard from './components/ProspekCard';
import PickerSheet, { type PickerOption } from '../../components/PickerSheet';

type ProspekStackParamList = {
  ProspekList: undefined;
  ProspekDetail: { id: number };
  CreateProspek: undefined;
};

const BULAN_INDO = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const STATUS_OPTIONS: PickerOption[] = [
  { id: null,        label: 'Semua status' },
  { id: 'prospek',   label: 'Prospek' },
  { id: 'follow_up', label: 'Follow Up' },
  { id: 'proposal',  label: 'Proposal' },
  { id: 'negosiasi', label: 'Negosiasi' },
  { id: 'trial',     label: 'Trial' },
  { id: 'kontrak',   label: 'Kontrak' },
  { id: 'batal',     label: 'Batal' },
];

type Filters = {
  search?: string;
  status?: ProspekStatus | null;
  kota?:   string | null;
  bulan?:  string;
};

function countActive(f: Filters): number {
  let n = 0;
  if (f.search?.trim()) n++;
  if (f.status)         n++;
  if (f.kota)           n++;
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

export default function ProspekScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProspekStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);

  const [filters, setFilters]       = useState<Filters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft]           = useState<Filters>({});
  const [pickerOpen, setPickerOpen] = useState<'status' | 'kota' | 'bulan' | null>(null);

  const openFilterSheet = () => { setDraft(filters); setFilterOpen(true); };

  const { data: kotaData } = useQuery({
    queryKey: ['prospek-kota'],
    queryFn:  prospekApi.kotaList,
    enabled:  filterOpen || pickerOpen === 'kota',
  });

  const kotaOptions: PickerOption[] = useMemo(() => {
    const list: PickerOption[] = [{ id: null, label: 'Semua kota' }];
    (kotaData?.data ?? []).forEach((k) => list.push({ id: k, label: k }));
    return list;
  }, [kotaData]);

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

  const handlePickStatus = (opt: PickerOption) => { setDraft((d) => ({ ...d, status: opt.id as ProspekStatus | null })); setPickerOpen(null); };
  const handlePickKota   = (opt: PickerOption) => { setDraft((d) => ({ ...d, kota:   opt.id == null ? null : String(opt.id) })); setPickerOpen(null); };
  const handlePickBulan  = (opt: PickerOption) => { setDraft((d) => ({ ...d, bulan:  opt.id == null ? undefined : String(opt.id) })); setPickerOpen(null); };

  const apiParams = useMemo(() => ({
    ...(filters.status    && { status: filters.status }),
    ...(filters.kota      && { kota:   filters.kota }),
    ...(filters.bulan     && { bulan:  filters.bulan }),
    ...(filters.search?.trim() && { search: filters.search.trim() }),
  }), [filters]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['prospek', apiParams],
    queryFn:  () => prospekApi.list(apiParams),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({ queryKey: ['prospek-stats'], queryFn: prospekApi.stats });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = ({ item }: { item: Prospek }) => (
    <ProspekCard prospek={item} onPress={() => navigation.navigate('ProspekDetail', { id: item.id })} />
  );

  const activeCount = countActive(filters);

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  const statusLabel = STATUS_OPTIONS.find((o) => o.id === filters.status)?.label;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Prospek</Text>
        <TouchableOpacity
          onPress={openFilterSheet}
          style={[styles.searchBtn, activeCount > 0 && styles.searchBtnActive]}
          hitSlop={8}
        >
          <Ionicons name="search" size={20} color={activeCount > 0 ? '#3b82f6' : '#fff'} />
          {activeCount > 0 && (
            <View style={styles.searchBadge}><Text style={styles.searchBadgeText}>{activeCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {activeCount > 0 && (
        <View style={styles.chipsRow}>
          {filters.search?.trim() && <Chip label={`"${filters.search.trim()}"`} onClear={() => setFilters({ ...filters, search: '' })} />}
          {filters.status && <Chip label={statusLabel ?? filters.status} onClear={() => setFilters({ ...filters, status: null })} />}
          {filters.kota   && <Chip label={filters.kota}                  onClear={() => setFilters({ ...filters, kota: null })} />}
          {filters.bulan  && <Chip label={formatBulan(filters.bulan)}    onClear={() => setFilters({ ...filters, bulan: undefined })} />}
          <TouchableOpacity onPress={() => setFilters({})} style={styles.clearAll}>
            <Text style={styles.clearAllText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {stats && activeCount === 0 && (
        <View style={styles.statsRow}>
          <StatBox label="Aktif"   value={stats.prospek + stats.follow_up + stats.proposal + stats.negosiasi + stats.trial} color="#3b82f6" />
          <StatBox label="Kontrak" value={stats.kontrak} color="#22c55e" />
          <StatBox label="Overdue" value={stats.overdue} color="#ef4444" />
          <StatBox label="Batal"   value={stats.batal}   color="#6b7280" />
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
            <Ionicons name="people-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>{activeCount > 0 ? 'Tidak ada hasil dengan filter ini.' : 'Belum ada prospek.'}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateProspek')} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <FilterSheet
        visible={filterOpen}
        draft={draft}
        statusLabel={STATUS_OPTIONS.find((o) => o.id === draft.status)?.label}
        bulanLabel={bulanOptions.find((o) => o.id === draft.bulan)?.label}
        onDraftChange={setDraft}
        onOpenStatus={() => setPickerOpen('status')}
        onOpenKota={() => setPickerOpen('kota')}
        onOpenBulan={() => setPickerOpen('bulan')}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => { setFilters(f); setFilterOpen(false); }}
        onReset={() => setDraft({})}
      />

      <PickerSheet
        visible={pickerOpen === 'status'}
        title="Pilih Status"
        options={STATUS_OPTIONS}
        selectedId={draft.status ?? null}
        onPick={handlePickStatus}
        onClose={() => setPickerOpen(null)}
      />
      <PickerSheet
        visible={pickerOpen === 'kota'}
        title="Pilih Kota"
        options={kotaOptions}
        selectedId={draft.kota ?? null}
        onPick={handlePickKota}
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
  statusLabel?: string;
  bulanLabel?: string;
  onDraftChange: (d: Filters) => void;
  onOpenStatus: () => void;
  onOpenKota: () => void;
  onOpenBulan: () => void;
  onClose: () => void;
  onApply: (f: Filters) => void;
  onReset: () => void;
};

function FilterSheet({
  visible, draft, statusLabel, bulanLabel,
  onDraftChange, onOpenStatus, onOpenKota, onOpenBulan,
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
    : Math.min(560, availableH);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, fsStyles.backdrop, { opacity: backdropO }]} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[
          fsStyles.sheet,
          { height: sheetH, paddingBottom: kbHeight > 0 ? 12 : insets.bottom + 12,
            transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={fsStyles.handle} />
        <View style={fsStyles.titleRow}>
          <Text style={fsStyles.title}>Filter Prospek</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={fsStyles.label}>Cari teks</Text>
          <View style={fsStyles.searchBox}>
            <Ionicons name="search" size={16} color="#6b7280" />
            <TextInput
              style={fsStyles.searchInput}
              placeholder="Nama klien / kontak / kota..."
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

          <Text style={fsStyles.label}>Status</Text>
          <Field value={statusLabel ?? 'Semua status'} empty={!draft.status}
            onPress={onOpenStatus}
            onClear={draft.status ? () => onDraftChange({ ...draft, status: null }) : undefined} />

          <Text style={fsStyles.label}>Kota</Text>
          <Field value={draft.kota ?? 'Semua kota'} empty={!draft.kota}
            onPress={onOpenKota}
            onClear={draft.kota ? () => onDraftChange({ ...draft, kota: null }) : undefined} />

          <Text style={fsStyles.label}>Bulan pertemuan terakhir</Text>
          <Field value={bulanLabel ?? 'Semua bulan'} empty={!draft.bulan}
            onPress={onOpenBulan}
            onClear={draft.bulan ? () => onDraftChange({ ...draft, bulan: undefined }) : undefined} />

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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
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
  clearBtn: { padding: 4 },
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
