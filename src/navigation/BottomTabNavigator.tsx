import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import FeedStack       from './FeedStack';
import ChatStack       from './ChatStack';
import TaskStack       from './TaskStack';
import ErrorLogStack   from './ErrorLogStack';
import ProspekStack    from './ProspekStack';
import HomeScreen      from '../screens/home/HomeScreen';
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

export default function BottomTabNavigator() {
  const tabBarStyle = useTabBarStyle();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const cfg = tabConfig[route.name];
          const name = focused ? cfg.iconFocused : cfg.icon;
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor:   '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Beranda"  component={HomeScreen} />
      <Tab.Screen name="Feed"     component={FeedStack} />
      <Tab.Screen
        name="Prospek"
        component={ProspekStack}
        options={({ route }) => ({
          // Sembunyikan tab bar di ProspekDetail (full-screen UX dgn komentar input)
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'ProspekDetail'
            ? { display: 'none' }
            : tabBarStyle,
        })}
      />
      <Tab.Screen
        name="Pesan"
        component={ChatStack}
        options={({ route }) => ({
          // Sembunyikan tab bar saat user di ChatRoom (full-screen messaging UX)
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
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'ErrorLogDetail'
            ? { display: 'none' }
            : tabBarStyle,
        })}
      />
    </Tab.Navigator>
  );
}
