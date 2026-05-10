import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import FeedStack       from './FeedStack';
import ChatStack       from './ChatStack';
import TaskStack       from './TaskStack';
import ErrorLogStack   from './ErrorLogStack';
import ProspekStack    from './ProspekStack';
import KalenderStack   from './KalenderStack';
import RequestStack    from './RequestStack';
import PerformanceStack from './PerformanceStack';
import DokumenStack    from './DokumenStack';
import InvoiceStack    from './InvoiceStack';
import HomeScreen      from '../screens/home/HomeScreen';
import AktivitasScreen from '../screens/aktivitas/AktivitasScreen';
import { notifApi } from '../api/notif';
import { useTabBarStyle } from './useTabBarStyle';

type TabIconName = keyof typeof Ionicons.glyphMap;

const Tab = createBottomTabNavigator();

const tabConfig: Record<string, { icon: TabIconName; iconFocused: TabIconName }> = {
  Beranda:  { icon: 'home-outline',         iconFocused: 'home' },
  Feed:     { icon: 'newspaper-outline',    iconFocused: 'newspaper' },
  Prospek:  { icon: 'people-outline',       iconFocused: 'people' },
  Pesan:    { icon: 'chatbubbles-outline',  iconFocused: 'chatbubbles' },
  Task:     { icon: 'checkbox-outline',     iconFocused: 'checkbox' },
  ErrorLog: { icon: 'bug-outline',          iconFocused: 'bug' },
};

// Tabs yang tidak ditampilkan di tab bar — diakses lewat side drawer.
const hiddenTabRoute = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } };

// Style badge merah menyala — sama untuk semua tab.
const RED_BADGE_STYLE = {
  backgroundColor: '#ef4444',
  color: '#fff',
  fontSize: 10,
  fontWeight: '700' as const,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
};

/** Format badge — number, atau "99+" kalau lebih besar. Undefined = tidak ada badge. */
function badge(n?: number): number | string | undefined {
  if (!n || n <= 0) return undefined;
  return n > 99 ? '99+' : n;
}

export default function BottomTabNavigator() {
  const tabBarStyle = useTabBarStyle();

  // Polling notif count tiap 20 detik. Akan di-invalidate manual saat user
  // buka detail screen (mark-read) supaya badge update real-time.
  const { data: notif } = useQuery({
    queryKey: ['notif-count'],
    queryFn:  notifApi.count,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const cfg = tabConfig[route.name];
          if (!cfg) return null;
          const name = focused ? cfg.iconFocused : cfg.icon;
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor:   '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarBadgeStyle: RED_BADGE_STYLE,
      })}
    >
      {/* Tab terlihat */}
      <Tab.Screen name="Beranda"  component={HomeScreen} />
      <Tab.Screen
        name="Feed"
        component={FeedStack}
        options={{ tabBarBadge: badge(notif?.feed) }}
      />
      <Tab.Screen
        name="Prospek"
        component={ProspekStack}
        options={({ route }) => ({
          tabBarBadge: badge(notif?.prospek),
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'ProspekDetail'
            ? { display: 'none' }
            : tabBarStyle,
        })}
      />
      <Tab.Screen
        name="Pesan"
        component={ChatStack}
        options={({ route }) => ({
          tabBarBadge: badge(notif?.pesan),
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'ChatRoom'
            ? { display: 'none' }
            : tabBarStyle,
        })}
      />
      <Tab.Screen name="Task"     component={TaskStack} />
      <Tab.Screen
        name="ErrorLog"
        component={ErrorLogStack}
        options={({ route }) => ({
          tabBarLabel: 'Error Log',
          tabBarBadge: badge(notif?.error_log),
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'ErrorLogDetail'
            ? { display: 'none' }
            : tabBarStyle,
        })}
      />

      {/* Hidden tabs — diakses dari side drawer */}
      <Tab.Screen
        name="Kalender"
        component={KalenderStack}
        options={({ route }) => ({
          ...hiddenTabRoute,
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'KegiatanDetail'
            ? { display: 'none' }
            : tabBarStyle,
        })}
      />
      <Tab.Screen
        name="Request"
        component={RequestStack}
        options={({ route }) => ({
          ...hiddenTabRoute,
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'RequestDetail'
            ? { display: 'none' }
            : tabBarStyle,
        })}
      />
      <Tab.Screen
        name="Performance"
        component={PerformanceStack}
        options={({ route }) => ({
          ...hiddenTabRoute,
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'PerformanceDetail'
            ? { display: 'none' }
            : tabBarStyle,
        })}
      />
      <Tab.Screen
        name="Dokumen"
        component={DokumenStack}
        options={hiddenTabRoute}
      />
      <Tab.Screen
        name="Aktivitas"
        component={AktivitasScreen}
        options={hiddenTabRoute}
      />
      <Tab.Screen
        name="Invoice"
        component={InvoiceStack}
        options={({ route }) => ({
          ...hiddenTabRoute,
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'InvoiceDetail'
            ? { display: 'none' }
            : tabBarStyle,
        })}
      />
    </Tab.Navigator>
  );
}
