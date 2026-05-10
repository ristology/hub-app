import { apiClient } from './client';

export type RequestStatus = 'menunggu' | 'diterima' | 'proses' | 'selesai' | 'ditolak';

export type ClientRequest = {
  id: number;
  milikku: boolean;
  can_edit: boolean;
  is_it_or_admin: boolean;
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
  gambar_ids?: number[];
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

export type FileAsset = { uri: string; name: string; type: string };

export type CreateRequestPayload = {
  nama_klien: string;
  klien_id?: number | null;
  tanggal_request: string;
  deadline?: string;
  keterangan: string;
  gambar?:  FileAsset[];
  dokumen?: FileAsset[];
};

export type UpdateRequestPayload = Partial<Omit<CreateRequestPayload, 'gambar' | 'dokumen'>> & {
  gambar?:  FileAsset[];
  dokumen?: FileAsset[];
  remove_lampiran_ids?: number[];
};

type Paginated<T> = { data: T[]; meta?: { current_page: number; last_page: number; total: number } };

export const requestApi = {
  list: async (params?: {
    status?: RequestStatus;
    klien?: number;
    dari?: string;   // YYYY-MM-DD
    sampai?: string; // YYYY-MM-DD
    search?: string;
    page?: number;
  }): Promise<Paginated<ClientRequest>> => {
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
    const formData = new FormData();
    formData.append('nama_klien',      payload.nama_klien);
    formData.append('tanggal_request', payload.tanggal_request);
    formData.append('keterangan',      payload.keterangan);
    if (payload.klien_id != null)        formData.append('klien_id', String(payload.klien_id));
    if (payload.deadline)                formData.append('deadline', payload.deadline);

    payload.gambar?.forEach((f, i)  => formData.append(`gambar[${i}]`,  f as any));
    payload.dokumen?.forEach((f, i) => formData.append(`dokumen[${i}]`, f as any));

    const { data } = await apiClient.post('/request', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  update: async (id: number, payload: UpdateRequestPayload): Promise<{ data: ClientRequest }> => {
    const formData = new FormData();
    // Laravel multipart spoofing — POST + _method=PATCH supaya body multipart diparsing.
    formData.append('_method', 'PATCH');

    if (payload.nama_klien      !== undefined) formData.append('nama_klien',      payload.nama_klien);
    if (payload.tanggal_request !== undefined) formData.append('tanggal_request', payload.tanggal_request);
    if (payload.keterangan      !== undefined) formData.append('keterangan',      payload.keterangan);
    if (payload.klien_id        !== undefined) formData.append('klien_id', payload.klien_id != null ? String(payload.klien_id) : '');
    if (payload.deadline        !== undefined) formData.append('deadline', payload.deadline ?? '');

    payload.gambar?.forEach((f, i)              => formData.append(`gambar[${i}]`,  f as any));
    payload.dokumen?.forEach((f, i)             => formData.append(`dokumen[${i}]`, f as any));
    payload.remove_lampiran_ids?.forEach((id, i) => formData.append(`remove_lampiran_ids[${i}]`, String(id)));

    const { data } = await apiClient.post(`/request/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
