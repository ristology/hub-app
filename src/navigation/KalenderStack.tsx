import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import KalenderScreen        from '../screens/kalender/KalenderScreen';
import KegiatanDetailScreen  from '../screens/kalender/KegiatanDetailScreen';
import CreateKegiatanScreen  from '../screens/kalender/CreateKegiatanScreen';

const Stack = createNativeStackNavigator();

export default function KalenderStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="KalenderList"   component={KalenderScreen} />
      <Stack.Screen name="KegiatanDetail" component={KegiatanDetailScreen} />
      <Stack.Screen
        name="CreateKegiatan"
        component={CreateKegiatanScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
