/**
 * Calendar Reminders — schedule local notifications untuk event Kalender.
 *
 * Strategi:
 *  - Saat user buka aplikasi / Kalender screen, fungsi syncReminders dipanggil.
 *  - Semua reminder lama di-clear, lalu reminder baru dijadwalkan ulang.
 *  - Notifikasi tetap fire walau aplikasi ditutup / force-killed.
 *  - Channel khusus 'kalender-reminder' dgn importance MAX + alarm sound (Android).
 *
 * Limit Android 14+: butuh USE_FULL_SCREEN_INTENT permission utk takeover screen.
 *   Konfigurasi tambahan di app.json (Phase 2 — sekarang pakai high-priority notif biasa).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Kegiatan } from '../api/kalender';

const REMINDER_CHANNEL_ID = 'kalender-reminder';

/** Setup Android notification channel — wajib dipanggil sekali saat app start. */
export async function setupReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Pengingat Kalender',
    description: 'Notifikasi pengingat jadwal kegiatan',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'afresto_reminder.wav',
    vibrationPattern: [0, 300, 300, 300],
    lightColor: '#3b82f6',
    bypassDnd: false,
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

/** Request notification permission. Return true kalau diizinkan. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
      allowAnnouncements: true,
    },
  });
  return status === 'granted';
}

/** Hapus semua reminder kalender yang pernah dijadwalkan. */
export async function clearAllReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.kind === 'kalender-reminder') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

/** Schedule satu reminder utk event. Skip kalau tanggal sudah lewat. */
async function scheduleOne(event: Kegiatan): Promise<void> {
  if (!event.reminder_offset_minutes || event.reminder_offset_minutes < 0) return;

  const triggerTime = new Date(event.mulai_at);
  triggerTime.setMinutes(triggerTime.getMinutes() - event.reminder_offset_minutes);

  // Skip kalau trigger sudah lewat
  if (triggerTime.getTime() <= Date.now()) return;

  const offsetText = formatOffset(event.reminder_offset_minutes);
  const lokasi     = event.lokasi ? ` • ${event.lokasi}` : '';

  await Notifications.scheduleNotificationAsync({
    identifier: `kalender-${event.id}`,
    content: {
      title: `🔔 ${event.judul}`,
      body:  `Mulai ${offsetText} lagi${lokasi}`,
      // Payload data:
      //  - `kind` dipakai clearAllReminders utk filter local reminder vs notif lain
      //  - `tipe` + `model_id` dibaca oleh deepLink.ts utk route ke KegiatanDetail
      //    saat user tap notifikasi. Pattern tipe.startsWith('kalender_') sudah
      //    ditangani di resolveTarget.
      //  - `url` fallback kalau ada parsing path-based di handler lain
      data:  {
        kind:        'kalender-reminder',
        kegiatan_id: event.id,
        tipe:        'kalender_reminder',
        model_id:    String(event.id),
        url:         `/kalender/${event.id}`,
      },
      sound: 'afresto_reminder.wav',
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: false,
      ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerTime,
      channelId: REMINDER_CHANNEL_ID,
    } as Notifications.DateTriggerInput,
  });
}

/**
 * Sync reminder lokal berdasarkan list event dari server.
 * Clear semua reminder lama → schedule ulang yang relevan.
 */
export async function syncReminders(events: Kegiatan[]): Promise<void> {
  const ok = await ensureNotificationPermission();
  if (!ok) return;

  await setupReminderChannel();
  await clearAllReminders();

  for (const event of events) {
    try {
      await scheduleOne(event);
    } catch (e) {
      // Skip event yg gagal di-schedule (mis. tanggal invalid), jangan block sisanya
      console.warn('Gagal schedule reminder utk kegiatan', event.id, e);
    }
  }
}

/** Format menit jadi text human-readable: "5 menit", "1 jam", "1 hari", dll. */
export function formatOffset(menit: number): string {
  if (menit < 60) return `${menit} menit`;
  if (menit < 1440) {
    const jam = Math.floor(menit / 60);
    const sisa = menit % 60;
    return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`;
  }
  const hari = Math.floor(menit / 1440);
  return `${hari} hari`;
}

/** Preset opsi reminder yang umum dipakai. */
export const REMINDER_PRESETS: { label: string; value: number | null }[] = [
  { label: 'Tidak ada',     value: null },
  { label: '5 menit',       value: 5 },
  { label: '10 menit',      value: 10 },
  { label: '15 menit',      value: 15 },
  { label: '30 menit',      value: 30 },
  { label: '1 jam',         value: 60 },
  { label: '2 jam',         value: 120 },
  { label: '1 hari',        value: 1440 },
];
