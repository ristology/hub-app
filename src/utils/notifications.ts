import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { deviceApi } from '../api/device';

const STORAGE_KEY_DEVICE_TOKEN = 'fcm_device_token';

/**
 * Konfigurasi global cara notif tampil saat app foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowAlert:  true,
  }),
});

/**
 * Setup channels notif Android (wajib untuk Android 8+).
 * Channel terpisah supaya bisa beda suara + importance per kategori.
 */
export async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3b82f6',
    sound: 'default',
  });

  // Chat — banner heads-up, suara default (akan diganti custom sound nanti)
  await Notifications.setNotificationChannelAsync('chat', {
    name: 'Pesan Chat',
    description: 'Notifikasi pesan chat masuk',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#3b82f6',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
  });

  // Error Log — importance tinggi karena biasanya urgent
  await Notifications.setNotificationChannelAsync('error-log', {
    name: 'Error Log',
    description: 'Notifikasi laporan error yang ditugaskan ke kamu',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: '#ef4444',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
  });
}

/**
 * Minta permission notif + ambil native FCM/APNs token.
 * Return null kalau:
 *  - bukan physical device (simulator/emulator)
 *  - user deny permission
 *  - error get token
 */
export async function getNativePushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notification hanya jalan di physical device');
    return null;
  }

  // Permission check
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission ditolak');
    return null;
  }

  // Strategy:
  //   Android → getDevicePushTokenAsync (returns FCM token, dikirim via FCM v1 API)
  //   iOS     → getExpoPushTokenAsync   (returns Expo token, dikirim via Expo Push API)
  //
  // Kenapa beda? iOS native getDevicePushTokenAsync return APNs token mentah
  // yang tidak bisa langsung dikirim ke FCM API. Pakai Expo Push API supaya
  // routing ke APNs dilakukan otomatis oleh Expo backend.
  try {
    if (Platform.OS === 'ios') {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId
                     ?? (Constants as any).easConfig?.projectId;
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      return result.data; // format: "ExponentPushToken[xxxxx]"
    }

    const result = await Notifications.getDevicePushTokenAsync();
    return result.data; // format: FCM token
  } catch (e) {
    console.error('Gagal ambil device push token:', e);
    return null;
  }
}

/**
 * Register device token ke backend Laravel.
 * Dipanggil setelah user login sukses + saat app start.
 *
 * SELALU hit API (updateOrCreate di backend, idempotent) — supaya:
 *  - Cache stale tidak block register saat backend kehilangan row (cleanup, switch env)
 *  - last_seen ter-update tiap session → bisa cleanup token lama
 */
export async function registerDeviceWithBackend(): Promise<void> {
  console.warn('[Push] registerDeviceWithBackend start');
  await setupAndroidChannel();

  const token = await getNativePushToken();
  console.warn('[Push] token result:', token ? token.substring(0, 30) + '...' : 'NULL');
  if (!token) {
    console.warn('[Push] Token null — skip register');
    return;
  }

  const platform   = Platform.OS === 'ios' ? 'ios' : 'android';
  const deviceName = `${Device.brand ?? Platform.OS}-${Device.modelName ?? 'unknown'}`;
  console.warn('[Push] POST /device/register | platform=' + platform);

  try {
    await deviceApi.register(token, platform, deviceName);
    await SecureStore.setItemAsync(STORAGE_KEY_DEVICE_TOKEN, token);
    console.warn('[Push] Register sukses');
  } catch (e: any) {
    console.error('[Push] Gagal register:', e.message, e.response?.data);
  }
}

/**
 * Unregister device token dari backend (saat logout).
 */
export async function unregisterDeviceWithBackend(): Promise<void> {
  const token = await SecureStore.getItemAsync(STORAGE_KEY_DEVICE_TOKEN);
  if (!token) return;

  try {
    await deviceApi.unregister(token);
  } catch {
    // ignore — tetap clear local
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY_DEVICE_TOKEN);
}
