import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CashbackScreen       from '../screens/cashback/CashbackScreen';
import CashbackDetailScreen from '../screens/cashback/CashbackDetailScreen';

const Stack = createNativeStackNavigator();

export default function CashbackStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CashbackList"   component={CashbackScreen} />
      <Stack.Screen name="CashbackDetail" component={CashbackDetailScreen} />
    </Stack.Navigator>
  );
}
