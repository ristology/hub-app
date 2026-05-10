import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../store/auth';
import { tugasApi }       from '../../api/tugas';
import { prospekApi }     from '../../api/prospek';
import { errorLogApi }    from '../../api/errorLog';
import { requestApi }     from '../../api/clientRequest';
import { kalenderApi }    from '../../api/kalender';
import { performanceApi } from '../../api/performance';
import HamburgerButton    from '../../components/HamburgerButton';

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);

  const tugas       = useQuery({ queryKey: ['home-tugas'],     queryFn: tugasApi.stats });
  const prospek     = useQuery({ queryKey: ['home-prospek'],   queryFn: prospekApi.stats });
  const errorLog    = useQuery({ queryKey: ['home-errorlog'],  queryFn: errorLogApi.stats });
  const request     = useQuery({ queryKey: ['home-request'],   queryFn: requestApi.stats });
  const kalender    = useQuery({ queryKey: ['home-kalender'],  queryFn: kalenderApi.stats });
  const performance = useQuery({ queryKey: ['home-performance'], queryFn: () => performanceApi.stats() });

  useFocusEffect(useCallback(() => {
    tugas.refetch(); prospek.refetch(); errorLog.refetch();
    request.refetch(); kalender.refetch(); performance.refetch();
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      tugas.refetch(), prospek.refetch(), errorLog.refetch(),
      request.refetch(), kalender.refetch(), performance.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  const prospekAktif = prospek.data
    ? prospek.data.prospek + prospek.data.follow_up + prospek.data.proposal +
      prospek.data.negosiasi + prospek.data.trial
    : 0;

  const userInitial = user?.name?.charAt(0).toUpperCase() ?? '?';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <HamburgerButton style={{ marginLeft: -6, marginRight: 4 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingByHour()},</Text>
            <Text style={styles.name}>{user?.name}</Text>
            {user?.departemen && (
              <Text style={styles.role}>{user.departemen}</Text>
            )}
          </View>
          {user?.foto ? (
            <Image source={{ uri: user.foto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitial}</Text>
            </View>
          )}
        </View>

        {/* Hari Ini */}
        <Text style={styles.sectionLabel}>HARI INI</Text>
        <View style={styles.todayRow}>
          <TodayCard
            icon="calendar"
            label="Jadwal"
            value={kalender.data?.hari_ini ?? 0}
            color="#3b82f6"
            onPress={() => navigation.navigate('Kalender')}
          />
          <TodayCard
            icon="checkmark-done"
            label="Task Belum"
            value={tugas.data?.belum ?? 0}
            color="#f59e0b"
            onPress={() => navigation.navigate('Task')}
          />
          <TodayCard
            icon="time"
            label="Mendatang"
            value={kalender.data?.mendatang ?? 0}
            color="#22c55e"
            onPress={() => navigation.navigate('Kalender')}
          />
        </View>

        {/* Stats Modul */}
        <Text style={styles.sectionLabel}>RINGKASAN</Text>
        <View style={styles.statsGrid}>
          <StatTile
            icon="people"
            label="Prospek Aktif"
            value={prospekAktif}
            extra={prospek.data?.overdue ? `${prospek.data.overdue} overdue` : null}
            extraColor="#ef4444"
            color="#06b6d4"
            onPress={() => navigation.navigate('Prospek')}
          />
          <StatTile
            icon="bug"
            label="Error Log"
            value={(errorLog.data?.open ?? 0) + (errorLog.data?.in_progress ?? 0)}
            extra={errorLog.data?.open ? `${errorLog.data.open} terbuka` : null}
            extraColor="#ef4444"
            color="#ef4444"
            onPress={() => navigation.navigate('ErrorLog')}
          />
          <StatTile
            icon="mail"
            label="Request"
            value={(request.data?.menunggu ?? 0) + (request.data?.diterima ?? 0) + (request.data?.proses ?? 0)}
            extra={request.data?.menunggu ? `${request.data.menunggu} menunggu` : null}
            extraColor="#f59e0b"
            color="#0ea5e9"
            onPress={() => navigation.navigate('Request')}
          />
          <StatTile
            icon="trending-up"
            label="Performance"
            value={(performance.data?.total_appointment ?? 0) + (performance.data?.total_kontrak ?? 0)}
            extra={performance.data?.total_kontrak
              ? `${performance.data.total_kontrak} kontrak ${performance.data.tahun}`
              : null}
            extraColor="#22c55e"
            color="#22c55e"
            onPress={() => navigation.navigate('Performance')}
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionLabel}>AKSI CEPAT</Text>
        <View style={styles.quickRow}>
          <QuickAction
            icon="newspaper"
            label="Posting Feed"
            color="#3b82f6"
            onPress={() => navigation.navigate('Feed', { screen: 'CreateFeed' })}
          />
          <QuickAction
            icon="add-circle"
            label="Task Baru"
            color="#f59e0b"
            onPress={() => navigation.navigate('Task', { screen: 'CreateTask' })}
          />
          <QuickAction
            icon="bug"
            label="Lapor Error"
            color="#ef4444"
            onPress={() => navigation.navigate('ErrorLog', { screen: 'CreateErrorLog' })}
          />
          <QuickAction
            icon="chatbubbles"
            label="Pesan"
            color="#a855f7"
            onPress={() => navigation.navigate('Pesan')}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function TodayCard({ icon, label, value, color, onPress }: {
  icon: any; label: string; value: number; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.todayCard, { borderColor: color + '40' }]} onPress={onPress}>
      <View style={[styles.todayIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.todayValue, { color }]}>{value}</Text>
      <Text style={styles.todayLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatTile({ icon, label, value, extra, extraColor, color, onPress }: {
  icon: any; label: string; value: number; extra?: string | null;
  extraColor?: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statTile} onPress={onPress}>
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Ionicons name="chevron-forward" size={14} color="#6b7280" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {extra && (
        <Text style={[styles.statExtra, extraColor && { color: extraColor }]}>{extra}</Text>
      )}
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, color, onPress }: {
  icon: any; label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: color + '22', borderColor: color + '40' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  content:   { padding: 16, paddingBottom: 32 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, marginTop: 8, marginBottom: 24,
  },
  greeting: { color: '#8a94a6', fontSize: 13 },
  name:     { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 4 },
  role:     { color: '#3b82f6', fontSize: 11, marginTop: 4, fontWeight: '600' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  sectionLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 18, marginBottom: 8,
  },

  todayRow: { flexDirection: 'row', gap: 8 },
  todayCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14,
    borderWidth: 1,
  },
  todayIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  todayValue: { fontSize: 20, fontWeight: '700' },
  todayLabel: { color: '#8a94a6', fontSize: 10, marginTop: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statTile: {
    width: '48.5%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  statIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#c5cdd9', fontSize: 11, marginTop: 2 },
  statExtra: { color: '#8a94a6', fontSize: 10, marginTop: 4 },

  quickRow: { flexDirection: 'row', gap: 6 },
  quickAction: { flex: 1, alignItems: 'center', gap: 6 },
  quickIcon: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickLabel: { color: '#c5cdd9', fontSize: 11, fontWeight: '500', textAlign: 'center' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)',
    paddingVertical: 12, borderRadius: 10,
    marginTop: 24,
  },
  logoutText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
});
