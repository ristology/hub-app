import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { deviceApi } from '../api/device';

const STORAGE_KEY_DEVICE_TOKEN = 'fcm_device_token';

// Diagnostic mode: tampilkan Alert visible saat register fail / sukses utk
// karyawan dengan flag debug. Diaktifkan via SecureStore key 'push_debug'.
// TEMPORARY — hapus setelah Android push fix verified working di semua HP.
const STORAGE_KEY_PUSH_DEBUG = 'push_debug';

async function isDebugMode(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(STORAGE_KEY_PUSH_DEBUG)) === '1';
  } catch { return false; }
}

/** Toggle debug mode dari profile screen / dev tool. */
export async function setPushDebug(enabled: boolean): Promise<void> {
  if (enabled) await SecureStore.setItemAsync(STORAGE_KEY_PUSH_DEBUG, '1');
  else await SecureStore.deleteItemAsync(STORAGE_KEY_PUSH_DEBUG);
}

// NOTE: setNotificationHandler dipanggil terpusat di App.tsx — JANGAN dipanggil
// di sini (modul-level side effect dengan property deprecated `shouldShowAlert`
// menyebabkan silent fail di Android SDK 54).

/**
 * Setup channels notif Android (wajib untuk Android 8+).
 * Channel terpisah supaya bisa beda suara + importance per kategori.
 *
 * **Idempotent**: aman dipanggil berulang. Channel sticky setelah pertama dibuat.
 * Dipanggil dari App.tsx saat startup (tidak menunggu login), supaya channel
 * sudah siap menerima push begitu push pertama tiba — bahkan kalau registrasi
 * device token gagal.
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

  // Chat — banner heads-up, sound default HP (user pilih custom HP sendiri kalau mau)
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
    sound: 'afresto_error.wav',
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
 *
 * Return object { ok, message, tokenPreview } untuk caller bisa show feedback.
 */
export async function registerDeviceWithBackend(): Promise<{
  ok: boolean;
  message: string;
  tokenPreview?: string;
  step?: string;
}> {
  const debug = await isDebugMode();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  console.warn('[Push] registerDeviceWithBackend start');

  // Step 1: setup channels
  try {
    await setupAndroidChannel();
  } catch (e: any) {
    const result = { ok: false, step: 'channel', message: `Setup channel gagal: ${e.message}` };
    console.error('[Push]', result);
    if (debug) Alert.alert('Push DEBUG — Step 1', result.message);
    return result;
  }

  // Step 2: cek physical device
  if (!Device.isDevice) {
    const result = { ok: false, step: 'device', message: 'Bukan physical device — simulator/emulator tidak support push' };
    console.warn('[Push]', result);
    if (debug) Alert.alert('Push DEBUG — Step 2', result.message);
    return result;
  }

  // Step 3: permission
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      const result = { ok: false, step: 'permission', message: `Permission ${finalStatus} — buka Settings → Apps → Afresto HUB → Notifications` };
      console.warn('[Push]', result);
      if (debug) Alert.alert('Push DEBUG — Step 3', result.message);
      return result;
    }
  } catch (e: any) {
    const result = { ok: false, step: 'permission', message: `Permission check gagal: ${e.message}` };
    console.error('[Push]', result);
    if (debug) Alert.alert('Push DEBUG — Step 3', result.message);
    return result;
  }

  // Step 4: ambil native push token
  let token: string | null = null;
  try {
    if (Platform.OS === 'ios') {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId
                     ?? (Constants as any).easConfig?.projectId;
      const r = await Notifications.getExpoPushTokenAsync({ projectId });
      token = r.data;
    } else {
      const r = await Notifications.getDevicePushTokenAsync();
      token = r.data;
    }
  } catch (e: any) {
    const result = { ok: false, step: 'token', message: `getDevicePushTokenAsync gagal: ${e.message ?? e}. FCM/google-services issue?` };
    console.error('[Push]', result);
    if (debug) Alert.alert('Push DEBUG — Step 4', result.message);
    return result;
  }

  if (!token) {
    const result = { ok: false, step: 'token', message: 'Token kosong dari native API' };
    console.warn('[Push]', result);
    if (debug) Alert.alert('Push DEBUG — Step 4', result.message);
    return result;
  }

  const tokenPreview = token.substring(0, 30) + '...';
  console.warn('[Push] token:', tokenPreview);

  // Step 5: POST ke backend
  const deviceName = `${Device.brand ?? Platform.OS}-${Device.modelName ?? 'unknown'}`;
  try {
    await deviceApi.register(token, platform, deviceName);
    await SecureStore.setItemAsync(STORAGE_KEY_DEVICE_TOKEN, token);
    const result = { ok: true, step: 'done', message: `Register sukses (${platform} / ${deviceName})`, tokenPreview };
    console.warn('[Push]', result);
    if (debug) Alert.alert('Push DEBUG — OK ✓', `${result.message}\n\nToken: ${tokenPreview}`);
    return result;
  } catch (e: any) {
    const errMsg = e.response?.data?.message ?? e.message ?? 'unknown';
    const status = e.response?.status ?? '?';
    const result = { ok: false, step: 'api', message: `POST /device/register gagal (${status}): ${errMsg}`, tokenPreview };
    console.error('[Push]', result);
    if (debug) Alert.alert('Push DEBUG — Step 5', `${result.message}\n\nToken: ${tokenPreview}`);
    return result;
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
