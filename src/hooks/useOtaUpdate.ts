/**
 * OTA Update hook — auto-check + manual operations.
 *
 * Behavior:
 * - Auto check saat hook mount + saat AppState transition ke 'active'.
 * - SKIP check di dev mode (`__DEV__`) atau saat Updates.isEnabled = false
 *   (mis. Expo Go).
 * - Manual: `checkNow()` paksa cek (refresh button di UpdateScreen),
 *   `downloadAndApply()` fetch + reload.
 *
 * Pattern download:
 * - fetchUpdateAsync TIDAK expose progress real (per Expo SDK 50+ doc).
 * - Kita set `downloading=true` saat mulai, lalu `reloadAsync()` saat selesai
 *   — app restart sendiri dengan bundle baru.
 *
 * Source "Apa yang baru":
 * - EAS `--message` SDK 54 tidak propagate ke manifest yg di-deliver ke app.
 *   Solusi: backend serve `latest-update.json` di public root, mobile fetch
 *   saat detect update available. Lihat [[project_ota_in_app_installer]].
 */
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import { useOtaUpdate as useOtaStore } from '../store/otaUpdate';

const MIN_CHECK_INTERVAL_MS = 60 * 1000; // 60s minimum antara 2 auto-check

/** Endpoint static — backend serve JSON ini dari public/app/latest-update.json.
 *  Format: { runtime_version, released_at (ISO), message }. */
const CHANGELOG_URL = 'https://hub.afresto.id/app/latest-update.json';

async function fetchChangelog(): Promise<{ message: string | null; releasedAt: string | null }> {
  try {
    const res = await fetch(CHANGELOG_URL, {
      cache: 'no-store' as RequestCache,
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return { message: null, releasedAt: null };
    const data = await res.json();
    return {
      message:    typeof data?.message    === 'string' ? data.message    : null,
      releasedAt: typeof data?.released_at === 'string' ? data.released_at : null,
    };
  } catch {
    return { message: null, releasedAt: null };
  }
}

export function useOtaUpdate() {
  const store           = useOtaStore();
  const lastCheckRef    = useRef<number>(0);

  const performCheck = useCallback(async () => {
    if (__DEV__) return;                    // skip dev mode
    if (!Updates.isEnabled) return;         // Expo Go / not configured
    if (store.downloading) return;          // jangan ganggu download

    const now = Date.now();
    if (now - lastCheckRef.current < MIN_CHECK_INTERVAL_MS) return;
    lastCheckRef.current = now;

    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        const manifest: any = result.manifest;

        // Fetch changelog dari backend — paralel ke set state supaya tidak
        // block banner availability. Kalau gagal, fallback ke text generic
        // di UpdateScreen.
        const changelog = await fetchChangelog();

        await store.setAvailable({
          manifestId:  manifest?.id ?? String(now),
          // Prioritas: backend changelog → manifest field (multi-path) → null.
          message:     changelog.message
                       ?? manifest?.metadata?.updateMessage
                       ?? manifest?.extra?.eas?.message
                       ?? manifest?.extra?.expoClient?.extra?.eas?.message
                       ?? manifest?.message
                       ?? null,
          publishedAt: changelog.releasedAt
                       ?? manifest?.createdAt
                       ?? null,
        });
      } else {
        store.clearAvailable();
      }
    } catch (err: any) {
      // checkForUpdateAsync throw kalau offline / EAS endpoint mati — silent fail.
      // User akan dapat banner saat next launch + connection ok.
      if (__DEV__) console.warn('[OTA] check failed:', err?.message);
    }
  }, [store]);

  const downloadAndApply = useCallback(async () => {
    if (!Updates.isEnabled || __DEV__) {
      store.setError('Update tidak tersedia di mode development.');
      return;
    }
    store.setDownloading(true);
    store.setProgress(0);
    try {
      const result = await Updates.fetchUpdateAsync();
      if (!result.isNew) {
        store.setError('Bundle update gagal di-download.');
        return;
      }
      // Reload app — bundle baru langsung dipakai, tanpa force-close.
      await Updates.reloadAsync();
    } catch (err: any) {
      store.setError(err?.message ?? 'Gagal pasang update.');
    }
  }, [store]);

  // Auto-check saat mount + saat app kembali ke foreground.
  useEffect(() => {
    performCheck();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') performCheck();
    });
    return () => sub.remove();
  }, [performCheck]);

  return {
    available:       store.available,
    bannerDismissed: store.bannerDismissed,
    message:         store.message,
    publishedAt:     store.publishedAt,
    downloading:     store.downloading,
    progress:        store.progress,
    error:           store.error,
    runtimeVersion:  Updates.runtimeVersion,
    updateId:        Updates.updateId,
    channel:         Updates.channel,
    dismissBanner:   store.dismissBanner,
    checkNow:        () => { lastCheckRef.current = 0; return performCheck(); },
    downloadAndApply,
  };
}
