import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../store/auth';
import LoginScreen from '../screens/auth/LoginScreen';
import HomeScreen  from '../screens/home/HomeScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { token, isInitializing, bootstrap } = useAuth();

  useEffect(() => {
    bootstrap();
  }, []);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d1421', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token
          ? <Stack.Screen name="Home"  component={HomeScreen} />
          : <Stack.Screen name="Login" component={LoginScreen} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  );
}
