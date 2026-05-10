import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Animated, StyleSheet, Dimensions,
  TouchableWithoutFeedback, BackHandler, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDrawer } from '../context/AppDrawerContext';
import { useAuth } from '../store/auth';
import { navigationRef } from '../utils/deepLink';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_W * 0.78);

type DrawerItem = {
  key:   string;
  label: string;
  icon:  keyof typeof Ionicons.glyphMap;
  route: string;
  color?: string;
};

export default function AppDrawer() {
  const { isOpen, close } = useAppDrawer();
  const { user, logout }  = useAuth();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(isOpen);
  const slideX    = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideX,    { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(backdropO, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideX,    { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropO, { toValue: 0,             duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [isOpen]);

  // Android back button → close drawer instead of navigating back
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [mounted, close]);

  const items: DrawerItem[] = [
    { key: 'beranda',     label: 'Beranda',     icon: 'home-outline',         route: 'MainTabs' },
    { key: 'kalender',    label: 'Kalender',    icon: 'calendar-outline',     route: 'Kalender' },
    { key: 'request',     label: 'Request',     icon: 'mail-outline',         route: 'Request' },
    { key: 'performance', label: 'Performance', icon: 'trending-up-outline',  route: 'Performance' },
    { key: 'dokumen',     label: 'Dokumen',     icon: 'folder-outline',       route: 'Dokumen' },
    { key: 'aktivitas',   label: 'Aktivitas',   icon: 'pulse-outline',        route: 'Aktivitas' },
  ];

  const showInvoice =
    user?.role === 'admin' || (user?.departemen ?? '').toLowerCase().includes('keuangan');
  if (showInvoice) {
    items.push({ key: 'invoice', label: 'Invoice', icon: 'receipt-outline', route: 'Invoice' });
  }

  const goTo = (route: string) => {
    close();
    // Tunggu animasi tutup selesai biar transisi mulus
    setTimeout(() => {
      if (navigationRef.isReady()) {
        if (route === 'MainTabs') {
          navigationRef.navigate('MainTabs', { screen: 'Beranda' });
        } else {
          navigationRef.navigate(route as any);
        }
      }
    }, 220);
  };

  const confirmLogout = () => {
    close();
    setTimeout(() => {
      Alert.alert('Logout', 'Yakin ingin logout?', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => logout() },
      ]);
    }, 220);
  };

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={close}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropO }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.drawer,
          {
            paddingTop:    insets.top + 16,
            paddingBottom: insets.bottom,
            transform: [{ translateX: slideX }],
          },
        ]}
      >
        {/* Profile header */}
        <View style={styles.profileBox}>
          {user?.foto ? (
            <Image source={{ uri: user.foto }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <Text style={styles.profileName} numberOfLines={1}>{user?.name ?? '-'}</Text>
          <Text style={styles.profileRole} numberOfLines={1}>
            {user?.departemen ?? user?.role ?? '-'}
          </Text>
        </View>

        <View style={styles.divider} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 4 }}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => goTo(item.route)}
              style={styles.menuItem}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={20} color="#3b82f6" />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.divider} />

        <TouchableOpacity
          onPress={confirmLogout}
          style={styles.menuItem}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={[styles.menuLabel, { color: '#ef4444' }]}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#0d1421',
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)',
  },
  profileBox: { paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  profileName: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 8 },
  profileRole: { color: '#8a94a6', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  menuLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
