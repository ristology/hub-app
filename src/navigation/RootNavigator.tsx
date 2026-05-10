import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../store/auth';
import LoginScreen        from '../screens/auth/LoginScreen';
import BottomTabNavigator from './BottomTabNavigator';
import AppDrawer          from './AppDrawer';
import { AppDrawerProvider } from '../context/AppDrawerContext';
import { navigationRef, setupDeepLinkHandler } from '../utils/deepLink';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { token, isInitializing, bootstrap } = useAuth();

  useEffect(() => {
    bootstrap();
  }, []);

  // Setup deep link handler — listen tap notif & navigate ke detail screen
  useEffect(() => {
    if (!token) return;
    return setupDeepLinkHandler();
  }, [token]);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d1421', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Custom dark theme — pakai warna container Afresto supaya tidak ada
  // flash putih saat transisi navigasi atau saat tab bar hide.
  const theme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0d1421',
      card:       '#0d1421',
    },
  };

  return (
    <AppDrawerProvider>
      <NavigationContainer ref={navigationRef} theme={theme}>
        <View style={{ flex: 1, backgroundColor: '#0d1421' }}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0d1421' },
            }}
          >
            {token
              ? <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
              : <Stack.Screen name="Login"    component={LoginScreen} />
            }
          </Stack.Navigator>

          {/* Side drawer — hanya aktif saat sudah login */}
          {token && <AppDrawer />}
        </View>
      </NavigationContainer>
    </AppDrawerProvider>
  );
}
