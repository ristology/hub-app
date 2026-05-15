import * as Notifications from 'expo-notifications';
import { createNavigationContainerRef, type NavigationContainerRefWithCurrent } from '@react-navigation/native';

/**
 * Global navigation ref — diset di RootNavigator, dipakai utility ini
 * untuk dispatch navigation dari luar React tree (notification handler).
 */
export const navigationRef: NavigationContainerRefWithCurrent<any> =
  createNavigationContainerRef<any>();

type NotifData = Record<string, any> | null | undefined;

/**
 * Mapping tipe notifikasi → target screen + params.
 * Mendukung dua sumber data: explicit (tipe + model_id) atau fallback URL parsing.
 */
function resolveTarget(data: NotifData): { tab: string; screen?: string; params?: any } | null {
  if (!data) return null;

  const tipe      = String(data.tipe ?? '');
  const modelType = String(data.model_type ?? '');
  const modelId   = data.model_id ? Number(data.model_id) : null;
  const url       = String(data.url ?? '');

  // Extract komentar id dari URL hash `#kom-{id}` untuk highlight
  const komMatch = url.match(/#kom-(\d+)/);
  const komId    = komMatch ? Number(komMatch[1]) : null;

  // 1) Explicit dari payload (cara utama — backend sudah kirim tipe+model_id)
  if (tipe && modelId) {
    if (tipe === 'komentar_feed' || tipe === 'feed_post' || tipe === 'feed_tag' || tipe === 'komentar_balas') {
      return { tab: 'Feed', screen: 'FeedDetail', params: { id: modelId, highlightKomentarId: komId } };
    }
    if (tipe === 'komentar_prospek' || tipe.startsWith('prospek_')) {
      return { tab: 'Prospek', screen: 'ProspekDetail', params: { id: modelId, highlightKomentarId: komId } };
    }
    if (tipe === 'komentar_error_log' || tipe.startsWith('error_log_')) {
      return { tab: 'ErrorLog', screen: 'ErrorLogDetail', params: { id: modelId, highlightKomentarId: komId } };
    }
    if (tipe === 'komentar_request' || tipe.startsWith('request_')) {
      // Request adalah hidden tab di MainTabs — navigate via MainTabs > Request > RequestDetail
      return {
        tab: 'MainTabs',
        screen: 'Request',
        params: { screen: 'RequestDetail', params: { id: modelId, highlightKomentarId: komId } },
      };
    }
    if (tipe === 'kalender' || tipe.startsWith('kalender_')) {
      return {
        tab: 'MainTabs',
        screen: 'Kalender',
        params: { screen: 'KegiatanDetail', params: { id: modelId } },
      };
    }
    if (tipe.startsWith('task_')) {
      return { tab: 'Task', screen: 'TaskDetail', params: { id: modelId } };
    }
    // Chat: model_id = message_id, tapi navigasi butuh room_id dari URL
    if (tipe === 'chat_message') {
      const roomMatch = url.match(/\/chat\/(\d+)/);
      if (roomMatch) {
        return {
          tab: 'Pesan',
          screen: 'ChatRoom',
          params: { roomId: Number(roomMatch[1]), nama: 'Pesan', foto: null },
        };
      }
      return { tab: 'Pesan' };
    }
  }

  // 2) Fallback: parse URL string `/feed/123`, `/prospek/123`, dst.
  const m = url.match(/\/(feed|prospek|error-log|request|kalender)\/(\d+)/);
  if (m) {
    const segment = m[1];
    const id      = Number(m[2]);

    if (segment === 'feed')      return { tab: 'Feed', screen: 'FeedDetail', params: { id } };
    if (segment === 'prospek')   return { tab: 'Prospek', screen: 'ProspekDetail', params: { id } };
    if (segment === 'error-log') return { tab: 'ErrorLog', screen: 'ErrorLogDetail', params: { id } };
    if (segment === 'request')   return {
      tab: 'MainTabs', screen: 'Request',
      params: { screen: 'RequestDetail', params: { id } },
    };
    if (segment === 'kalender')  return {
      tab: 'MainTabs', screen: 'Kalender',
      params: { screen: 'KegiatanDetail', params: { id } },
    };
  }

  return null;
}

function dispatchNavigation(target: ReturnType<typeof resolveTarget>) {
  if (!target || !navigationRef.isReady()) return;

  const { tab, screen, params } = target;

  if (screen) {
    // initial: false → tetap mount list screen sebagai initial route, push detail di atasnya.
    // Tanpa ini, back dari detail langsung lompat ke Beranda krn stack hanya berisi detail.
    // 3-level (MainTabs > Kalender > KegiatanDetail): inner params juga butuh initial: false.
    const innerParams = params && typeof params === 'object' && (params as any).screen
      ? { ...(params as any), initial: false }
      : params;
    navigationRef.navigate(tab, { screen, initial: false, params: innerParams });
  } else {
    navigationRef.navigate(tab, params);
  }
}

/**
 * Setup listener untuk handle tap notification.
 * Panggil sekali di App / RootNavigator setelah navigationRef siap.
 *
 * Mendukung 3 skenario:
 *  - Foreground: notif diterima saat app aktif
 *  - Background: notif diterima saat app di background lalu di-tap
 *  - Cold start: app dibuka dari notif saat sebelumnya killed
 */
export function setupDeepLinkHandler(): () => void {
  // Cold start: cek notif terakhir yang membuka app
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data as NotifData;
      const target = resolveTarget(data);
      // Tunggu navigator ready dulu — kalau belum, retry tiap 100ms (max 30x)
      tryDispatchWhenReady(target);
    }
  });

  // Background/foreground tap
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotifData;
    dispatchNavigation(resolveTarget(data));
  });

  return () => sub.remove();
}

/** Retry dispatch sampai navigationRef ready (cold start case). */
function tryDispatchWhenReady(target: ReturnType<typeof resolveTarget>, attempts = 30) {
  if (!target) return;
  if (navigationRef.isReady()) {
    dispatchNavigation(target);
    return;
  }
  if (attempts <= 0) return;
  setTimeout(() => tryDispatchWhenReady(target, attempts - 1), 100);
}
