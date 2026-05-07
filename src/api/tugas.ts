import { apiClient } from './client';
import type { KaryawanRingkas } from './feed';

export type TugasStatus    = 'belum' | 'proses' | 'selesai';
export type TugasPrioritas = 'rendah' | 'sedang' | 'tinggi';

export type Tugas = {
  id: number;
  judul: string;
  deskripsi: string | null;
  prioritas: TugasPrioritas;
  status: TugasStatus;
  status_label: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  karyawan?: {
    id: number | null;
    nama_lengkap: string | null;
    foto: string | null;
  };
  dibuat_oleh?: {
    id: number | null;
    nama: string | null;
  };
  tags?: { id: number; nama_lengkap: string; foto: string | null }[];
  created_at: string;
  updated_at: string;
};

export type TugasStats = {
  belum:   number;
  proses:  number;
  selesai: number;
};

type Paginated<T> = { data: T[]; meta?: { current_page: number; last_page: number; total: number } };

export type CreateTugasPayload = {
  judul: string;
  deskripsi?: string;
  prioritas: TugasPrioritas;
  status: TugasStatus;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  karyawan_id?: number;
  tags?: number[];
};

export const tugasApi = {
  list: async (params?: { search?: string; status?: TugasStatus; prioritas?: TugasPrioritas; page?: number }): Promise<Paginated<Tugas>> => {
    const { data } = await apiClient.get('/tugas', { params });
    return data;
  },

  stats: async (): Promise<TugasStats> => {
    const { data } = await apiClient.get('/tugas/stats');
    return data;
  },

  detail: async (id: number): Promise<{ data: Tugas }> => {
    const { data } = await apiClient.get(`/tugas/${id}`);
    return data;
  },

  create: async (payload: CreateTugasPayload): Promise<{ data: Tugas }> => {
    const { data } = await apiClient.post('/tugas', payload);
    return data;
  },

  update: async (id: number, payload: Partial<CreateTugasPayload>): Promise<{ data: Tugas }> => {
    const { data } = await apiClient.patch(`/tugas/${id}`, payload);
    return data;
  },

  updateStatus: async (id: number, status: TugasStatus): Promise<{ data: Tugas }> => {
    const { data } = await apiClient.patch(`/tugas/${id}/status`, { status });
    return data;
  },

  destroy: async (id: number) => {
    const { data } = await apiClient.delete(`/tugas/${id}`);
    return data;
  },

  searchKaryawan: async (q: string): Promise<{ data: KaryawanRingkas[] }> => {
    const { data } = await apiClient.get('/tugas/karyawan/search', { params: { q } });
    return data;
  },
};
