import { apiClient } from './client';

export type ProspekStatus = 'prospek' | 'follow_up' | 'proposal' | 'negosiasi' | 'trial' | 'kontrak' | 'batal';

export type Prospek = {
  id: number;
  milikku: boolean;
  can_edit: boolean;
  has_unread_notif: boolean;
  nama_klien: string;
  alamat: string | null;
  kota: string | null;
  kontak_nama: string | null;
  kontak_email: string | null;
  kontak_hp: string | null;
  status: ProspekStatus;
  status_label: string;
  is_overdue: boolean;
  follow_up_status: 'normal' | 'near' | 'overdue';
  tanggal_pertemuan_pertama: string | null;
  tanggal_pertemuan_terakhir: string | null;
  tanggal_pertemuan_berikutnya: string | null;
  pencatat?: { id: number; nama_lengkap: string; foto: string | null } | null;
  pertemuan?: {
    id: number;
    tanggal: string;
    tanggal_berikutnya: string | null;
    keterangan: string;
  }[];
  jumlah_komentar?: number;
  created_at: string;
  updated_at: string;
};

export type ProspekKomentar = {
  id: number;
  komentar: string;
  parent_id: number | null;
  nama: string;
  foto: string | null;
  created_at: string;
  replies?: ProspekKomentar[];
};

export type ProspekStats = {
  prospek:   number;
  follow_up: number;
  proposal:  number;
  negosiasi: number;
  trial:     number;
  kontrak:   number;
  batal:     number;
  overdue:   number;
};

export type CreateProspekPayload = {
  nama_klien: string;
  alamat?: string;
  kota?: string;
  kontak_nama?: string;
  kontak_email?: string;
  kontak_hp?: string;
  status: ProspekStatus;
  tanggal_pertemuan_pertama?: string;
  tanggal_pertemuan_berikutnya?: string;
};

type Paginated<T> = { data: T[]; meta?: { current_page: number; last_page: number; total: number } };

export const prospekApi = {
  list: async (params?: {
    status?: ProspekStatus;
    kota?: string;
    bulan?: string; // YYYY-MM
    search?: string;
    page?: number;
  }): Promise<Paginated<Prospek>> => {
    const { data } = await apiClient.get('/prospek', { params });
    return data;
  },

  kotaList: async (): Promise<{ data: string[] }> => {
    const { data } = await apiClient.get('/prospek/kota');
    return data;
  },

  stats: async (): Promise<ProspekStats> => {
    const { data } = await apiClient.get('/prospek/stats');
    return data;
  },

  detail: async (id: number): Promise<{ data: Prospek; komentar: { data: ProspekKomentar[] } }> => {
    const { data } = await apiClient.get(`/prospek/${id}`);
    return data;
  },

  create: async (payload: CreateProspekPayload): Promise<{ data: Prospek }> => {
    const { data } = await apiClient.post('/prospek', payload);
    return data;
  },

  update: async (id: number, payload: Partial<CreateProspekPayload>): Promise<{ data: Prospek }> => {
    const { data } = await apiClient.patch(`/prospek/${id}`, payload);
    return data;
  },

  updateStatus: async (id: number, status: ProspekStatus): Promise<{ data: Prospek }> => {
    const { data } = await apiClient.patch(`/prospek/${id}/status`, { status });
    return data;
  },

  destroy: async (id: number) => {
    const { data } = await apiClient.delete(`/prospek/${id}`);
    return data;
  },

  addPertemuan: async (id: number, payload: {
    tanggal: string;
    tanggal_berikutnya?: string;
    keterangan: string;
  }): Promise<{ data: Prospek }> => {
    const { data } = await apiClient.post(`/prospek/${id}/pertemuan`, payload);
    return data;
  },

  destroyPertemuan: async (prospekId: number, pertemuanId: number): Promise<{ data: Prospek }> => {
    const { data } = await apiClient.delete(`/prospek/${prospekId}/pertemuan/${pertemuanId}`);
    return data;
  },

  comment: async (id: number, komentar: string, parentId?: number): Promise<{ data: ProspekKomentar }> => {
    const { data } = await apiClient.post(`/prospek/${id}/komentar`, {
      komentar,
      parent_id: parentId,
    });
    return data;
  },
};
