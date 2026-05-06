import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
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
 * Setup channel notif Android (wajib untuk Android 8+).
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

  // Minta permission
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

  // Ambil native token (FCM untuk Android, APNs untuk iOS)
  try {
    const result = await Notifications.getDevicePushTokenAsync();
    return result.data;
  } catch (e) {
    console.error('Gagal ambil device push token:', e);
    return null;
  }
}

/**
 * Register device token ke backend Laravel.
 * Dipanggil setelah user login sukses.
 */
export async function registerDeviceWithBackend(): Promise<void> {
  await setupAndroidChannel();

  const token = await getNativePushToken();
  if (!token) return;

  // Cek apakah token sudah pernah register (skip kalau sama)
  const cached = await SecureStore.getItemAsync(STORAGE_KEY_DEVICE_TOKEN);
  if (cached === token) return;

  const platform   = Platform.OS === 'ios' ? 'ios' : 'android';
  const deviceName = `${Device.brand ?? Platform.OS}-${Device.modelName ?? 'unknown'}`;

  try {
    await deviceApi.register(token, platform, deviceName);
    await SecureStore.setItemAsync(STORAGE_KEY_DEVICE_TOKEN, token);
  } catch (e) {
    console.error('Gagal register device token ke backend:', e);
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
