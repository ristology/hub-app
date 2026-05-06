import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi, type User } from '../api/auth';
import { STORAGE_KEYS } from '../config/api';

type AuthState = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitializing: boolean;

  login:    (email: string, password: string, deviceName: string) => Promise<void>;
  logout:   () => Promise<void>;
  bootstrap: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
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
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore — tetap hapus token lokal walaupun API gagal
    }
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
    set({ user: null, token: null });
  },

  bootstrap: async () => {
    const token   = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    const userRaw = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);

    if (token && userRaw) {
      set({ token, user: JSON.parse(userRaw), isInitializing: false });
    } else {
      set({ isInitializing: false });
    }
  },
}));
