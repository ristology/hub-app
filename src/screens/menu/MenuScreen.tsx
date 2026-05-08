import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../../store/auth';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  screen?: string;
  disabled?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { icon: 'home-outline',          label: 'Beranda',     color: '#3b82f6', screen: 'Beranda' },
  { icon: 'calendar-outline',      label: 'Kalender',    color: '#8b5cf6', screen: 'Kalender' },
  { icon: 'mail-outline',          label: 'Request',     color: '#f59e0b', screen: 'Request' },
  { icon: 'trending-up-outline',   label: 'Performance', color: '#22c55e', disabled: true },
  { icon: 'document-text-outline', label: 'Dokumen',     color: '#06b6d4', disabled: true },
  { icon: 'pulse-outline',         label: 'Aktivitas',   color: '#ec4899', disabled: true },
  { icon: 'receipt-outline',       label: 'Invoice',     color: '#f97316', disabled: true },
];

export default function MenuScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();

  const renderMenu = (item: MenuItem) => (
    <TouchableOpacity
      key={item.label}
      style={[styles.menuCard, item.disabled && styles.menuDisabled]}
      onPress={() => item.screen && navigation.navigate(item.screen)}
      disabled={item.disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.color + '22' }]}>
        <Ionicons name={item.icon} size={26} color={item.color} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      {item.disabled && <Text style={styles.menuSoon}>Segera</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile header */}
        <View style={styles.profileCard}>
          {user?.foto ? (
            <Image source={{ uri: user.foto }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileMeta}>
              {user?.role?.toUpperCase()} {user?.departemen ? `· ${user.departemen}` : ''}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.sectionTitle}>MENU LAINNYA</Text>

        {/* Grid menu */}
        <View style={styles.grid}>
          {MENU_ITEMS.map(renderMenu)}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  scroll:    { padding: 16, paddingBottom: 40 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  profileName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  profileMeta: { color: '#3b82f6', fontSize: 11, marginTop: 4, fontWeight: '600' },

  sectionTitle: { color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuCard: {
    width: '31%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 12,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 92,
  },
  menuDisabled: { opacity: 0.5 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { color: '#fff', fontSize: 12, fontWeight: '500', textAlign: 'center' },
  menuSoon: { color: '#6b7280', fontSize: 9, fontStyle: 'italic' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)',
    borderRadius: 10, paddingVertical: 13,
    marginTop: 24,
  },
  logoutText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
});
