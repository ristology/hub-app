import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PerformanceScreen        from '../screens/performance/PerformanceScreen';
import PerformanceDetailScreen  from '../screens/performance/PerformanceDetailScreen';
import CreatePerformanceScreen  from '../screens/performance/CreatePerformanceScreen';

const Stack = createNativeStackNavigator();

export default function PerformanceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PerformanceList"   component={PerformanceScreen} />
      <Stack.Screen name="PerformanceDetail" component={PerformanceDetailScreen} />
      <Stack.Screen
        name="CreatePerformance"
        component={CreatePerformanceScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
