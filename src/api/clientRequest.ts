import { apiClient } from './client';

export type RequestStatus = 'menunggu' | 'diterima' | 'proses' | 'selesai' | 'ditolak';

export type ClientRequest = {
  id: number;
  nama_klien: string;
  klien_id: number | null;
  tanggal_request: string | null;
  deadline: string | null;
  keterangan: string;
  status: RequestStatus;
  status_label: string;
  deadline_status: 'normal' | 'near' | 'overdue';
  alasan_tolak: string | null;
  pencatat?: { id: number; nama_lengkap: string; foto: string | null } | null;
  pic?: { id: number; nama_lengkap: string; foto: string | null } | null;
  gambar_urls?: string[];
  dokumen?: { id: number; nama: string; url: string; ukuran: number }[];
  respon?: {
    id: number;
    catatan: string;
    status_sebelum: string;
    status_sesudah: string;
    user: { id: number; nama: string; foto: string | null } | null;
    created_at: string;
  }[];
  jumlah_komentar?: number;
  jumlah_lampiran?: number;
  created_at: string;
  updated_at: string;
};

export type RequestKomentar = {
  id: number;
  komentar: string;
  parent_id: number | null;
  nama: string;
  foto: string | null;
  created_at: string;
  replies?: RequestKomentar[];
};

export type RequestStats = {
  menunggu: number;
  diterima: number;
  proses:   number;
  selesai:  number;
  ditolak:  number;
  overdue:  number;
};

export type KlienRingkas = { id: number; nama: string };
export type PicRingkas   = { user_id: number; nama: string; foto: string | null };

export type CreateRequestPayload = {
  nama_klien: string;
  klien_id?: number | null;
  tanggal_request: string;
  deadline?: string;
  keterangan: string;
};

type Paginated<T> = { data: T[]; meta?: { current_page: number; last_page: number; total: number } };

export const requestApi = {
  list: async (params?: { status?: RequestStatus; search?: string; page?: number }): Promise<Paginated<ClientRequest>> => {
    const { data } = await apiClient.get('/request', { params });
    return data;
  },

  stats: async (): Promise<RequestStats> => {
    const { data } = await apiClient.get('/request/stats');
    return data;
  },

  searchKlien: async (q: string): Promise<{ data: KlienRingkas[] }> => {
    const { data } = await apiClient.get('/request/klien/search', { params: { q } });
    return data;
  },

  listPic: async (): Promise<{ data: PicRingkas[] }> => {
    const { data } = await apiClient.get('/request/pic');
    return data;
  },

  detail: async (id: number): Promise<{
    data: ClientRequest;
    is_it_admin: boolean;
    komentar: { data: RequestKomentar[] };
  }> => {
    const { data } = await apiClient.get(`/request/${id}`);
    return data;
  },

  create: async (payload: CreateRequestPayload): Promise<{ data: ClientRequest }> => {
    const { data } = await apiClient.post('/request', payload);
    return data;
  },

  destroy: async (id: number) => {
    const { data } = await apiClient.delete(`/request/${id}`);
    return data;
  },

  terima: async (id: number, picUserId: number): Promise<{ data: ClientRequest }> => {
    const { data } = await apiClient.post(`/request/${id}/terima`, { pic_id: picUserId });
    return data;
  },

  tolak: async (id: number, alasan: string): Promise<{ data: ClientRequest }> => {
    const { data } = await apiClient.post(`/request/${id}/tolak`, { alasan });
    return data;
  },

  selesai: async (id: number): Promise<{ data: ClientRequest }> => {
    const { data } = await apiClient.post(`/request/${id}/selesai`);
    return data;
  },

  respon: async (id: number, payload: {
    catatan: string;
    pic_id?: number;
    proses?: boolean;
  }): Promise<{ data: ClientRequest }> => {
    const { data } = await apiClient.post(`/request/${id}/respon`, payload);
    return data;
  },

  comment: async (id: number, komentar: string, parentId?: number): Promise<{ data: RequestKomentar }> => {
    const { data } = await apiClient.post(`/request/${id}/komentar`, {
      komentar,
      parent_id: parentId,
    });
    return data;
  },
};
