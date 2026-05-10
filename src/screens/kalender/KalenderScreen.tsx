import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, LayoutAnimation, Platform, UIManager,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { kalenderApi, type Kegiatan } from '../../api/kalender';
import KegiatanCard from './components/KegiatanCard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type KalenderStackParamList = {
  KalenderList: undefined;
  KegiatanDetail: { id: number };
  CreateKegiatan: undefined;
};

const HARI_INDO = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date):   Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function toIso(d: Date): string { return d.toISOString().slice(0, 19); }

function dateKey(s: string): string {
  return s.slice(0, 10);
}

function formatGroupHeader(key: string): string {
  const d = new Date(key + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime())    return 'Hari ini';
  if (target.getTime() === tomorrow.getTime()) return 'Besok';
  return `${HARI_INDO[d.getDay()]}, ${d.getDate()} ${BULAN_INDO[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export default function KalenderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<KalenderStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [showCalendar, setShowCalendar]   = useState(false);
  const [selectedDate, setSelectedDate]   = useState<string | null>(null);
  const lastScrollY = useRef(0);

  const toggleCalendar = (next: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setShowCalendar(next);
  };

  const start = startOfMonth(cursor);
  const end   = endOfMonth(cursor);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['kalender', start.toISOString(), end.toISOString()],
    queryFn:  () => kalenderApi.list({ start: toIso(start), end: toIso(end) }),
  });

  const { data: stats } = useQuery({
    queryKey: ['kalender-stats'],
    queryFn:  kalenderApi.stats,
  });

  const { data: googleStatus } = useQuery({
    queryKey: ['kalender-google-status'],
    queryFn:  kalenderApi.googleStatus,
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const eventsByDate = useMemo(() => {
    const list = data?.data ?? [];
    const map = new Map<string, Kegiatan[]>();
    for (const k of list) {
      const key = dateKey(k.mulai_at);
      const arr = map.get(key) ?? [];
      arr.push(k);
      map.set(key, arr);
    }
    return map;
  }, [data]);

  const groups = useMemo(() => {
    const all = Array.from(eventsByDate.entries()).sort(([a], [b]) => a.localeCompare(b));
    return selectedDate ? all.filter(([k]) => k === selectedDate) : all;
  }, [eventsByDate, selectedDate]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // Auto-hide saat scroll ke bawah > 40px supaya event list dapat ruang lebih
    if (y > 40 && showCalendar && y > lastScrollY.current) {
      toggleCalendar(false);
    }
    lastScrollY.current = y;
  };

  const handleDateTap = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setSelectedDate((prev) => (prev === key ? null : key));
  };

  const renderItem = ({ item }: { item: [string, Kegiatan[]] }) => {
    const [key, list] = item;
    return (
      <View style={styles.group}>
        <Text style={styles.groupHeader}>{formatGroupHeader(key)}</Text>
        {list.map((k) => (
          <KegiatanCard
            key={k.id}
            kegiatan={k}
            onPress={() => navigation.navigate('KegiatanDetail', { id: k.id })}
          />
        ))}
      </View>
    );
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Kalender</Text>
        {googleStatus && (
          <View style={[
            styles.googleBadge,
            googleStatus.connected ? styles.googleConnected : styles.googleDisconnected,
          ]}>
            <Ionicons
              name={googleStatus.connected ? 'cloud-done' : 'cloud-offline'}
              size={11}
              color={googleStatus.connected ? '#22c55e' : '#8a94a6'}
            />
            <Text style={[
              styles.googleText,
              { color: googleStatus.connected ? '#22c55e' : '#8a94a6' },
            ]}>
              {googleStatus.connected ? 'Google Sync' : 'Not Connected'}
            </Text>
          </View>
        )}
        <TouchableOpacity
          onPress={() => toggleCalendar(!showCalendar)}
          style={[styles.calToggle, showCalendar && styles.calToggleActive]}
          hitSlop={8}
        >
          <Ionicons
            name={showCalendar ? 'calendar' : 'calendar-outline'}
            size={20}
            color={showCalendar ? '#3b82f6' : '#8a94a6'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCursor(new Date())} style={styles.monthLabel}>
          <Text style={styles.monthText}>
            {BULAN_INDO[cursor.getMonth()]} {cursor.getFullYear()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {showCalendar && (
        <MonthGrid
          cursor={cursor}
          eventsByDate={eventsByDate}
          selectedDate={selectedDate}
          onSelectDate={handleDateTap}
        />
      )}

      {stats && !showCalendar && (
        <View style={[styles.statsWrap, styles.statsContent]}>
          <StatBox label="Hari ini"   value={stats.hari_ini}   color="#3b82f6" />
          <StatBox label="Minggu ini" value={stats.minggu_ini} color="#22c55e" />
          <StatBox label="Mendatang"  value={stats.mendatang}  color="#f59e0b" />
        </View>
      )}

      {selectedDate && (
        <View style={styles.filterBar}>
          <Ionicons name="funnel" size={12} color="#3b82f6" />
          <Text style={styles.filterText}>{formatGroupHeader(selectedDate)}</Text>
          <TouchableOpacity onPress={() => handleDateTap(selectedDate)} hitSlop={6}>
            <Ionicons name="close-circle" size={16} color="#8a94a6" />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={groups}
        keyExtractor={(item) => item[0]}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="calendar-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>
              {selectedDate ? 'Tidak ada jadwal di tanggal ini.' : 'Tidak ada jadwal di bulan ini.'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateKegiatan')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
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

function MonthGrid({ cursor, eventsByDate, selectedDate, onSelectDate }: {
  cursor: Date;
  eventsByDate: Map<string, Kegiatan[]>;
  selectedDate: string | null;
  onSelectDate: (key: string) => void;
}) {
  const year   = cursor.getFullYear();
  const month  = cursor.getMonth();
  const first  = new Date(year, month, 1);
  const last   = new Date(year, month + 1, 0);
  const cells: (number | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const cellTextColor = (col: number, isSelected: boolean) => {
    if (isSelected) return '#fff';
    if (col === 0) return '#ef4444';
    if (col === 6) return '#3b82f6';
    return '#fff';
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.calRow}>
        {HARI_INDO.map((h, i) => (
          <Text key={h} style={[
            styles.calHeaderText,
            i === 0 && { color: '#ef4444' },
            i === 6 && { color: '#3b82f6' },
          ]}>{h}</Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.calRow}>
          {row.map((d, ci) => {
            if (d === null) return <View key={ci} style={styles.calCell} />;
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasEvent = eventsByDate.has(key);
            const isToday    = key === todayKey;
            const isSelected = key === selectedDate;
            return (
              <TouchableOpacity
                key={ci}
                onPress={() => onSelectDate(key)}
                activeOpacity={0.7}
                style={[
                  styles.calCell,
                  isSelected && styles.calCellSelected,
                  isToday && !isSelected && styles.calCellToday,
                ]}
              >
                <Text style={[styles.calCellText, { color: cellTextColor(ci, isSelected) }, isSelected && { fontWeight: '700' }]}>
                  {d}
                </Text>
                {hasEvent && (
                  <View style={[styles.calDot, isSelected && { backgroundColor: '#fff' }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  header:    {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, gap: 4,
  },
  backBtn:   { padding: 8 },
  title:     { color: '#fff', fontSize: 22, fontWeight: '700', flex: 1 },
  googleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1,
  },
  googleConnected:    { backgroundColor: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)' },
  googleDisconnected: { backgroundColor: 'rgba(138,148,166,0.10)', borderColor: 'rgba(138,148,166,0.25)' },
  googleText: { fontSize: 10, fontWeight: '600' },

  calToggle: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  calToggleActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3b82f6' },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, marginBottom: 8,
  },
  navBtn:     { padding: 8 },
  monthLabel: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  monthText:  { color: '#fff', fontSize: 16, fontWeight: '600' },

  statsWrap: { marginBottom: 10 },
  statsContent: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 90,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#8a94a6', fontSize: 11, marginTop: 2 },

  calendar: {
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6,
  },
  calRow: {
    flexDirection: 'row',
  },
  calHeaderText: {
    flex: 1, textAlign: 'center', color: '#8a94a6',
    fontSize: 11, fontWeight: '700', paddingVertical: 6,
    letterSpacing: 0.5,
  },
  calCell: {
    flex: 1, aspectRatio: 1.1,
    alignItems: 'center', justifyContent: 'center',
    margin: 1, borderRadius: 8,
    position: 'relative',
  },
  calCellText:    { color: '#fff', fontSize: 13, fontWeight: '500' },
  calCellToday:   { backgroundColor: 'rgba(59,130,246,0.10)', borderWidth: 1, borderColor: '#3b82f6' },
  calCellSelected:{ backgroundColor: '#3b82f6' },
  calDot: {
    position: 'absolute', bottom: 4,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#3b82f6',
  },

  filterBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderColor: 'rgba(59,130,246,0.30)', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
    marginHorizontal: 16, marginBottom: 6, borderRadius: 8,
  },
  filterText: { flex: 1, color: '#3b82f6', fontSize: 12, fontWeight: '600' },

  list: { padding: 16, paddingTop: 4 },
  empty: { color: '#8a94a6', fontSize: 14 },

  group: { marginBottom: 14 },
  groupHeader: {
    color: '#3b82f6', fontSize: 12, fontWeight: '700',
    letterSpacing: 0.5, marginBottom: 8,
    textTransform: 'uppercase',
  },

  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
});
