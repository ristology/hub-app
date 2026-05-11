import { apiClient } from './client';

export type ProfileKaryawan = {
  id: number;
  nip: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  umur: number | null;
  alamat: string | null;
  no_telp: string | null;
  email: string | null;
  foto_url: string;
  agama: string | null;
  status_perkawinan: string | null;
  pendidikan_terakhir: string | null;
  departemen: string | null;
  jabatan: string | null;
  golongan: string | null;
  status: string;
  tanggal_masuk: string | null;
  bio: string | null;
};

export type ProfileResponse = {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
  };
  karyawan: ProfileKaryawan | null;
};

export const profileApi = {
  show: async (): Promise<ProfileResponse> => {
    const { data } = await apiClient.get('/me/profile');
    return data;
  },

  /** Upload foto profile. Pass { uri, name, type } compatible dengan FormData RN. */
  updateFoto: async (foto: { uri: string; name: string; type: string }): Promise<{ foto_url: string }> => {
    const form = new FormData();
    form.append('foto', foto as any);
    const { data } = await apiClient.post('/me/foto', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  ubahPassword: async (payload: {
    password_lama: string;
    password_baru: string;
    password_baru_confirmation: string;
  }): Promise<{ message: string }> => {
    const { data } = await apiClient.post('/me/ubah-password', payload);
    return data;
  },
};
