import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions,
  PanResponder, BackHandler, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDrawer } from '../context/AppDrawerContext';
import { useAuth } from '../store/auth';
import { navigationRef } from '../utils/deepLink';

const { height: SCREEN_H } = Dimensions.get('window');

const PANEL_WIDTH      = 88;
const HANDLE_TOUCH_W   = 14;   // tap area — sengaja dibatasi 14px supaya tidak overlap
                               //  dengan FlatList paddingHorizontal:16 (cek SwipeableCard di Request).
const HANDLE_BAR_W     = 5;    // bar visual
const HANDLE_BAR_H     = 90;
const HANDLE_TOP       = SCREEN_H * 0.40;

// Threshold untuk swipe gesture
const SWIPE_OPEN_DX    = PANEL_WIDTH * 0.35;
const SWIPE_VX         = 0.4;

type DrawerItem = {
  key:   string;
  label: string;
  icon:  keyof typeof Ionicons.glyphMap;
  route: string;
};

export default function AppDrawer() {
  const { isOpen, open, close } = useAppDrawer();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  // Animasi: panel selalu di-mount, hanya digeser via translateX
  const slideX    = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const backdropO = useRef(new Animated.Value(0)).current;
  const [showOverlay, setShowOverlay] = useState(false);

  const animateOpen = () => {
    setShowOverlay(true);
    Animated.parallel([
      Animated.spring(slideX,    { toValue: 0, useNativeDriver: true, friction: 8, tension: 65 }),
      Animated.timing(backdropO, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    open();
  };

  const animateClose = () => {
    Animated.parallel([
      Animated.spring(slideX,    { toValue: -PANEL_WIDTH, useNativeDriver: true, friction: 8, tension: 65 }),
      Animated.timing(backdropO, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setShowOverlay(false); });
    close();
  };

  // Sinkronkan eksternal isOpen dgn animasi (mis. saat goTo close drawer)
  useEffect(() => {
    if (isOpen) {
      setShowOverlay(true);
      Animated.parallel([
        Animated.spring(slideX,    { toValue: 0, useNativeDriver: true, friction: 8, tension: 65 }),
        Animated.timing(backdropO, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideX,    { toValue: -PANEL_WIDTH, useNativeDriver: true, friction: 8, tension: 65 }),
        Animated.timing(backdropO, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setShowOverlay(false); });
    }
  }, [isOpen]);

  // Android back → close drawer
  useEffect(() => {
    if (!showOverlay) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      animateClose();
      return true;
    });
    return () => sub.remove();
  }, [showOverlay]);

  // PanResponder pada handle — swipe kanan untuk buka
  const handlePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => setShowOverlay(true),
      onPanResponderMove: (_, g) => {
        if (g.dx >= 0 && g.dx <= PANEL_WIDTH) {
          slideX.setValue(-PANEL_WIDTH + g.dx);
          backdropO.setValue(g.dx / PANEL_WIDTH);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_OPEN_DX || g.vx > SWIPE_VX) {
          animateOpen();
        } else {
          animateClose();
        }
      },
      onPanResponderTerminate: () => animateClose(),
    }),
  ).current;

  // PanResponder pada panel — swipe kiri untuk tutup
  const panelPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx < -6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx <= 0 && g.dx >= -PANEL_WIDTH) {
          slideX.setValue(g.dx);
          backdropO.setValue(1 + g.dx / PANEL_WIDTH);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_OPEN_DX || g.vx < -SWIPE_VX) {
          animateClose();
        } else {
          animateOpen();
        }
      },
    }),
  ).current;

  const items: DrawerItem[] = [
    { key: 'beranda',     label: 'Beranda',     icon: 'home-outline',         route: 'MainTabs' },
    { key: 'kalender',    label: 'Kalender',    icon: 'calendar-outline',     route: 'Kalender' },
    { key: 'request',     label: 'Request',     icon: 'mail-outline',         route: 'Request' },
    { key: 'performance', label: 'Perform.',    icon: 'trending-up-outline',  route: 'Performance' },
    { key: 'dokumen',     label: 'Dokumen',     icon: 'folder-outline',       route: 'Dokumen' },
    { key: 'aktivitas',   label: 'Aktivitas',   icon: 'pulse-outline',        route: 'Aktivitas' },
  ];

  const showInvoice =
    user?.role === 'admin' || (user?.departemen ?? '').toLowerCase().includes('keuangan');
  if (showInvoice) {
    items.push({ key: 'invoice', label: 'Invoice', icon: 'receipt-outline', route: 'Invoice' });
  }

  const goTo = (route: string) => {
    animateClose();
    setTimeout(() => {
      if (!navigationRef.isReady()) return;
      // Semua route drawer adalah child dari MainTabs (sebagai tab tersembunyi)
      // supaya bottom navigation bar tetap terlihat.
      const target = route === 'MainTabs' ? 'Beranda' : route;
      navigationRef.navigate('MainTabs', { screen: target });
    }, 220);
  };

  const confirmLogout = () => {
    animateClose();
    setTimeout(() => {
      Alert.alert('Logout', 'Yakin ingin logout?', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => logout() },
      ]);
    }, 220);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop — render saat overlay aktif, tap untuk tutup */}
      {showOverlay && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropO }]}
          pointerEvents={isOpen ? 'auto' : 'box-only'}
          onTouchEnd={animateClose}
        />
      )}

      {/* Panel — selalu mounted, hanya digeser. pointerEvents=none saat tertutup
          supaya tidak intercept tap/swipe pada child di belakangnya (di Android
          translateX tidak otomatis pindahkan hitbox). */}
      <Animated.View
        style={[
          styles.panel,
          {
            paddingTop:    insets.top + 12,
            paddingBottom: insets.bottom + 12,
            transform: [{ translateX: slideX }],
          },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
        {...(isOpen ? panelPan.panHandlers : {})}
      >
        <ScrollView
          contentContainerStyle={styles.panelContent}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => goTo(item.route)}
              style={styles.item}
              activeOpacity={0.6}
            >
              <Ionicons name={item.icon} size={24} color="#fff" />
              <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.divider} />

          <TouchableOpacity onPress={confirmLogout} style={styles.item} activeOpacity={0.6}>
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            <Text style={[styles.itemLabel, { color: '#ef4444' }]}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Fin/handle — selalu visible di edge kiri, tap atau swipe untuk buka */}
      <View
        style={[styles.handleArea, { top: HANDLE_TOP }]}
        {...handlePan.panHandlers}
        pointerEvents={isOpen ? 'none' : 'auto'}
      >
        <TouchableOpacity onPress={animateOpen} activeOpacity={0.5} style={styles.handleTouch}>
          <View style={styles.handleBar} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },

  // Glass panel — rgba dengan border tipis untuk efek transparan
  panel: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: 'rgba(20, 30, 50, 0.78)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.10)',
    // subtle shadow ke kanan
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  panelContent: {
    alignItems: 'center',
    paddingVertical: 6,
  },

  item: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 5,
  },
  itemLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  divider: {
    width: '70%', height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: 6,
  },

  // Fin/handle pada edge kiri
  handleArea: {
    position: 'absolute', left: 0,
    width: HANDLE_TOUCH_W,
    height: HANDLE_BAR_H + 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  handleTouch: {
    width: HANDLE_TOUCH_W,
    height: HANDLE_BAR_H,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  handleBar: {
    width: HANDLE_BAR_W,
    height: HANDLE_BAR_H,
    backgroundColor: '#ef4444',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    // Glow merah menyala
    shadowColor:   '#ef4444',
    shadowOffset:  { width: 2, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius:  6,
    elevation:     8,
  },
});
