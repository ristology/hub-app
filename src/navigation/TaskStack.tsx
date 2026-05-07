import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TaskScreen        from '../screens/task/TaskScreen';
import TaskDetailScreen  from '../screens/task/TaskDetailScreen';
import CreateTaskScreen  from '../screens/task/CreateTaskScreen';

const Stack = createNativeStackNavigator();

export default function TaskStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TaskList"   component={TaskScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen
        name="CreateTask"
        component={CreateTaskScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
