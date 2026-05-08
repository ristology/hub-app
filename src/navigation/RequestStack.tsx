import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RequestScreen        from '../screens/request/RequestScreen';
import RequestDetailScreen  from '../screens/request/RequestDetailScreen';
import CreateRequestScreen  from '../screens/request/CreateRequestScreen';

const Stack = createNativeStackNavigator();

export default function RequestStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RequestList"   component={RequestScreen} />
      <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
      <Stack.Screen
        name="CreateRequest"
        component={CreateRequestScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
