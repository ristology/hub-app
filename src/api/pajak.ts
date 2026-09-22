import { apiClient } from './client';
import type { KlienRingkas } from '../components/KlienSearchBar';

export type PajakStatus = 'unpaid' | 'paid';
export type PpnMode = 'eksklusif' | 'inklusif';

/** Filter status di UI — 'terlambat' dihitung server dari periode + status */
export type PajakStatusFilter = 'paid' | 'belum' | 'terlambat';

export type Pajak = {
  id: number;
  dpp: number;
  nominal_pajak: number;
  ppn_mode: PpnMode;
  ppn_mode_label: string;
  bulan: number;
  tahun: number;
  bulan_nama: string;
  keterangan: string | null;

  status_bayar: PajakStatus;
  status_label: string;
  is_terlambat: boolean;
  tanggal_bayar: string | null;

  faktur_pajak: string | null;
  ebilling_pajak: string | null;
  bukti_bayar_pajak: string | null;
  dokumen_lengkap: boolean;

  klien?: { id: number; nama: string } | null;
  invoice?: {
    id: number;
    no_invoice: string;
    status_bayar: string;
    view_url: string;
  } | null;

  created_at: string;
  updated_at: string;
};

export type PajakStats = {
  total_dpp: number;
  total_pajak: number;
  jumlah: number;
  count_paid: number;
  count_belum: number;
  count_terlambat: number;
};

export type Paginated<T> = {
  data: T[];
  meta?: { current_page: number; last_page: number; total: number; per_page: number };
  links?: any;
};

export type PajakFilter = {
  klien_id?: number;
  bulan?: number;
  tahun?: number;
  mode?: PpnMode;
  status?: PajakStatusFilter;
  search?: string;
  page?: number;
};

/** Jenis dokumen pendukung pajak */
export type JenisDokumenPajak = 'faktur_pajak' | 'ebilling_pajak' | 'bukti_bayar_pajak';

export const JENIS_DOKUMEN_PAJAK: { key: JenisDokumenPajak; label: string }[] = [
  { key: 'faktur_pajak',      label: 'Faktur Pajak' },
  { key: 'ebilling_pajak',    label: 'e-Billing' },
  { key: 'bukti_bayar_pajak', label: 'Bukti Bayar' },
];

export const pajakApi = {
  list: async (params?: PajakFilter): Promise<Paginated<Pajak>> => {
    const { data } = await apiClient.get('/pajak', { params });
    return data;
  },

  stats: async (params?: Omit<PajakFilter, 'status' | 'page'>): Promise<PajakStats> => {
    const { data } = await apiClient.get('/pajak/stats', { params });
    return data;
  },

  klienList: async (q?: string): Promise<{ data: KlienRingkas[] }> => {
    const { data } = await apiClient.get('/pajak/klien', { params: q ? { q } : {} });
    return data;
  },

  detail: async (id: number): Promise<{ data: Pajak }> => {
    const { data } = await apiClient.get(`/pajak/${id}`);
    return data;
  },

  markPaid: async (id: number): Promise<{ data: Pajak }> => {
    const { data } = await apiClient.post(`/pajak/${id}/paid`);
    return data;
  },

  markUnpaid: async (id: number): Promise<{ data: Pajak }> => {
    const { data } = await apiClient.post(`/pajak/${id}/unpaid`);
    return data;
  },

  /**
   * Upload satu dokumen pendukung. Server menerima ketiganya sekaligus, tapi
   * dari mobile user memilih satu per satu lewat sheet.
   */
  uploadDokumen: async (
    id: number,
    jenis: JenisDokumenPajak,
    file: { uri: string; name: string; type: string },
  ): Promise<{ data: Pajak }> => {
    const form = new FormData();
    // @ts-expect-error - RN FormData expects {uri, name, type}
    form.append(jenis, { uri: file.uri, name: file.name, type: file.type });
    const { data } = await apiClient.post(`/pajak/${id}/dokumen`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  hapusDokumen: async (id: number, jenis: JenisDokumenPajak): Promise<{ data: Pajak }> => {
    const { data } = await apiClient.delete(`/pajak/${id}/dokumen/${jenis}`);
    return data;
  },
};
