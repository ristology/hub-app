import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, STORAGE_KEYS } from '../config/api';

/**
 * Axios instance untuk semua API calls.
 * Auto-attach Bearer token dari SecureStore.
 *
 * Timeout strategy (dua-tier):
 *  - Default: 30s — cover JSON request normal (login, list, detail, dll).
 *  - FormData (upload file): 90s — screenshot iPhone bisa 5-10MB, backend
 *    masih perlu process (HEIC convert via heif-convert + ImageMagick
 *    resize). 15s lama tidak cukup → client timeout duluan, backend
 *    sebenarnya complete & data masuk, tapi user lihat "Gagal kirim".
 *    Bug ini muncul saat share-to-HUB foto besar dari Photos iPhone.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // FormData = file upload → override timeout 90s
  if (config.data instanceof FormData) {
    config.timeout = 90000;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
    }
    return Promise.reject(error);
  }
);
