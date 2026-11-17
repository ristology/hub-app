import { apiClient } from './client';

export type StatusBayar = 'belum_bayar' | 'lunas';
export type PpnMode = 'tanpa' | 'eksklusif' | 'inklusif';

export type Invoice = {
  id: number;
  no_invoice: string;
  bulan: number;
  tahun: number;
  bulan_nama: string;
  nominal_tagihan: number;
  nominal_pajak: number;
  cashback: number;
  total: number;
  ppn_mode: PpnMode;
  perihal: string | null;
  keterangan: string | null;
  status_bayar: StatusBayar;
  tanggal_bayar: string | null;
  bukti_transfer: string | null;
  is_terlambat: boolean;
  pdf_url: string;
  view_url: string;
  klien?: { id: number; nama: string } | null;
  pembuat?: { id: number; nama_lengkap: string } | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceStats = {
  tahun: number;
  total_lunas: number;
  total_belum: number;
  total_all: number;
  count_lunas: number;
  count_belum: number;
};

export type Paginated<T> = {
  data: T[];
  meta?: { current_page: number; last_page: number; total: number; per_page: number };
  links?: any;
};

export type KlienRingkas = { id: number; nama: string };

export const invoiceApi = {
  list: async (params?: {
    klien_id?: number;
    bulan?: number;
    tahun?: number;
    status?: StatusBayar;
    ppn?: 'kena' | 'tanpa';
    search?: string;
    page?: number;
  }): Promise<Paginated<Invoice>> => {
    const { data } = await apiClient.get('/invoice', { params });
    return data;
  },

  stats: async (params?: { tahun?: number; klien_id?: number }): Promise<InvoiceStats> => {
    const { data } = await apiClient.get('/invoice/stats', { params });
    return data;
  },

  klienList: async (q?: string): Promise<{ data: KlienRingkas[] }> => {
    const { data } = await apiClient.get('/invoice/klien', { params: q ? { q } : {} });
    return data;
  },

  detail: async (id: number): Promise<{ data: Invoice }> => {
    const { data } = await apiClient.get(`/invoice/${id}`);
    return data;
  },

  /**
   * Tandai lunas — wajib upload bukti transfer (jpg/jpeg/png/pdf, max 5MB)
   * DAN tanggal transfer (YYYY-MM-DD). Backend menolak kalau salah satu kosong.
   * `bukti` parameter dari hasil expo-image-picker / DocumentPicker (uri + name + type).
   */
  toggleLunas: async (
    id: number,
    bukti?: { uri: string; name: string; type: string },
    tanggalBayar?: string,
  ): Promise<{ data: Invoice }> => {
    if (bukti) {
      const form = new FormData();
      // @ts-expect-error - RN FormData expects {uri, name, type}
      form.append('bukti_transfer', { uri: bukti.uri, name: bukti.name, type: bukti.type });
      if (tanggalBayar) form.append('tanggal_bayar', tanggalBayar);
      const { data } = await apiClient.post(`/invoice/${id}/toggle-lunas`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    }
    // Reset ke belum_bayar (no upload required)
    const { data } = await apiClient.post(`/invoice/${id}/toggle-lunas`);
    return data;
  },

  /**
   * Perbaiki bukti & tanggal transfer pada invoice yang SUDAH lunas, tanpa
   * mengubah statusnya.
   *
   * JANGAN pakai toggleLunas untuk ini: mengembalikan invoice ke belum_bayar
   * membuat backend menghapus record cashback invoice tsb berikut status Paid
   * dan bukti transfer cashback yang sudah diupload.
   */
  gantiBukti: async (
    id: number,
    bukti: { uri: string; name: string; type: string },
    tanggalBayar: string,
  ): Promise<{ data: Invoice }> => {
    const form = new FormData();
    // @ts-expect-error - RN FormData expects {uri, name, type}
    form.append('bukti_transfer', { uri: bukti.uri, name: bukti.name, type: bukti.type });
    form.append('tanggal_bayar', tanggalBayar);
    const { data } = await apiClient.post(`/invoice/${id}/ganti-bukti`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
