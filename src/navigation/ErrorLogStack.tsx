import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ErrorLogScreen        from '../screens/errorlog/ErrorLogScreen';
import ErrorLogDetailScreen  from '../screens/errorlog/ErrorLogDetailScreen';
import CreateErrorLogScreen  from '../screens/errorlog/CreateErrorLogScreen';

const Stack = createNativeStackNavigator();

export default function ErrorLogStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ErrorLogList"   component={ErrorLogScreen} />
      <Stack.Screen name="ErrorLogDetail" component={ErrorLogDetailScreen} />
      <Stack.Screen
        name="CreateErrorLog"
        component={CreateErrorLogScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
