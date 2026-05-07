import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import FeedStack       from './FeedStack';
import ChatStack       from './ChatStack';
import TaskStack       from './TaskStack';
import MenuStack       from './MenuStack';
import ErrorLogStack   from './ErrorLogStack';
import ProspekScreen   from '../screens/prospek/ProspekScreen';

type TabIconName = keyof typeof Ionicons.glyphMap;

const Tab = createBottomTabNavigator();

const tabConfig: Record<string, { icon: TabIconName; iconFocused: TabIconName }> = {
  Feed:     { icon: 'newspaper-outline',    iconFocused: 'newspaper' },
  Prospek:  { icon: 'people-outline',       iconFocused: 'people' },
  Pesan:    { icon: 'chatbubbles-outline',  iconFocused: 'chatbubbles' },
  Task:     { icon: 'checkbox-outline',     iconFocused: 'checkbox' },
  ErrorLog: { icon: 'bug-outline',          iconFocused: 'bug' },
  Menu:     { icon: 'grid-outline',         iconFocused: 'grid' },
};

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();

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
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Feed"     component={FeedStack} />
      <Tab.Screen name="Prospek"  component={ProspekScreen} />
      <Tab.Screen name="Pesan"    component={ChatStack} />
      <Tab.Screen name="Task"     component={TaskStack} />
      <Tab.Screen name="ErrorLog" component={ErrorLogStack}  options={{ tabBarLabel: 'Error Log' }} />
      <Tab.Screen name="Menu"     component={MenuStack} />
    </Tab.Navigator>
  );
}
