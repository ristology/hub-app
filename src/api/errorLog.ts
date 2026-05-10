import { apiClient } from './client';

export type ErrorLogStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type ErrorLog = {
  id: number;
  milikku: boolean;
  can_edit: boolean;
  can_update_status: boolean;
  url: string | null;
  username: string | null;
  password: string | null;
  keterangan: string;
  status: ErrorLogStatus;
  status_label: string;
  status_color: string;
  catatan_penanganan: string | null;
  resolved_at: string | null;
  klien?: { id: number; nama: string } | null;
  kategori?: { id: number; nama: string } | null;
  pelapor?: { id: number; nama_lengkap: string; foto: string | null } | null;
  handler?: { id: number; nama_lengkap: string; foto: string | null } | null;
  foto_urls?: string[];
  foto_ids?: number[];
  jumlah_komentar?: number;
  created_at: string;
  updated_at: string;
};

export type ErrorLogKomentar = {
  id: number;
  komentar: string;
  parent_id: number | null;
  nama: string;
  foto: string | null;
  created_at: string;
  replies?: ErrorLogKomentar[];
};

export type ErrorLogStats = {
  open:        number;
  in_progress: number;
  resolved:    number;
  closed:      number;
};

export type KategoriError = { id: number; nama: string };
export type KlienOption   = { id: number; nama: string };

export type CreateErrorLogPayload = {
  klien_id?: number;
  url?: string;
  username?: string;
  password?: string;
  keterangan: string;
  kategori_error_id: number;
  fotos?: { uri: string; name: string; type: string }[];
};

export type UpdateErrorLogPayload = {
  klien_id?: number | null;
  url?: string | null;
  username?: string | null;
  password?: string | null;
  keterangan?: string;
  kategori_error_id?: number;
  fotos?: { uri: string; name: string; type: string }[];
  remove_photo_ids?: number[];
};

type Paginated<T> = { data: T[]; meta?: { current_page: number; last_page: number; total: number } };

export const errorLogApi = {
  list: async (params?: {
    status?: ErrorLogStatus;
    kategori?: number;
    klien?: number;
    search?: string;
    page?: number;
  }): Promise<Paginated<ErrorLog>> => {
    const { data } = await apiClient.get('/error-log', { params });
    return data;
  },

  stats: async (): Promise<ErrorLogStats> => {
    const { data } = await apiClient.get('/error-log/stats');
    return data;
  },

  kategori: async (): Promise<{ data: KategoriError[] }> => {
    const { data } = await apiClient.get('/error-log/kategori');
    return data;
  },

  klien: async (): Promise<{ data: KlienOption[] }> => {
    const { data } = await apiClient.get('/error-log/klien');
    return data;
  },

  detail: async (id: number): Promise<{
    data: ErrorLog;
    komentar: { data: ErrorLogKomentar[] };
  }> => {
    const { data } = await apiClient.get(`/error-log/${id}`);
    return data;
  },

  create: async (payload: CreateErrorLogPayload): Promise<{ data: ErrorLog }> => {
    const formData = new FormData();
    formData.append('keterangan', payload.keterangan);
    formData.append('kategori_error_id', String(payload.kategori_error_id));

    if (payload.klien_id) formData.append('klien_id', String(payload.klien_id));
    if (payload.url)      formData.append('url', payload.url);
    if (payload.username) formData.append('username', payload.username);
    if (payload.password) formData.append('password', payload.password);

    payload.fotos?.forEach((foto, i) => {
      formData.append(`fotos[${i}]`, foto as any);
    });

    const { data } = await apiClient.post('/error-log', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  update: async (id: number, payload: UpdateErrorLogPayload): Promise<{ data: ErrorLog }> => {
    const formData = new FormData();
    // Laravel multipart spoofing — POST + _method=PATCH supaya body multipart diparsing.
    formData.append('_method', 'PATCH');

    if (payload.klien_id          !== undefined) formData.append('klien_id',          payload.klien_id ? String(payload.klien_id) : '');
    if (payload.kategori_error_id !== undefined) formData.append('kategori_error_id', String(payload.kategori_error_id));
    if (payload.keterangan        !== undefined) formData.append('keterangan',        payload.keterangan);
    if (payload.url               !== undefined) formData.append('url',               payload.url      ?? '');
    if (payload.username          !== undefined) formData.append('username',          payload.username ?? '');
    if (payload.password          !== undefined) formData.append('password',          payload.password ?? '');

    payload.fotos?.forEach((foto, i) => {
      formData.append(`fotos[${i}]`, foto as any);
    });
    payload.remove_photo_ids?.forEach((pid, i) => {
      formData.append(`remove_photo_ids[${i}]`, String(pid));
    });

    const { data } = await apiClient.post(`/error-log/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  updateStatus: async (id: number, status: ErrorLogStatus, catatan?: string): Promise<{ data: ErrorLog }> => {
    const { data } = await apiClient.patch(`/error-log/${id}/status`, {
      status,
      catatan_penanganan: catatan,
    });
    return data;
  },

  destroy: async (id: number) => {
    const { data } = await apiClient.delete(`/error-log/${id}`);
    return data;
  },

  comment: async (id: number, komentar: string, parentId?: number): Promise<{ data: ErrorLogKomentar }> => {
    const { data } = await apiClient.post(`/error-log/${id}/komentar`, {
      komentar,
      parent_id: parentId,
    });
    return data;
  },
};
