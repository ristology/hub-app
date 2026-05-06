import { apiClient } from './client';

export type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'hr' | 'karyawan';
  foto: string | null;
  departemen?: string | null;
};

type LoginResponse = {
  token: string;
  user: User;
};

export const authApi = {
  login: async (email: string, password: string, deviceName: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/login', {
      email,
      password,
      device_name: deviceName,
    });
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/logout');
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/me');
    return data;
  },
};
