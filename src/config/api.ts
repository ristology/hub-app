/**
 * API Base URL Configuration
 *
 * Toggle antara local & production sesuai keperluan dev:
 *   - Local (XAMPP):    http://192.168.18.14/Projectone/public/api/v1
 *   - Production:       https://hub.afresto.id/api/v1
 *
 * Saat ini PAKAI PRODUCTION supaya bisa test push notif iOS dengan akun
 * yang sudah ada di server (tidak perlu password admin local).
 */
export const API_BASE_URL = 'https://hub.afresto.id/api/v1';

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA:  'user_data',
} as const;
