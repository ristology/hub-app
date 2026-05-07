import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProspekScreen        from '../screens/prospek/ProspekScreen';
import ProspekDetailScreen  from '../screens/prospek/ProspekDetailScreen';
import CreateProspekScreen  from '../screens/prospek/CreateProspekScreen';
import AddPertemuanScreen   from '../screens/prospek/AddPertemuanScreen';

const Stack = createNativeStackNavigator();

export default function ProspekStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProspekList"   component={ProspekScreen} />
      <Stack.Screen name="ProspekDetail" component={ProspekDetailScreen} />
      <Stack.Screen
        name="CreateProspek"
        component={CreateProspekScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="AddPertemuan"
        component={AddPertemuanScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
