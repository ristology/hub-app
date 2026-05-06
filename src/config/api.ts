/**
 * API Base URL Configuration
 *
 * Saat develop: HP akses Laravel di laptop via LAN IP, bukan localhost.
 * - localhost di HP = HP sendiri, bukan laptop
 * - 192.168.18.14 = IP LAN laptop (cek dengan `ipconfig`)
 *
 * Saat production: ganti ke domain server, contoh:
 *   https://hub.afresto.id/api/v1
 */
export const API_BASE_URL = 'http://192.168.18.14/Projectone/public/api/v1';

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA:  'user_data',
} as const;
