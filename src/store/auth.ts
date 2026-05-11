import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi, type User } from '../api/auth';
import { STORAGE_KEYS } from '../config/api';
import { registerDeviceWithBackend, unregisterDeviceWithBackend } from '../utils/notifications';

type AuthState = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitializing: boolean;

  login:    (email: string, password: string, deviceName: string) => Promise<void>;
  logout:   () => Promise<void>;
  bootstrap: () => Promise<void>;
  setUserFoto: (foto: string | null) => void;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitializing: true,

  login: async (email, password, deviceName) => {
    set({ isLoading: true });
    try {
      const { token, user } = await authApi.login(email, password, deviceName);
      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
      await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      set({ user, token, isLoading: false });

      console.warn('[Auth] login sukses, panggil registerDeviceWithBackend...');
      registerDeviceWithBackend()
        .then(() => console.warn('[Auth] registerDeviceWithBackend selesai'))
        .catch((e) => console.warn('[Auth] registerDeviceWithBackend gagal:', e));
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    // Unregister FCM token dulu sebelum hapus auth (butuh Bearer token aktif)
    await unregisterDeviceWithBackend().catch(() => {});

    try {
      await authApi.logout();
    } catch {
      // ignore — tetap hapus token lokal walaupun API gagal
    }
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
    set({ user: null, token: null });
  },

  setUserFoto: (foto) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, foto };
    SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(updated)).catch(() => {});
    set({ user: updated });
  },

  bootstrap: async () => {
    const token   = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    const userRaw = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);

    if (token && userRaw) {
      set({ token, user: JSON.parse(userRaw), isInitializing: false });

      // Re-register FCM token (token bisa berubah / device baru install)
      registerDeviceWithBackend().catch(() => {});

      // Refresh user dari backend supaya field baru (mis. karyawan_id) ikut terisi
      // bagi user lama yang sudah login sebelum field tsb ditambahkan.
      authApi.me()
        .then(async (fresh) => {
          await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(fresh));
          set({ user: fresh });
        })
        .catch(() => { /* offline / 401 ditangani interceptor */ });
    } else {
      set({ isInitializing: false });
    }
  },
}));
