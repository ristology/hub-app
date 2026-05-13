/**
 * Format ISO date string ke berbagai bentuk tampilan Indonesia.
 *
 * Tidak pakai library (date-fns/dayjs/moment) — cuma Intl API + manual untuk
 * relative time supaya tidak bloat bundle. Cukup untuk kebutuhan display
 * Indonesia (tanggal, waktu, relative).
 */

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PANJANG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const HARI_PANJANG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format: "12 Mei 2026, 14:32" — cocok untuk display tanggal+jam compact */
export function formatTanggalJam(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format: "Senin, 12 Mei 2026 14:32 WIB" — full untuk detail/tooltip */
export function formatTanggalLengkap(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${HARI_PANJANG[d.getDay()]}, ${d.getDate()} ${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format relative: "Baru saja", "5 menit lalu", "2 jam lalu", "Kemarin", "3 hari lalu", "12 Mei" */
export function formatRelativeWaktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const now      = new Date();
  const diffMs   = now.getTime() - d.getTime();
  const diffSec  = Math.floor(diffMs / 1000);
  const diffMin  = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay  = Math.floor(diffHour / 24);

  if (diffSec < 30)  return 'Baru saja';
  if (diffMin < 1)   return `${diffSec} detik lalu`;
  if (diffMin < 60)  return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay === 1) return 'Kemarin';
  if (diffDay < 7)   return `${diffDay} hari lalu`;
  // Lebih dari 7 hari → tampilkan tanggal pendek
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
  }
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format gabungan: "2 jam lalu · 12 Mei 2026, 14:32" — pakai di Feed untuk konteks lengkap */
export function formatRelativeDanTanggal(iso: string): string {
  return `${formatRelativeWaktu(iso)} · ${formatTanggalJam(iso)}`;
}
