import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PajakScreen       from '../screens/pajak/PajakScreen';
import PajakDetailScreen from '../screens/pajak/PajakDetailScreen';

const Stack = createNativeStackNavigator();

export default function PajakStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PajakList"   component={PajakScreen} />
      <Stack.Screen name="PajakDetail" component={PajakDetailScreen} />
    </Stack.Navigator>
  );
}
