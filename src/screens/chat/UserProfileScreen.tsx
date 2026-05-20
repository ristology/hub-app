import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { chatApi, type UserActivity } from '../../api/chat';

type RouteParams = { userId: number };

/** Relative time singkat: "baru saja", "5 mnt lalu", "2 jam lalu",
 *  "3 hari lalu", lalu fallback ke tanggal. */
function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs  = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)    return 'baru saja';
  if (diffMin < 60)   return `${diffMin} mnt lalu`;
  const diffJam = Math.floor(diffMin / 60);
  if (diffJam < 24)   return `${diffJam} jam lalu`;
  const diffHari = Math.floor(diffJam / 24);
  if (diffHari < 7)   return `${diffHari} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function UserProfileScreen() {
  const route      = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const { userId } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['chat-user-profile', userId],
    queryFn:  () => chatApi.userProfile(userId),
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Profil</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
        {/* Header */}
        <View style={styles.header}>
          {data.foto ? (
            <Image source={{ uri: data.foto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFb]}>
              <Text style={styles.avatarText}>{data.nama.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{data.nama}</Text>
          {data.jabatan ? <Text style={styles.jabatan}>{data.jabatan}</Text> : null}
          {data.departemen ? (
            <View style={styles.deptBadge}>
              <Ionicons name="business-outline" size={11} color="#93c5fd" />
              <Text style={styles.deptText}>{data.departemen}</Text>
            </View>
          ) : null}
        </View>

        {/* Deskripsi / bio */}
        <Text style={styles.sectionLabel}>DESKRIPSI</Text>
        <View style={styles.card}>
          {data.bio ? (
            <Text style={styles.bioText}>{data.bio}</Text>
          ) : (
            <Text style={styles.bioEmpty}>Belum ada deskripsi.</Text>
          )}
        </View>

        {/* Aktivitas terakhir */}
        <Text style={styles.sectionLabel}>AKTIVITAS TERAKHIR</Text>
        <View style={styles.card}>
          {data.aktivitas.length > 0 ? (
            data.aktivitas.map((a, idx) => (
              <ActivityRow key={a.id} activity={a} first={idx === 0} />
            ))
          ) : (
            <Text style={styles.bioEmpty}>Belum ada aktivitas tercatat.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityRow({ activity, first }: { activity: UserActivity; first: boolean }) {
  return (
    <View style={[styles.actRow, !first && styles.actRowBorder]}>
      <View style={[styles.actDot, { backgroundColor: activity.warna || '#858796' }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.actLabel}>{activity.label_tipe}</Text>
        <Text style={styles.actJudul} numberOfLines={2}>{activity.judul}</Text>
      </View>
      <Text style={styles.actTime}>{relativeTime(activity.created_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 4 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },

  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1c2333' },
  avatarFb:   { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 38, fontWeight: '700' },
  name:    { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  jabatan: { color: '#9ca3af', fontSize: 13, marginTop: 4 },
  deptBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.40)',
  },
  deptText: { color: '#bfdbfe', fontSize: 10, fontWeight: '700' },

  sectionLabel: {
    color: '#8a94a6', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 14, marginBottom: 8, marginLeft: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
  },
  bioText:  { color: '#fff', fontSize: 14, lineHeight: 20, paddingVertical: 14 },
  bioEmpty: { color: '#6b7280', fontSize: 13, fontStyle: 'italic', paddingVertical: 14 },

  actRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 11,
  },
  actRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  actDot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 5,
  },
  actLabel: { color: '#8a94a6', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  actJudul: { color: '#fff', fontSize: 13, lineHeight: 18 },
  actTime:  { color: '#6b7280', fontSize: 10, marginLeft: 6 },
});
