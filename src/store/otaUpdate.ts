/**
 * OTA Update store — track availability + dismiss state untuk banner Home.
 *
 * Setiap `eas update` publish manifest baru dengan ID unik (manifest.id). Kalau
 * user dismiss banner, kita simpan ID-nya supaya banner update yang SAMA tidak
 * keluar lagi — tapi update berikutnya (ID berbeda) tetap muncul.
 *
 * Note: badge dot di Menu tab/item TIDAK respect dismiss — selama update belum
 * dipasang, badge tetap tampil. Yang di-dismiss cuma banner besar di Home.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const DISMISSED_KEY = 'ota_lastDismissedManifestId';

type State = {
  available:        boolean;
  /** Manifest ID dari update yang available (untuk match saat dismiss). */
  manifestId:       string | null;
  /** Pesan release dari `eas update --message "..."`. */
  message:          string | null;
  /** Tanggal manifest di-publish (createdAt manifest). */
  publishedAt:      string | null;
  /** True kalau user sudah dismiss banner UNTUK manifest ini. */
  bannerDismissed:  boolean;
  /** True selama download + reload sedang jalan. */
  downloading:      boolean;
  /** 0..1 progress download (sekarang Updates SDK belum expose progress real,
   *  jadi cuma fallback indeterminate). */
  progress:         number;
  error:            string | null;
};

type Actions = {
  setAvailable: (info: { manifestId: string; message?: string | null; publishedAt?: string | null }) => Promise<void>;
  clearAvailable: () => void;
  dismissBanner: () => Promise<void>;
  setDownloading: (v: boolean) => void;
  setProgress:    (p: number) => void;
  setError:       (e: string | null) => void;
  /** Dipanggil dari App.tsx saat startup untuk restore dismiss flag dari disk. */
  hydrate: () => Promise<void>;
};

export const useOtaUpdate = create<State & Actions>((set, get) => ({
  available:       false,
  manifestId:      null,
  message:         null,
  publishedAt:     null,
  bannerDismissed: false,
  downloading:     false,
  progress:        0,
  error:           null,

  setAvailable: async ({ manifestId, message, publishedAt }) => {
    const lastDismissed = await SecureStore.getItemAsync(DISMISSED_KEY);
    set({
      available:       true,
      manifestId,
      message:         message ?? null,
      publishedAt:     publishedAt ?? null,
      bannerDismissed: lastDismissed === manifestId,
      error:           null,
    });
  },

  clearAvailable: () => set({
    available:       false,
    manifestId:      null,
    message:         null,
    publishedAt:     null,
    bannerDismissed: false,
  }),

  dismissBanner: async () => {
    const id = get().manifestId;
    if (id) await SecureStore.setItemAsync(DISMISSED_KEY, id);
    set({ bannerDismissed: true });
  },

  setDownloading: (v) => set({ downloading: v, error: v ? null : get().error }),
  setProgress:    (p) => set({ progress: p }),
  setError:       (e) => set({ error: e, downloading: false }),

  hydrate: async () => {
    // No-op for now — dismissed flag dibaca on-demand di setAvailable.
    // Stub ini ada supaya bisa diperluas (mis. cache last manifest yang
    // available untuk skip flicker saat reopen).
  },
}));
