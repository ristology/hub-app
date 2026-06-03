import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
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
    // komentar_balas bisa berasal dari Feed/Prospek/ErrorLog/ClientRequest —
    // tujuan ditentukan oleh model_type, bukan default ke Feed.
    if (tipe === 'komentar_balas') {
      if (modelType.endsWith('\\Prospek')) {
        return { tab: 'Prospek', screen: 'ProspekDetail', params: { id: modelId, highlightKomentarId: komId } };
      }
      if (modelType.endsWith('\\ErrorLog')) {
        return { tab: 'ErrorLog', screen: 'ErrorLogDetail', params: { id: modelId, highlightKomentarId: komId } };
      }
      if (modelType.endsWith('\\ClientRequest')) {
        return {
          tab: 'MainTabs',
          screen: 'Request',
          params: { screen: 'RequestDetail', params: { id: modelId, highlightKomentarId: komId } },
        };
      }
      return { tab: 'Feed', screen: 'FeedDetail', params: { id: modelId, highlightKomentarId: komId } };
    }
    if (tipe === 'komentar_feed' || tipe === 'feed_post' || tipe === 'feed_tag') {
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
    // Chat: model_id = message_id, navigasi butuh room_id dari URL.
    // highlightMessageId dibawa supaya ChatRoomScreen bisa scroll + highlight
    // ke pesan yang di-notif.
    if (tipe === 'chat_message') {
      const roomMatch = url.match(/\/chat\/(\d+)/);
      if (roomMatch) {
        return {
          tab: 'Pesan',
          screen: 'ChatRoom',
          params: {
            roomId: Number(roomMatch[1]),
            nama: 'Pesan',
            foto: null,
            highlightMessageId: modelId,
          },
        };
      }
      return { tab: 'Pesan' };
    }
  }

  // 2a) Special case: /kalender#kegiatan-{id}
  // Email undangan kalender pakai pattern hash bukan path
  // (backend route('kalender.index') . '#kegiatan-{id}'). ID di URL
  // fragment, bukan di path. Regex umum `/kalender/(\d+)` tidak match
  // krn URL aktual `/kalender#kegiatan-123`.
  if (url.includes('/kalender')) {
    const kegiatanMatch = url.match(/#kegiatan-(\d+)/);
    if (kegiatanMatch) {
      return {
        tab: 'MainTabs',
        screen: 'Kalender',
        params: { screen: 'KegiatanDetail', params: { id: Number(kegiatanMatch[1]) } },
      };
    }
    // URL cuma /kalender (no fragment) → land di list jadwal
    if (url.match(/\/kalender(\?|#|$)/)) {
      return { tab: 'MainTabs', screen: 'Kalender' };
    }
  }

  // 2b) Fallback: parse URL string `/feed/123`, `/prospek/123`, dst.
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

  // No nested screen → langsung ke tab
  if (!screen) {
    navigationRef.navigate(tab as never, params as never);
    return;
  }

  // EXPLICIT TWO-STEP navigation (lihat [[feedback_rn_nested_navigation]]).
  //
  // Sebelumnya pakai nested navigate dgn `initial: false` — work utk warm
  // start (notif tap saat app foreground/background) tapi GAGAL utk cold
  // start (Universal Link tap dari email saat app killed). Cold start =
  // navigator state fresh, `initial: false` interpretasi RN tidak reliable
  // → target screen tidak ter-push, user landing di Beranda.
  //
  // Solusi: pisah ke 2 step eksplisit
  //   STEP 1: navigate ke tab tujuan → mount stack dgn list screen sbg
  //           initial route (default behavior, no quirks)
  //   STEP 2 (delay 150ms): navigate ke target screen by unique route name
  //           → RN lookup di tree, push di atas list screen
  //
  // Hasil: stack `[ListScreen, TargetScreen]`. goBack pop target → land
  // di list. Tidak bubble ke tab navigator, tidak switch tab keliru.

  // Unwrap 3-level target (mis. MainTabs > Kalender > KegiatanDetail).
  // tab='MainTabs' & screen='Kalender' & params={ screen: 'KegiatanDetail', params: {...}}
  // → actualTab='Kalender', actualScreen='KegiatanDetail', actualParams={...}
  let actualTab    = tab;
  let actualScreen = screen;
  let actualParams = params;

  if (tab === 'MainTabs' && params && typeof params === 'object' && (params as any).screen) {
    actualTab    = screen;
    actualScreen = (params as any).screen;
    actualParams = (params as any).params;
  }

  // STEP 1: switch tab (mount stack dgn list screen sbg initial)
  navigationRef.navigate(actualTab as never);

  // STEP 2: push target screen ke stack tujuan (delay supaya mount settle)
  setTimeout(() => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate(actualScreen as never, actualParams as never);
  }, 150);
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
  // Cold start (NOTIF): cek notif terakhir yang membuka app
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data as NotifData;
      const target = resolveTarget(data);
      tryDispatchWhenReady(target);
    }
  });

  // Cold start (UNIVERSAL/APP LINK): cek URL yang membuka app dari luar
  // (mis. tap link https://hub.afresto.id/kalender/123 dari email).
  Linking.getInitialURL().then((url) => {
    if (url) {
      const target = resolveTarget({ url });
      tryDispatchWhenReady(target);
    }
  });

  // Background/foreground tap notif
  const subNotif = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotifData;
    dispatchNavigation(resolveTarget(data));
  });

  // Background/foreground universal link / app link masuk
  const subLink = Linking.addEventListener('url', ({ url }) => {
    dispatchNavigation(resolveTarget({ url }));
  });

  return () => {
    subNotif.remove();
    subLink.remove();
  };
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
