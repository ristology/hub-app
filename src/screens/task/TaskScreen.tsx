import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet, Alert,
  TouchableOpacity, TouchableWithoutFeedback, TextInput, Keyboard, Platform,
  Dimensions, ScrollView, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { tugasApi, type Tugas, type TugasStatus, type TugasPrioritas } from '../../api/tugas';
import type { KaryawanRingkas } from '../../api/feed';
import TaskCard from './components/TaskCard';
import SwipeableCard, { type SwipeAction } from '../../components/SwipeableCard';
import KaryawanPicker from '../../components/KaryawanPicker';
import PickerSheet, { type PickerOption } from '../../components/PickerSheet';
import { useAuth } from '../../store/auth';

type TaskStackParamList = {
  TaskList: undefined;
  TaskDetail: { id: number };
  CreateTask: undefined;
};

const STATUS_OPTIONS: PickerOption[] = [
  { id: null,      label: 'Semua status' },
  { id: 'belum',   label: 'Belum' },
  { id: 'proses',  label: 'Proses' },
  { id: 'selesai', label: 'Selesai' },
];

const PRIORITAS_OPTIONS: PickerOption[] = [
  { id: null,     label: 'Semua prioritas' },
  { id: 'tinggi', label: 'Tinggi' },
  { id: 'sedang', label: 'Sedang' },
  { id: 'rendah', label: 'Rendah' },
];

type Filters = {
  search?:      string;
  status?:      TugasStatus | null;
  prioritas?:   TugasPrioritas | null;
  karyawan_id?: number | null;
};

function countActive(f: Filters): number {
  let n = 0;
  if (f.search?.trim()) n++;
  if (f.status)         n++;
  if (f.prioritas)      n++;
  if (f.karyawan_id)    n++;
  return n;
}

