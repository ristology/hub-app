import { apiClient } from './client';

export type PerformanceJenis = 'appointment' | 'kontrak';

export type PerformanceItem = {
  id: number;
  jenis: PerformanceJenis;
  jenis_label: string;
  nama_klien: string;
  tanggal: string | null;
  keterangan: string | null;
  tanggal_mulai_kontrak: string | null;
  tanggal_berakhir_kontrak: string | null;
  nilai_kontrak: string | null;          // hanya tampil untuk Keuangan/Admin
  can_see_nilai: boolean;
  milikku: boolean;
  pic?: { id: number; nama: string; foto: string | null } | null;
  referral?: { id: number; nama: string; foto: string | null } | null;
  pembuat?: { id: number; nama_lengkap: string } | null;
  created_at: string;
  updated_at: string;
};

export type PerformanceStats = {
  tahun: number;
  total_appointment: number;
  total_kontrak: number;
  appointment_chart: number[];   // 12 bulan
  kontrak_chart: number[];
};

export type KaryawanRingkas = {
  id: number;
  nama: string;
  jabatan: string | null;
  foto: string | null;
};

export type CreatePerformancePayload = {
  jenis: PerformanceJenis;
  nama_klien: string;
  pic_id: number;
  referral_karyawan_id?: number | null;
  tanggal: string;
  keterangan?: string;
  tanggal_mulai_kontrak?: string;
  tanggal_berakhir_kontrak?: string;
  nilai_kontrak?: number | null;
};

type Paginated<T> = { data: T[]; meta?: { current_page: number; last_page: number; total: number } };

export const performanceApi = {
  list: async (params?: {
    jenis?: PerformanceJenis;
    bulan?: number;
    tahun?: number;
    pic_id?: number;
    search?: string;
    page?: number;
  }): Promise<Paginated<PerformanceItem>> => {
    const { data } = await apiClient.get('/performance', { params });
    return data;
  },

  stats: async (tahun?: number): Promise<PerformanceStats> => {
    const { data } = await apiClient.get('/performance/stats', { params: tahun ? { tahun } : {} });
    return data;
  },

  searchKaryawan: async (q: string): Promise<{ data: KaryawanRingkas[] }> => {
    const { data } = await apiClient.get('/performance/karyawan/search', { params: { q } });
    return data;
  },

  detail: async (id: number): Promise<{ data: PerformanceItem }> => {
    const { data } = await apiClient.get(`/performance/${id}`);
    return data;
  },

  create: async (payload: CreatePerformancePayload): Promise<{ data: PerformanceItem }> => {
    const { data } = await apiClient.post('/performance', payload);
    return data;
  },

  update: async (id: number, payload: CreatePerformancePayload): Promise<{ data: PerformanceItem }> => {
    const { data } = await apiClient.patch(`/performance/${id}`, payload);
    return data;
  },

  destroy: async (id: number) => {
    const { data } = await apiClient.delete(`/performance/${id}`);
    return data;
  },
};
