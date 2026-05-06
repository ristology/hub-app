import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FeedScreen       from '../screens/feed/FeedScreen';
import FeedDetailScreen from '../screens/feed/FeedDetailScreen';
import CreateFeedScreen from '../screens/feed/CreateFeedScreen';

const Stack = createNativeStackNavigator();

export default function FeedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedList"   component={FeedScreen} />
      <Stack.Screen name="FeedDetail" component={FeedDetailScreen} />
      <Stack.Screen
        name="CreateFeed"
        component={CreateFeedScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
