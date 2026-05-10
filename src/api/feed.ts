import { apiClient } from './client';

export type Feed = {
  id: number;
  konten: string;
  lokasi: string | null;
  latitude: number | null;
  longitude: number | null;
  kategori: string | null;
  foto_urls: string[];
  foto_ids: number[];
  karyawan: {
    id: number;
    user_id: number | null;
    nama_lengkap: string;
    foto: string | null;
    jabatan: string | null;
  };
  jumlah_like: number;
  jumlah_komentar: number;
  sudah_like: boolean;
  can_edit: boolean;
  has_unread_notif: boolean;
  komentar?: FeedKomentar[];
  created_at: string;
};

export type UpdateFeedPayload = {
  konten?: string;
  lokasi?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  kategori_kegiatan_id?: number | null;
  fotos?: { uri: string; name: string; type: string }[];
  remove_photo_ids?: number[];
  tags?: number[];
};

export type FeedKomentar = {
  id: number;
  parent_id: number | null;
  komentar: string;
  nama: string;
  foto: string;
  created_at: string;
  replies?: FeedKomentar[];
};

type Paginated<T> = {
  data: T[];
  meta?: { current_page: number; last_page: number; total: number };
};

export type Kategori = { id: number; nama: string };

export type CreateFeedPayload = {
  konten: string;
  lokasi?: string;
  latitude?: number;
  longitude?: number;
  kategori_kegiatan_id?: number;
  fotos?: { uri: string; name: string; type: string }[];
  tags?: number[];
};

export type KaryawanRingkas = {
  id: number;
  nama: string;
  jabatan: string | null;
  foto: string | null;
};

export type FeedFilters = {
  search?:      string;
  tanggal?:     string;   // YYYY-MM-DD
  bulan?:       string;   // YYYY-MM
  kategori_id?: number | null;
  karyawan_id?: number | null;
};

export const feedApi = {
  list: async (page = 1, filters: FeedFilters = {}): Promise<Paginated<Feed>> => {
    const params: Record<string, any> = { page };
    if (filters.search?.trim())   params.search      = filters.search.trim();
    if (filters.tanggal)          params.tanggal     = filters.tanggal;
    if (filters.bulan)            params.bulan       = filters.bulan;
    if (filters.kategori_id)      params.kategori_id = filters.kategori_id;
    if (filters.karyawan_id)      params.karyawan_id = filters.karyawan_id;
    const { data } = await apiClient.get('/feed', { params });
    return data;
  },

  kategori: async (): Promise<{ data: Kategori[] }> => {
    const { data } = await apiClient.get('/feed/kategori');
    return data;
  },

  create: async (payload: CreateFeedPayload): Promise<{ data: Feed }> => {
    const formData = new FormData();
    formData.append('konten', payload.konten);
    if (payload.lokasi)                  formData.append('lokasi', payload.lokasi);
    if (payload.latitude  !== undefined) formData.append('latitude',  String(payload.latitude));
    if (payload.longitude !== undefined) formData.append('longitude', String(payload.longitude));
    if (payload.kategori_kegiatan_id)    formData.append('kategori_kegiatan_id', String(payload.kategori_kegiatan_id));

    payload.fotos?.forEach((foto, i) => {
      // FormData expects React Native file shape — TS workaround.
      formData.append(`fotos[${i}]`, foto as any);
    });

    payload.tags?.forEach((id, i) => {
      formData.append(`tags[${i}]`, String(id));
    });

    const { data } = await apiClient.post('/feed', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  detail: async (id: number): Promise<{ data: Feed }> => {
    const { data } = await apiClient.get(`/feed/${id}`);
    return data;
  },

  update: async (id: number, payload: UpdateFeedPayload): Promise<{ data: Feed }> => {
    const formData = new FormData();
    // Laravel method spoofing — PATCH dengan multipart/form-data tidak diparsing,
    // jadi pakai POST + _method=PATCH supaya Laravel route ke handler PATCH.
    formData.append('_method', 'PATCH');

    if (payload.konten !== undefined)               formData.append('konten', payload.konten);
    if (payload.lokasi  !== undefined)              formData.append('lokasi',  payload.lokasi  ?? '');
    if (payload.latitude  !== undefined)            formData.append('latitude',  payload.latitude  !== null ? String(payload.latitude)  : '');
    if (payload.longitude !== undefined)            formData.append('longitude', payload.longitude !== null ? String(payload.longitude) : '');
    if (payload.kategori_kegiatan_id !== undefined) formData.append('kategori_kegiatan_id', payload.kategori_kegiatan_id ? String(payload.kategori_kegiatan_id) : '');

    payload.fotos?.forEach((foto, i) => {
      formData.append(`fotos[${i}]`, foto as any);
    });
    payload.remove_photo_ids?.forEach((pid, i) => {
      formData.append(`remove_photo_ids[${i}]`, String(pid));
    });
    payload.tags?.forEach((tid, i) => {
      formData.append(`tags[${i}]`, String(tid));
    });

    const { data } = await apiClient.post(`/feed/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  destroy: async (id: number): Promise<void> => {
    await apiClient.delete(`/feed/${id}`);
  },

  toggleLike: async (id: number): Promise<{ sudah_like: boolean; jumlah_like: number }> => {
    const { data } = await apiClient.post(`/feed/${id}/like`);
    return data;
  },

  searchKaryawan: async (q: string): Promise<{ data: KaryawanRingkas[] }> => {
    const { data } = await apiClient.get('/feed/karyawan/search', { params: { q } });
    return data;
  },

  comment: async (id: number, komentar: string, parentId?: number): Promise<{ data: FeedKomentar }> => {
    const { data } = await apiClient.post(`/feed/${id}/komentar`, {
      komentar,
      parent_id: parentId,
    });
    return data;
  },
};
