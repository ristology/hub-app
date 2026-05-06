import { apiClient } from './client';

export const deviceApi = {
  register: async (token: string, platform: 'android' | 'ios', deviceName?: string) => {
    const { data } = await apiClient.post('/device/register', {
      token,
      platform,
      device_name: deviceName,
    });
    return data;
  },

  unregister: async (token: string) => {
    const { data } = await apiClient.post('/device/unregister', { token });
    return data;
  },
};
