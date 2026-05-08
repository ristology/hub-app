import { apiClient } from './client';

export type DokumenTipe = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'image' | 'lainnya';

export type Dokumen = {
  id: number;
  judul: string;
  deskripsi: string | null;
  kategori: string;
  tipe: DokumenTipe;
  file_nama_asli: string;
  file_url: string;
  ukuran: number;
  ukuran_format: string;
  jumlah_unduhan: number;
  folder_id: number | null;
  milikku: boolean;
  can_delete: boolean;
  pengunggah?: { id: number; nama_lengkap: string; foto: string | null } | null;
  folder?: { id: number; nama: string; warna: string } | null;
  created_at: string;
  updated_at: string;
};

export type DokumenFolder = {
  id: number;
  nama: string;
  warna: string;
  jumlah_dokumen: number;
};

export type DokumenMeta = {
  kategori_list: string[];
  tipe_list: { key: string; label: string }[];
};

type Paginated<T> = {
  data: T[];
  meta?: { current_page: number; last_page: number; total: number };
};

export const dokumenApi = {
  list: async (params?: {
    folder_id?: number | null;
    search?: string;
    kategori?: string;
    tipe?: string;
    page?: number;
  }): Promise<Paginated<Dokumen>> => {
    const { data } = await apiClient.get('/dokumen', { params });
    return data;
  },

  folders: async (): Promise<{ data: DokumenFolder[]; warna_list: string[] }> => {
    const { data } = await apiClient.get('/dokumen/folders');
    return data;
  },

  meta: async (): Promise<DokumenMeta> => {
    const { data } = await apiClient.get('/dokumen/meta');
    return data;
  },

  detail: async (id: number): Promise<{ data: Dokumen }> => {
    const { data } = await apiClient.get(`/dokumen/${id}`);
    return data;
  },

  upload: async (payload: {
    judul: string;
    deskripsi?: string;
    kategori: string;
    folder_id?: number | null;
    file: { uri: string; name: string; type: string };
  }): Promise<{ data: Dokumen }> => {
    const form = new FormData();
    form.append('judul', payload.judul);
    if (payload.deskripsi) form.append('deskripsi', payload.deskripsi);
    form.append('kategori', payload.kategori);
    if (payload.folder_id) form.append('folder_id', String(payload.folder_id));
    // @ts-expect-error - RN FormData expects {uri, name, type}
    form.append('file', { uri: payload.file.uri, name: payload.file.name, type: payload.file.type });
    const { data } = await apiClient.post('/dokumen', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  trackDownload: async (id: number) => {
    const { data } = await apiClient.post(`/dokumen/${id}/track-download`);
    return data;
  },

  move: async (id: number, folderId: number | null): Promise<{ data: Dokumen }> => {
    const { data } = await apiClient.patch(`/dokumen/${id}/move`, { folder_id: folderId });
    return data;
  },

  destroy: async (id: number) => {
    const { data } = await apiClient.delete(`/dokumen/${id}`);
    return data;
  },

  // Folder management
  createFolder: async (nama: string, warna: string): Promise<{ data: DokumenFolder }> => {
    const { data } = await apiClient.post('/dokumen/folders', { nama, warna });
    return data;
  },

  updateFolder: async (id: number, payload: { nama?: string; warna?: string }) => {
    const { data } = await apiClient.patch(`/dokumen/folders/${id}`, payload);
    return data;
  },

  destroyFolder: async (id: number) => {
    const { data } = await apiClient.delete(`/dokumen/folders/${id}`);
    return data;
  },
};
