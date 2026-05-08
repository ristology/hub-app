import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MenuScreen     from '../screens/menu/MenuScreen';
import HomeScreen     from '../screens/home/HomeScreen';
import AktivitasScreen   from '../screens/aktivitas/AktivitasScreen';
import KalenderStack     from './KalenderStack';
import PerformanceStack  from './PerformanceStack';
import RequestStack      from './RequestStack';

const Stack = createNativeStackNavigator();

export default function MenuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MenuList" component={MenuScreen} />
      <Stack.Screen name="Beranda"  component={HomeScreen} />
      <Stack.Screen name="Kalender" component={KalenderStack} />
      <Stack.Screen name="Request"     component={RequestStack} />
      <Stack.Screen name="Performance" component={PerformanceStack} />
      <Stack.Screen name="Aktivitas"   component={AktivitasScreen} />
    </Stack.Navigator>
  );
}
