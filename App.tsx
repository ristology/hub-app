import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/Toast';
import { setupReminderChannel } from './src/utils/calendarReminders';
import { setupAndroidChannel } from './src/utils/notifications';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';

// Tahan native splash sampai JS siap — hide manual di useEffect bawah.
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

// Saat notifikasi diterima dengan app foreground, tetap tampilkan banner + bunyi.
// SUMBER TUNGGAL — JANGAN setNotificationHandler di file lain (modul-level
// double call dgn property deprecated bisa menyebabkan silent fail Android).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // Sembunyikan native splash → animated overlay yang ambil alih.
    SplashScreen.hideAsync().catch(() => {});

    // Setup Android notification channels SEKARANG (tidak tunggu login).
    // Channel WAJIB ada sebelum push pertama tiba; kalau belum ada, Android 8+
    // drop notif diam-diam. Idempotent — aman kalau dipanggil ulang.
    setupAndroidChannel().catch((e) => console.warn('[Push] setupAndroidChannel:', e));
    setupReminderChannel().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="light" />
          {/* RootNavigator selalu render di bawah; overlay menutupinya sampai animasi selesai */}
          <RootNavigator />
          {!splashDone && (
            <AnimatedSplashScreen onFinish={() => setSplashDone(true)} />
          )}
        </ToastProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