export default function TaskScreen() {
  const navigation  = useNavigation<NativeStackNavigationProp<TaskStackParamList>>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdminHr = user?.role === 'admin' || user?.role === 'hr';
  const [refreshing, setRefreshing] = useState(false);

  const [filters, setFilters]           = useState<Filters>({});
  const [filterOpen, setFilterOpen]     = useState(false);
  const [draft, setDraft]               = useState<Filters>({});
  const [karyawanNama, setKaryawanNama] = useState('');
  const [pickerOpen, setPickerOpen]     = useState<'status' | 'prioritas' | 'karyawan' | null>(null);

  const openFilterSheet = () => { setDraft(filters); setFilterOpen(true); };

  const handlePickStatus    = (opt: PickerOption) => { setDraft((d) => ({ ...d, status:     opt.id as TugasStatus | null })); setPickerOpen(null); };
  const handlePickPrioritas = (opt: PickerOption) => { setDraft((d) => ({ ...d, prioritas:  opt.id as TugasPrioritas | null })); setPickerOpen(null); };
  const handlePickKaryawan  = (k: KaryawanRingkas) => { setDraft((d) => ({ ...d, karyawan_id: k.id })); setKaryawanNama(k.nama); setPickerOpen(null); };

  const apiParams = useMemo(() => ({
    ...(filters.status      && { status:     filters.status }),
    ...(filters.prioritas   && { prioritas:  filters.prioritas }),
    ...(filters.karyawan_id && { karyawan_id: filters.karyawan_id }),
    ...(filters.search?.trim() && { search: filters.search.trim() }),
  }), [filters]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tugas', apiParams],
    queryFn:  () => tugasApi.list(apiParams),
    placeholderData: keepPreviousData,
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

  const activeCount = countActive(filters);
  const statusLabel    = STATUS_OPTIONS.find((o) => o.id === filters.status)?.label;
  const prioritasLabel = PRIORITAS_OPTIONS.find((o) => o.id === filters.prioritas)?.label;

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Task</Text>
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
          {filters.status      && <Chip label={statusLabel ?? filters.status}    onClear={() => setFilters({ ...filters, status: null })} />}
          {filters.prioritas   && <Chip label={prioritasLabel ?? filters.prioritas} onClear={() => setFilters({ ...filters, prioritas: null })} />}
          {filters.karyawan_id && <Chip label={karyawanNama ? `Assignee: ${karyawanNama}` : 'Assignee ✓'} onClear={() => { setFilters({ ...filters, karyawan_id: null }); setKaryawanNama(''); }} />}
          <TouchableOpacity onPress={() => { setFilters({}); setKaryawanNama(''); }} style={styles.clearAll}>
            <Text style={styles.clearAllText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {stats && activeCount === 0 && (
        <View style={styles.statsRow}>
          <StatBox label="Belum"   value={stats.belum}   color="#6b7280" />
          <StatBox label="Proses"  value={stats.proses}  color="#3b82f6" />
          <StatBox label="Selesai" value={stats.selesai} color="#22c55e" />
        </View>
      )}

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const action: SwipeAction | undefined = item.status !== 'selesai' ? {
            icon: 'checkmark-done', label: 'Selesai', color: '#22c55e', onPress: () => handleComplete(item),
          } : undefined;
          return (
            <SwipeableCard rightAction={action}>
              <TaskCard task={item} onPress={() => navigation.navigate('TaskDetail', { id: item.id })} />
            </SwipeableCard>
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="checkbox-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>{activeCount > 0 ? 'Tidak ada hasil dengan filter ini.' : 'Belum ada task.'}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateTask')} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <FilterSheet
        visible={filterOpen}
        draft={draft}
        karyawanNama={karyawanNama}
        showAssignee={isAdminHr}
        statusLabel={STATUS_OPTIONS.find((o) => o.id === draft.status)?.label}
        prioritasLabel={PRIORITAS_OPTIONS.find((o) => o.id === draft.prioritas)?.label}
        onDraftChange={setDraft}
        onClearKaryawan={() => { setDraft((d) => ({ ...d, karyawan_id: null })); setKaryawanNama(''); }}
        onOpenStatus={() => setPickerOpen('status')}
        onOpenPrioritas={() => setPickerOpen('prioritas')}
        onOpenKaryawan={() => setPickerOpen('karyawan')}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => { setFilters(f); setFilterOpen(false); }}
        onReset={() => { setDraft({}); setKaryawanNama(''); }}
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
        visible={pickerOpen === 'prioritas'}
        title="Pilih Prioritas"
        options={PRIORITAS_OPTIONS}
        selectedId={draft.prioritas ?? null}
        onPick={handlePickPrioritas}
        onClose={() => setPickerOpen(null)}
      />
      <KaryawanPicker
        visible={pickerOpen === 'karyawan'}
        mode="single"
        title="Pilih Penanggung Jawab"
        searchFn={tugasApi.searchKaryawan}
        onPick={handlePickKaryawan}
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
  showAssignee: boolean;
  statusLabel?: string;
  prioritasLabel?: string;
  onDraftChange: (d: Filters) => void;
  onClearKaryawan: () => void;
  onOpenStatus: () => void;
  onOpenPrioritas: () => void;
  onOpenKaryawan: () => void;
  onClose: () => void;
  onApply: (f: Filters) => void;
  onReset: () => void;
};

function FilterSheet({
  visible, draft, karyawanNama, showAssignee, statusLabel, prioritasLabel,
  onDraftChange, onClearKaryawan,
  onOpenStatus, onOpenPrioritas, onOpenKaryawan,
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
    : Math.min(540, availableH);

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
          <Text style={fsStyles.title}>Filter Task</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={fsStyles.label}>Cari teks</Text>
          <View style={fsStyles.searchBox}>
            <Ionicons name="search" size={16} color="#6b7280" />
            <TextInput
              style={fsStyles.searchInput}
              placeholder="Kata kunci judul / deskripsi..."
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
            onClear={draft.status ? () => onDraftChange({ ...draft, status: null }) : undefined}
          />

          <Text style={fsStyles.label}>Prioritas</Text>
          <Field value={prioritasLabel ?? 'Semua prioritas'} empty={!draft.prioritas}
            onPress={onOpenPrioritas}
            onClear={draft.prioritas ? () => onDraftChange({ ...draft, prioritas: null }) : undefined}
          />

          {showAssignee && (
            <>
              <Text style={fsStyles.label}>Ditugaskan ke (assignee)</Text>
              <Field value={draft.karyawan_id ? (karyawanNama || 'Karyawan terpilih') : 'Semua karyawan'}
                empty={!draft.karyawan_id}
                onPress={onOpenKaryawan}
                onClear={draft.karyawan_id ? onClearKaryawan : undefined}
              />
            </>
          )}

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
    maxWidth: 220,
  },
  chipText:    { color: '#3b82f6', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  clearAll:    { paddingHorizontal: 8, paddingVertical: 4 },
  clearAllText:{ color: '#ef4444', fontSize: 11, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 11, marginTop: 2 },

  list: { padding: 16, paddingTop: 4 },
  empty: { color: '#8a94a6', fontSize: 14 },
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
