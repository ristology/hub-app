import { apiClient } from './client';

export type Feed = {
  id: number;
  konten: string;
  lokasi: string | null;
  latitude: number | null;
  longitude: number | null;
  kategori: string | null;
  foto_urls: string[];
  karyawan: {
    id: number;
    nama_lengkap: string;
    foto: string | null;
    jabatan: string | null;
  };
  jumlah_like: number;
  jumlah_komentar: number;
  sudah_like: boolean;
  komentar?: FeedKomentar[];
  created_at: string;
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

export const feedApi = {
  list: async (page = 1): Promise<Paginated<Feed>> => {
    const { data } = await apiClient.get('/feed', { params: { page } });
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
