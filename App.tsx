import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/Toast';
import { setupReminderChannel } from './src/utils/calendarReminders';

const queryClient = new QueryClient();

// Saat notifikasi diterima dengan app foreground, tetap tampilkan banner + bunyi.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

export default function App() {
  // Setup channel Android sekali saat app mount.
  React.useEffect(() => {
    setupReminderChannel().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </ToastProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
