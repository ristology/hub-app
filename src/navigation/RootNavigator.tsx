import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../store/auth';
import LoginScreen        from '../screens/auth/LoginScreen';
import BottomTabNavigator from './BottomTabNavigator';
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

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token
          ? <Stack.Screen name="Main"  component={BottomTabNavigator} />
          : <Stack.Screen name="Login" component={LoginScreen} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  );
}
