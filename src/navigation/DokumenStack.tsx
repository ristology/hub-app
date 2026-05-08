import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DokumenScreen        from '../screens/dokumen/DokumenScreen';
import DokumenDetailScreen  from '../screens/dokumen/DokumenDetailScreen';
import UploadDokumenScreen  from '../screens/dokumen/UploadDokumenScreen';
import ManageFolderScreen   from '../screens/dokumen/ManageFolderScreen';

const Stack = createNativeStackNavigator();

export default function DokumenStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DokumenList"   component={DokumenScreen} />
      <Stack.Screen name="DokumenDetail" component={DokumenDetailScreen} />
      <Stack.Screen
        name="UploadDokumen"
        component={UploadDokumenScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ManageFolder"
        component={ManageFolderScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
