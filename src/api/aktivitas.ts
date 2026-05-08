import { apiClient } from './client';

export type Aktivitas = {
  id: number;
  tipe: string;
  judul: string;
  label_tipe: string;
  warna: string;
  model_type: string | null;
  model_id: number | null;
  created_at: string;
};

export type AktivitasTipeStat = {
  tipe: string;
  label: string;
  warna: string;
  count: number;
};

type Paginated<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; total: number };
};

export const aktivitasApi = {
  list: async (params?: {
    tipe?: string;
    dari?: string;
    sampai?: string;
    page?: number;
  }): Promise<Paginated<Aktivitas>> => {
    const { data } = await apiClient.get('/aktivitas', { params });
    return data;
  },

  stats: async (): Promise<{ data: AktivitasTipeStat[] }> => {
    const { data } = await apiClient.get('/aktivitas/stats');
    return data;
  },
};
