import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen     from '../screens/chat/ChatScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import NewChatScreen  from '../screens/chat/NewChatScreen';

const Stack = createNativeStackNavigator();

export default function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatList"  component={ChatScreen} />
      <Stack.Screen name="ChatRoom"  component={ChatRoomScreen} />
      <Stack.Screen
        name="NewChat"
        component={NewChatScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
