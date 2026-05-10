import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen        from '../screens/chat/ChatScreen';
import ChatRoomScreen    from '../screens/chat/ChatRoomScreen';
import NewChatScreen     from '../screens/chat/NewChatScreen';
import CreateGroupScreen from '../screens/chat/CreateGroupScreen';

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
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
