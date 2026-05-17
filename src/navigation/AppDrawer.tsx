import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions,
  PanResponder, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAppDrawer } from '../context/AppDrawerContext';
import { useAuth } from '../store/auth';
import { navigationRef } from '../utils/deepLink';
import { notifApi } from '../api/notif';

const { height: SCREEN_H } = Dimensions.get('window');

const PANEL_WIDTH      = 96;   // outer wrapper — slides off-screen; includes left edge gap
const CARD_WIDTH       = 88;   // inner glass card (visible width)
const CARD_GAP_LEFT    = 8;    // gap card → edge layar
const HANDLE_TOUCH_W   = 14;   // tap area — sengaja dibatasi 14px supaya tidak overlap
                               //  dengan FlatList paddingHorizontal:16 (cek SwipeableCard di Request).
const HANDLE_BAR_W     = 5;    // bar visual
const HANDLE_BAR_H     = 90;
const HANDLE_AREA_H    = HANDLE_BAR_H + 20;     // tinggi container handleArea (bar di-center di dalam)
const HANDLE_TOP       = SCREEN_H * 0.40;
const HANDLE_CENTER_Y  = HANDLE_TOP + HANDLE_AREA_H / 2;  // pusat vertikal fin merah

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
  const { user } = useAuth();

  // Notif count untuk badge — share queryKey dengan BottomTabNavigator supaya
  // tidak duplikat fetch.
  const { data: notif } = useQuery({
    queryKey: ['notif-count'],
    queryFn:  notifApi.count,
    refetchInterval: 20000,
  });
  const requestUnread = notif?.request ?? 0;

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

  // Beranda dihilangkan dari slide panel — sudah ada di bottom tab navigation,
  // tidak perlu duplikat.
  const items: DrawerItem[] = [
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

      {/* Panel wrapper — selalu mounted, full-height, hanya digeser.
          Transparan; berfungsi sebagai container untuk slide animation +
          vertical centering inner card. pointerEvents=none saat tertutup
          supaya tidak intercept tap/swipe pada child di belakangnya (di Android
          translateX tidak otomatis pindahkan hitbox). */}
      <Animated.View
        style={[
          styles.panelWrapper,
          { transform: [{ translateX: slideX }] },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
        {...(isOpen ? panelPan.panHandlers : {})}
      >
        {/* Inner card — glass panel sesungguhnya. Auto-height (menyesuaikan
            items), vertically centered oleh wrapper, rounded di kiri & kanan. */}
        <View style={styles.panelCard}>
          {items.map((item) => {
            const count = item.key === 'request' ? requestUnread : 0;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => goTo(item.route)}
                style={styles.item}
                activeOpacity={0.6}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={24} color="#fff" />
                  {count > 0 && (
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {/* Fin/handle — selalu visible di edge kiri, tap atau swipe untuk buka.
          Saat ada notif Request unread, tampilkan dot putih di ujung fin. */}
      <View
        style={[styles.handleArea, { top: HANDLE_TOP }]}
        {...handlePan.panHandlers}
        pointerEvents={isOpen ? 'none' : 'auto'}
      >
        <TouchableOpacity onPress={animateOpen} activeOpacity={0.5} style={styles.handleTouch}>
          <View style={styles.handleBar}>
            {requestUnread > 0 && <View style={styles.handleDot} />}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },

  // Outer wrapper — container untuk slide animation & vertical centering inner
  // card. Tidak ada glass styling di sini. Bottom dipotong supaya wrapper
  // height = 2 * HANDLE_CENTER_Y → justifyContent center menempatkan card
  // tepat di pusat handle fin merah (bukan pusat layar).
  panelWrapper: {
    position: 'absolute', left: 0, top: 0,
    bottom: Math.max(0, SCREEN_H - 2 * HANDLE_CENTER_Y),
    width: PANEL_WIDTH,
    justifyContent: 'center',
  },

  // Inner glass card — rounded di kiri & kanan, ada gap dari edge layar.
  panelCard: {
    width: CARD_WIDTH,
    marginLeft: CARD_GAP_LEFT,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(20, 30, 50, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
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

  // Wrapper icon supaya badge bisa absolute positioned
  iconWrap: { position: 'relative' },
  itemBadge: {
    position: 'absolute',
    top: -6, right: -10,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#0d1421',
  },
  itemBadgeText: {
    color: '#fff', fontSize: 9, fontWeight: '700',
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
  /** Dot putih kecil di tengah fin saat ada notif Request unread */
  handleDot: {
    position: 'absolute',
    top: HANDLE_BAR_H / 2 - 4,
    left: -3,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#fff',
    shadowColor:   '#fff',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius:  4,
    elevation:     6,
  },
});
