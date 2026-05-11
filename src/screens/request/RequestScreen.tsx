import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet, Alert, Image,
  TouchableOpacity, TouchableWithoutFeedback, TextInput, Keyboard, Platform,
  Dimensions, ScrollView, Animated, BackHandler, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  requestApi,
  type ClientRequest, type RequestStatus, type PicRingkas, type KlienRingkas,
} from '../../api/clientRequest';
import RequestCard from './components/RequestCard';
import SwipeableCard, { type SwipeAction } from '../../components/SwipeableCard';
import PickerSheet, { type PickerOption } from '../../components/PickerSheet';
import DatePickerInput from '../../components/DatePickerInput';

type RequestStackParamList = {
  RequestList: undefined;
  RequestDetail: { id: number };
  CreateRequest: undefined;
};

const STATUS_OPTIONS: PickerOption[] = [
  { id: null,       label: 'Semua status' },
  { id: 'menunggu', label: 'Menunggu' },
  { id: 'diterima', label: 'Diterima' },
  { id: 'proses',   label: 'Proses' },
  { id: 'selesai',  label: 'Selesai' },
  { id: 'ditolak',  label: 'Ditolak' },
];

type Filters = {
  search?: string;
  status?: RequestStatus | null;
  klien?:  number | null;
  dari?:   string;
  sampai?: string;
};

function countActive(f: Filters): number {
  let n = 0;
  if (f.search?.trim()) n++;
  if (f.status)         n++;
  if (f.klien)          n++;
  if (f.dari)           n++;
  if (f.sampai)         n++;
  return n;
}

