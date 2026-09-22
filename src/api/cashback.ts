import { apiClient } from './client';
import type { KlienRingkas } from '../components/KlienSearchBar';

export type CashbackStatus = 'unpaid' | 'paid';
export type MetodeBayar = 'dibayarkan' | 'dipotong';

export type Cashback = {
  id: number;
  nominal: number;
  bulan: number;
  tahun: number;
  bulan_nama: string;
  keterangan: string | null;

  status_bayar: CashbackStatus;
  status_label: string;
  tanggal_bayar: string | null;
  metode_bayar: MetodeBayar | null;
  metode_bayar_label: string;
  bukti_transfer: string | null;

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

export type CashbackStats = {
  total_nominal: number;
  total_paid: number;
  total_unpaid: number;
  jumlah: number;
  count_paid: number;
  count_unpaid: number;
};

export type Paginated<T> = {
  data: T[];
  meta?: { current_page: number; last_page: number; total: number; per_page: number };
  links?: any;
};

export type CashbackFilter = {
  klien_id?: number;
  bulan?: number;
  tahun?: number;
  metode?: MetodeBayar;
  status?: CashbackStatus;
  search?: string;
  page?: number;
};

export const cashbackApi = {
  list: async (params?: CashbackFilter): Promise<Paginated<Cashback>> => {
    const { data } = await apiClient.get('/cashback', { params });
    return data;
  },

  stats: async (params?: Omit<CashbackFilter, 'status' | 'page'>): Promise<CashbackStats> => {
    const { data } = await apiClient.get('/cashback/stats', { params });
    return data;
  },

  klienList: async (q?: string): Promise<{ data: KlienRingkas[] }> => {
    const { data } = await apiClient.get('/cashback/klien', { params: q ? { q } : {} });
    return data;
  },

  detail: async (id: number): Promise<{ data: Cashback }> => {
    const { data } = await apiClient.get(`/cashback/${id}`);
    return data;
  },

  /**
   * Tandai Paid. Metode 'dibayarkan' WAJIB menyertakan bukti transfer —
   * server menolak kalau kosong. Metode 'dipotong' tidak butuh bukti.
   */
  markPaid: async (
    id: number,
    metode: MetodeBayar,
    bukti?: { uri: string; name: string; type: string },
  ): Promise<{ data: Cashback }> => {
    const form = new FormData();
    form.append('metode_bayar', metode);
    if (bukti) {
      // @ts-expect-error - RN FormData expects {uri, name, type}
      form.append('bukti_transfer', { uri: bukti.uri, name: bukti.name, type: bukti.type });
    }
    const { data } = await apiClient.post(`/cashback/${id}/paid`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  markUnpaid: async (id: number): Promise<{ data: Cashback }> => {
    const { data } = await apiClient.post(`/cashback/${id}/unpaid`);
    return data;
  },
};
