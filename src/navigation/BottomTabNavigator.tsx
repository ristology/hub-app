import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen     from '../screens/home/HomeScreen';
import FeedStack      from './FeedStack';
import ChatStack      from './ChatStack';
import TaskStack      from './TaskStack';
import KalenderScreen from '../screens/kalender/KalenderScreen';

type TabIconName = keyof typeof Ionicons.glyphMap;

const Tab = createBottomTabNavigator();

const tabConfig: Record<string, { icon: TabIconName; iconFocused: TabIconName }> = {
  Beranda:  { icon: 'home-outline',         iconFocused: 'home' },
  Feed:     { icon: 'newspaper-outline',    iconFocused: 'newspaper' },
  Chat:     { icon: 'chatbubbles-outline',  iconFocused: 'chatbubbles' },
  Task:     { icon: 'checkbox-outline',     iconFocused: 'checkbox' },
  Kalender: { icon: 'calendar-outline',     iconFocused: 'calendar' },
};

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();

  // Android nav bar / iOS home indicator butuh padding bottom dari safe area.
  // Minimum 8 supaya tetap ada breathing room di device tanpa inset.
  const bottomPad    = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);
  const tabBarHeight = 56 + bottomPad;

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
        tabBarStyle: {
          backgroundColor: '#0a0f1a',
          borderTopColor:  'rgba(255,255,255,0.08)',
          borderTopWidth:  1,
          height:          tabBarHeight,
          paddingTop:      6,
          paddingBottom:   bottomPad,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Beranda"  component={HomeScreen} />
      <Tab.Screen name="Feed"     component={FeedStack} />
      <Tab.Screen name="Chat"     component={ChatStack} />
      <Tab.Screen name="Task"     component={TaskStack} />
      <Tab.Screen name="Kalender" component={KalenderScreen} />
    </Tab.Navigator>
  );
}