function formatTanggal(s?: string): string {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RequestScreen() {
  const navigation  = useNavigation<NativeStackNavigationProp<RequestStackParamList>>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const [filters, setFilters]       = useState<Filters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft]           = useState<Filters>({});
  const [klienNama, setKlienNama]   = useState('');
  const [klienPickerOpen, setKlienPickerOpen] = useState(false);
  const [pickerOpen, setPickerOpen]           = useState<'status' | null>(null);
  const [assignTarget, setAssignTarget]       = useState<ClientRequest | null>(null);

  const openFilterSheet = () => { setDraft(filters); setFilterOpen(true); };

  const handlePickStatus = (opt: PickerOption) => { setDraft((d) => ({ ...d, status: opt.id as RequestStatus | null })); setPickerOpen(null); };
  const handlePickKlien  = (k: KlienRingkas)   => { setDraft((d) => ({ ...d, klien: k.id })); setKlienNama(k.nama); setKlienPickerOpen(false); };

  const apiParams = useMemo(() => ({
    ...(filters.status && { status: filters.status }),
    ...(filters.klien  && { klien:  filters.klien }),
    ...(filters.dari   && { dari:   filters.dari }),
    ...(filters.sampai && { sampai: filters.sampai }),
    ...(filters.search?.trim() && { search: filters.search.trim() }),
  }), [filters]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['request', apiParams],
    queryFn:  () => requestApi.list(apiParams),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({ queryKey: ['request-stats'], queryFn: requestApi.stats });

  const terimaMut = useMutation({
    mutationFn: ({ id, picUserId }: { id: number; picUserId: number }) => requestApi.terima(id, picUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['request-stats'] });
      setAssignTarget(null);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal assign PIC.'),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = ({ item }: { item: ClientRequest }) => {
    const canAssign = item.is_it_or_admin && item.status === 'menunggu';
    const action: SwipeAction | undefined = canAssign
      ? { icon: 'person-add', label: 'Assign', color: '#3b82f6', onPress: () => setAssignTarget(item) }
      : undefined;
    return (
      <SwipeableCard rightAction={action}>
        <RequestCard request={item} onPress={() => navigation.navigate('RequestDetail', { id: item.id })} />
      </SwipeableCard>
    );
  };

  const activeCount = countActive(filters);
  const statusLabel = STATUS_OPTIONS.find((o) => o.id === filters.status)?.label;

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
        <Text style={styles.title}>Request</Text>
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
          {filters.klien  && <Chip label={klienNama ? `Klien: ${klienNama}` : 'Klien ✓'} onClear={() => { setFilters({ ...filters, klien: null }); setKlienNama(''); }} />}
          {filters.dari   && <Chip label={`Dari ${formatTanggal(filters.dari)}`} onClear={() => setFilters({ ...filters, dari: undefined })} />}
          {filters.sampai && <Chip label={`Sampai ${formatTanggal(filters.sampai)}`} onClear={() => setFilters({ ...filters, sampai: undefined })} />}
          <TouchableOpacity onPress={() => { setFilters({}); setKlienNama(''); }} style={styles.clearAll}>
            <Text style={styles.clearAllText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {stats && activeCount === 0 && (
        <View style={styles.statsRow}>
          <StatBox label="Menunggu" value={stats.menunggu} color="#8a94a6" />
          <StatBox label="Proses"   value={(stats.diterima ?? 0) + (stats.proses ?? 0)} color="#f59e0b" />
          <StatBox label="Selesai"  value={stats.selesai}  color="#22c55e" />
          <StatBox label="Overdue"  value={stats.overdue}  color="#ef4444" />
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
            <Ionicons name="mail-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>{activeCount > 0 ? 'Tidak ada hasil dengan filter ini.' : 'Belum ada request.'}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateRequest')} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <FilterSheet
        visible={filterOpen}
        draft={draft}
        klienNama={klienNama}
        statusLabel={STATUS_OPTIONS.find((o) => o.id === draft.status)?.label}
        onDraftChange={setDraft}
        onClearKlien={() => { setDraft((d) => ({ ...d, klien: null })); setKlienNama(''); }}
        onOpenStatus={() => setPickerOpen('status')}
        onOpenKlien={() => setKlienPickerOpen(true)}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => { setFilters(f); setFilterOpen(false); }}
        onReset={() => { setDraft({}); setKlienNama(''); }}
      />

      <PickerSheet
        visible={pickerOpen === 'status'}
        title="Pilih Status"
        options={STATUS_OPTIONS}
        selectedId={draft.status ?? null}
        onPick={handlePickStatus}
        onClose={() => setPickerOpen(null)}
      />

      <KlienPicker
        visible={klienPickerOpen}
        onClose={() => setKlienPickerOpen(false)}
        onPick={handlePickKlien}
      />

      <AssignPicModal
        visible={!!assignTarget}
        target={assignTarget}
        loading={terimaMut.isPending}
        onClose={() => setAssignTarget(null)}
        onSubmit={(picUserId) => assignTarget && terimaMut.mutate({ id: assignTarget.id, picUserId })}
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
  klienNama: string;
  statusLabel?: string;
  onDraftChange: (d: Filters) => void;
  onClearKlien: () => void;
  onOpenStatus: () => void;
  onOpenKlien: () => void;
  onClose: () => void;
  onApply: (f: Filters) => void;
  onReset: () => void;
};

function FilterSheet({
  visible, draft, klienNama, statusLabel,
  onDraftChange, onClearKlien, onOpenStatus, onOpenKlien,
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
    : Math.min(620, availableH);

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
          <Text style={fsStyles.title}>Filter Request</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={fsStyles.label}>Cari teks</Text>
          <View style={fsStyles.searchBox}>
            <Ionicons name="search" size={16} color="#6b7280" />
            <TextInput
              style={fsStyles.searchInput}
              placeholder="Nama klien / keterangan..."
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

          <Text style={fsStyles.label}>Klien</Text>
          <Field value={draft.klien ? (klienNama || 'Klien terpilih') : 'Semua klien'}
            empty={!draft.klien}
            onPress={onOpenKlien}
            onClear={draft.klien ? onClearKlien : undefined} />

          <Text style={fsStyles.label}>Tanggal request — Dari</Text>
          <View style={fsStyles.row}>
            <View style={{ flex: 1 }}>
              <DatePickerInput
                value={draft.dari ?? null}
                onChange={(v) => onDraftChange({ ...draft, dari: v })}
                placeholder="Pilih tanggal awal..."
              />
            </View>
            {draft.dari && (
              <TouchableOpacity onPress={() => onDraftChange({ ...draft, dari: undefined })} style={fsStyles.clearBtn} hitSlop={6}>
                <Ionicons name="close-circle" size={20} color="#8a94a6" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={fsStyles.label}>Tanggal request — Sampai</Text>
          <View style={fsStyles.row}>
            <View style={{ flex: 1 }}>
              <DatePickerInput
                value={draft.sampai ?? null}
                onChange={(v) => onDraftChange({ ...draft, sampai: v })}
                placeholder="Pilih tanggal akhir..."
              />
            </View>
            {draft.sampai && (
              <TouchableOpacity onPress={() => onDraftChange({ ...draft, sampai: undefined })} style={fsStyles.clearBtn} hitSlop={6}>
                <Ionicons name="close-circle" size={20} color="#8a94a6" />
              </TouchableOpacity>
            )}
          </View>

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

/** Klien picker dengan search autocomplete via API. Pakai Modal biasa karena
 *  filter sheet sudah Animated overlay (bukan Modal), jadi Modal di sini stack OK.
 *  Keyboard handling pakai manual listener — KeyboardAvoidingView TIDAK reliable
 *  untuk Modal di Android edge-to-edge (lihat memori keyboard pattern). */
function KlienPicker({ visible, onClose, onPick }: {
  visible: boolean;
  onClose: () => void;
  onPick: (k: KlienRingkas) => void;
}) {
  const insets   = useSafeAreaInsets();
  const screenH  = Dimensions.get('window').height;
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState<KlienRingkas[]>([]);
  const [loading, setLoading] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  // Manual keyboard listener — supaya sheet naik saat keyboard muncul
  useEffect(() => {
    if (!visible) { setKbHeight(0); return; }
    const showName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showName, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideName, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await requestApi.searchKlien(search);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, visible]);

  useEffect(() => { if (visible) setSearch(''); }, [visible]);

  // Push sheet ke atas keyboard. Plus constrain height supaya tidak overflow ke
  // area atas saat di-push naik. ANDROID_IME_SAFETY = ekstra 60px untuk
  // toolbar IME Samsung Honeyboard yg tidak ikut kbHeight.
  const ANDROID_IME_SAFETY = 60;
  const effectiveKb = kbHeight > 0
    ? kbHeight + (Platform.OS === 'android' ? ANDROID_IME_SAFETY : 0)
    : 0;
  const availableH = screenH - insets.top - 40;
  const sheetH = effectiveKb > 0
    ? Math.max(280, availableH - effectiveKb)
    : Math.min(600, availableH);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[picStyles.backdrop, { paddingBottom: effectiveKb }]}>
        <View style={[picStyles.sheet, { height: sheetH, paddingBottom: kbHeight > 0 ? 12 : insets.bottom + 12 }]}>
          <View style={picStyles.handle} />
          <View style={picStyles.header}>
            <Text style={picStyles.title}>Pilih Klien</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={picStyles.searchBox}>
            <Ionicons name="search" size={18} color="#6b7280" />
            <TextInput
              style={picStyles.searchInput}
              placeholder="Cari nama klien..."
              placeholderTextColor="#6b7280"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="words"
            />
          </View>
          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => onPick(item)} style={picStyles.item}>
                  <Ionicons name="business-outline" size={18} color="#3b82f6" />
                  <Text style={picStyles.itemText}>{item.nama}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={picStyles.empty}>{search ? 'Tidak ada klien ditemukan.' : 'Mulai ketik untuk mencari.'}</Text>
              }
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function AssignPicModal({ visible, target, loading, onClose, onSubmit }: {
  visible: boolean;
  target: ClientRequest | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (picUserId: number) => void;
}) {
  const [picList, setPicList]       = useState<PicRingkas[]>([]);
  const [loadingPic, setLoadingPic] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadingPic(true);
    requestApi.listPic()
      .then(({ data }) => setPicList(data))
      .finally(() => setLoadingPic(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={picStyles.backdrop}>
        <View style={picStyles.sheet}>
          <View style={picStyles.handle} />
          <View style={picStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={picStyles.title}>Assign Request</Text>
              {target && <Text style={picStyles.subtitle} numberOfLines={1}>{target.nama_klien}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={picStyles.label}>Pilih PIC untuk handle request ini</Text>
          {loadingPic ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 30 }} />
          ) : picList.length === 0 ? (
            <Text style={picStyles.empty}>Tidak ada karyawan IT tersedia.</Text>
          ) : (
            <FlatList
              data={picList}
              keyExtractor={(item) => String(item.user_id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => onSubmit(item.user_id)}
                  disabled={loading}
                  style={picStyles.picItem}
                  activeOpacity={0.7}
                >
                  {item.foto ? (
                    <Image source={{ uri: item.foto }} style={picStyles.picAvatar} />
                  ) : (
                    <View style={[picStyles.picAvatar, picStyles.picAvatarFb]}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{item.nama.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={picStyles.picName} numberOfLines={1}>{item.nama}</Text>
                  {loading
                    ? <ActivityIndicator size="small" color="#3b82f6" />
                    : <Ionicons name="chevron-forward" size={18} color="#6b7280" />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={picStyles.sep} />}
            />
          )}
        </View>
      </View>
    </Modal>
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
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 11, marginTop: 4 },

  list:  { padding: 16, paddingTop: 4 },
  empty: { color: '#8a94a6', fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 20, bottom: 110,
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

const picStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d1421',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginTop: 8, marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  title:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#8a94a6', fontSize: 12, marginTop: 2 },
  label:    { color: '#8a94a6', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 8,
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  itemText: { color: '#fff', fontSize: 14, flex: 1 },
  picItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  picAvatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1c2333' },
  picAvatarFb: { alignItems: 'center', justifyContent: 'center' },
  picName:     { color: '#fff', fontSize: 14, flex: 1 },
  sep:         { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 60 },
  empty:       { color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 30 },
});
