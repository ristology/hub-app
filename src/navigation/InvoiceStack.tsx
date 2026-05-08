import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InvoiceScreen        from '../screens/invoice/InvoiceScreen';
import InvoiceDetailScreen  from '../screens/invoice/InvoiceDetailScreen';

const Stack = createNativeStackNavigator();

export default function InvoiceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InvoiceList"   component={InvoiceScreen} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
    </Stack.Navigator>
  );
}
