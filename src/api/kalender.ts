import { apiClient } from './client';

export type KategoriKegiatan =
  | 'kegiatan' | 'rapat' | 'deadline' | 'cuti' | 'lembur' | 'ujian_sekolah' | 'lainnya';

export type Visibilitas = 'private' | 'tim' | 'publik';
export type RsvpStatus  = 'menunggu' | 'diterima' | 'ditolak';

export type Peserta = {
  karyawan_id: number;
  nama: string;
  foto: string | null;
  status: RsvpStatus;
  is_me: boolean;
};

export type Kegiatan = {
  id: number;
  judul: string;
  deskripsi: string | null;
  lokasi: string | null;
  mulai_at: string;
  selesai_at: string;
  seharian: boolean;
  kategori: KategoriKegiatan;
  visibilitas: Visibilitas;
  warna: string;
  tugas_id: number | null;
  readonly: boolean;
  milikku: boolean;
  pembuat?: { id: number; nama: string; foto: string | null } | null;
  peserta?: Peserta[];
  created_at: string;
  updated_at: string;
};

export type KalenderStats = {
  hari_ini:   number;
  minggu_ini: number;
  mendatang:  number;
};

export type KaryawanRingkas = {
  id: number;
  nama: string;
  jabatan: string | null;
  foto: string | null;
};

export type CreateKegiatanPayload = {
  judul: string;
  deskripsi?: string;
  lokasi?: string;
  mulai_at: string;        // ISO datetime
  selesai_at: string;      // ISO datetime
  seharian?: boolean;
  kategori: KategoriKegiatan;
  visibilitas: Visibilitas;
  warna?: string;
  peserta?: number[];      // karyawan ids
};

export const kalenderApi = {
  list: async (params?: { start?: string; end?: string }): Promise<{ data: Kegiatan[] }> => {
    const { data } = await apiClient.get('/kalender', { params });
    return data;
  },

  stats: async (): Promise<KalenderStats> => {
    const { data } = await apiClient.get('/kalender/stats');
    return data;
  },

  detail: async (id: number): Promise<{ data: Kegiatan }> => {
    const { data } = await apiClient.get(`/kalender/${id}`);
    return data;
  },

  create: async (payload: CreateKegiatanPayload): Promise<{ data: Kegiatan }> => {
    const { data } = await apiClient.post('/kalender', payload);
    return data;
  },

  update: async (id: number, payload: Partial<CreateKegiatanPayload>): Promise<{ data: Kegiatan }> => {
    const { data } = await apiClient.patch(`/kalender/${id}`, payload);
    return data;
  },

  destroy: async (id: number) => {
    const { data } = await apiClient.delete(`/kalender/${id}`);
    return data;
  },

  rsvp: async (id: number, status: 'diterima' | 'ditolak'): Promise<{ data: Kegiatan }> => {
    const { data } = await apiClient.post(`/kalender/${id}/rsvp`, { status });
    return data;
  },

  searchKaryawan: async (q: string): Promise<{ data: KaryawanRingkas[] }> => {
    const { data } = await apiClient.get('/kalender/karyawan/search', { params: { q } });
    return data;
  },
};
