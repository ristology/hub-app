import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Linking, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './Toast';

/**
 * Kartu GitHub + Claude — DIPAKAI BERSAMA Error Log & Request (HUB docs/40 §32).
 *
 * Dipindah ke sini, bukan disalin ke layar Request, karena isinya seluruh alur Claude: status
 * issue & PR, kotak "berhenti di tengah jalan", diskusi, setuju-kerjakan, dan triase. Dua salinan
 * berarti dua perilaku yang pasti menyimpang.
 *
 * Tombol mana yang tampil TIDAK diputuskan di sini — seluruhnya dari `github.aksi` yang dihitung
 * server, dan server pula yang menegakkannya saat tombolnya ditekan. Aturan yang ditulis ulang di
 * klien selalu ketinggalan.
 */

export type GithubAksi = {
  diskusi: boolean;
  triase: boolean;
  kerjakan: boolean;
  jalankan_ulang: boolean;
  /** true = PR sebelumnya merged/ditutup → ragam "Masih ada kendala" (catatan WAJIB) */
  kerjakan_ulang: boolean;
  sudah_ditriase: boolean;
};

export type GithubPayload = {
  issue_number: number;
  issue_url: string | null;
  issue_state: 'open' | 'closed' | null;
  repo: string | null;
  labels: string[];
  sedang: 'triase' | 'kerjakan' | null;
  pr: { number: number; url: string | null; state: 'open' | 'merged' | 'closed' | null } | null;
  synced_at: string | null;
  macet: {
    sejak: string;
    menit: number;
    jenis: 'triase' | 'kerjakan';
    boleh_jalankan_ulang: boolean;
  } | null;
  aksi: GithubAksi;
};

/** Keempat aksi; tiap modul menyuntikkan fungsi API-nya sendiri. */
export type GithubAiApi = {
  kerjakan: (id: number, catatan: string) => Promise<{ message: string }>;
  diskusi: (id: number, catatan: string) => Promise<{ message: string }>;
  triase: (id: number) => Promise<{ message: string }>;
  jalankanUlang: (id: number) => Promise<{ message: string }>;
};

type Props = {
  id: number;
  github: GithubPayload | null | undefined;
  api: GithubAiApi;
  /** Query yang disegarkan setelah tiap aksi (detail, daftar, statistik, …). */
  queryKeys: unknown[][];
  /** Label modul untuk kalimat penutup: "laporan" / "request". */
  sebutan?: string;
};

export default function GithubAiCard({ id, github, api, queryKeys, sebutan = 'laporan' }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [kendala, setKendala] = useState('');
  const [tanya, setTanya] = useState('');

  const segarkan = () => queryKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));

  /**
   * onError ikut menyegarkan: penolakan tersering adalah keadaan yang sudah berubah (Claude
   * keburu jalan, PR keburu dibuat), dan layar harus berhenti menampilkan tombol yang tidak
   * berlaku lagi.
   */
  const pakai = (fn: () => Promise<{ message: string }>, bersihkan?: () => void) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (res) => { bersihkan?.(); segarkan(); toast.success(res.message); },
      onError: (e: any) => { segarkan(); Alert.alert('Tidak bisa', e.response?.data?.message ?? 'Periksa koneksi & coba lagi.'); },
    });

  const kendalaMutation      = pakai(() => api.kerjakan(id, kendala.trim()), () => setKendala(''));
  const diskusiMutation      = pakai(() => api.diskusi(id, tanya.trim()), () => setTanya(''));
  const triaseMutation       = pakai(() => api.triase(id));
  const jalankanUlangMutation = pakai(() => api.jalankanUlang(id));

  const confirmKendala = () => {
    const ulang = !!github?.aksi?.kerjakan_ulang;
    if (ulang && !kendala.trim()) {
      Alert.alert('Catatan wajib', 'Tulis dulu apa yang masih bermasalah — Claude memakai catatan itu.');
      return;
    }
    Alert.alert(
      ulang ? 'Minta Claude perbaiki lagi?' : 'Setuju & minta Claude kerjakan?',
      ulang
        ? 'Catatanmu dikirim ke issue, issue dibuka kembali, dan Claude membuat PR baru. Merge tetap oleh tim IT.'
        : 'Kamu tercatat sebagai penanggung jawab, Claude menulis perbaikannya, dan merge tetap dilakukan tim IT.',
      [{ text: 'Batal', style: 'cancel' }, { text: 'Ya, kirim', onPress: () => kendalaMutation.mutate() }],
    );
  };

  const confirmDiskusi = () => {
    if (!tanya.trim()) {
      Alert.alert('Catatan wajib', 'Tulis dulu pertanyaan atau usulanmu — Claude menjawab berdasarkan catatan itu.');
      return;
    }
    Alert.alert(
      'Kirim ke Claude?',
      'Claude menjawab sebagai komentar dalam 1–3 menit. Ia TIDAK menulis kode dan tidak membuat PR — eksekusi baru terjadi kalau tombol hijau ditekan.',
      [{ text: 'Batal', style: 'cancel' }, { text: 'Kirim', onPress: () => diskusiMutation.mutate() }],
    );
  };

  const confirmTriase = (sudah: boolean) => {
    Alert.alert(
      sudah ? 'Nilai ulang oleh Claude?' : 'Minta Claude menilai?',
      sudah
        ? 'Penilaian sebelumnya diganti hasil yang baru. Pakai ini setelah isinya diperjelas di komentar.'
        : `Claude membaca ${sebutan} ini dan menilai tingkat kesulitannya. Ia tidak menulis kode pada langkah ini.`,
      [{ text: 'Batal', style: 'cancel' }, { text: sudah ? 'Nilai ulang' : 'Minta', onPress: () => triaseMutation.mutate() }],
    );
  };

  const confirmJalankanUlang = () => {
    Alert.alert(
      'Jalankan ulang?',
      'Claude mengerjakan lagi dari awal. Tidak ada data yang hilang, dan komentar sebelumnya tetap ada.',
      [{ text: 'Batal', style: 'cancel' }, { text: 'Jalankan', onPress: () => jalankanUlangMutation.mutate() }],
    );
  };

  if (!github) return null;
  const log = { github };

  return (
    <>
      <Text style={ghStyles.sectionLabel}>GITHUB ISSUE</Text>
      <View style={ghStyles.card}>
        <View style={ghStyles.row}>
          <View style={[ghStyles.badge, log.github.issue_state === 'closed' ? ghStyles.badgeMuted : ghStyles.badgeOpen]}>
            <Text style={[ghStyles.badgeText, log.github.issue_state === 'closed' ? ghStyles.badgeMutedText : ghStyles.badgeOpenText]}>
              {log.github.issue_state === 'closed' ? 'Closed' : 'Open'}
            </Text>
          </View>
          <Text style={ghStyles.nomor}>#{log.github.issue_number}</Text>
          {log.github.repo ? <Text style={ghStyles.repo}>{log.github.repo.split('/').pop()}</Text> : null}
          <TouchableOpacity
            style={{ marginLeft: 'auto' }}
            hitSlop={8}
            onPress={() => log.github?.issue_url && Linking.openURL(log.github.issue_url).catch(() => Alert.alert('Error', 'Gagal buka GitHub.'))}
          >
            <Ionicons name="open-outline" size={18} color="#8a94a6" />
          </TouchableOpacity>
        </View>

        {/* §30: prosesnya berhenti tanpa hasil. Diperiksa SEBELUM `sedang` — label pemicu
            yang tertinggal membuat spinner berputar selamanya, dan pelapor tidak punya
            akses repo untuk mengetahuinya sendiri. */}
        {log.github.macet ? (
          <View style={ghStyles.macetBox}>
            <View style={ghStyles.row}>
              <Ionicons name="alert-circle" size={16} color="#f87171" />
              <Text style={ghStyles.macetTitle}>Claude berhenti di tengah jalan</Text>
            </View>
            <Text style={ghStyles.macetText}>
              Proses {log.github.macet.jenis === 'kerjakan' ? 'perbaikan' : 'penilaian'} tidak selesai
              setelah {log.github.macet.menit} menit. Penyebab tersering: kuota token habis atau
              proses dibatalkan. Tidak ada data yang hilang — cukup dijalankan ulang.
            </Text>
            {log.github.macet.boleh_jalankan_ulang ? (
              <TouchableOpacity
                style={[ghStyles.macetBtn, jalankanUlangMutation.isPending && { opacity: 0.5 }]}
                disabled={jalankanUlangMutation.isPending}
                onPress={confirmJalankanUlang}
              >
                {jalankanUlangMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="refresh" size={16} color="#fff" />}
                <Text style={ghStyles.macetBtnText}>Jalankan ulang</Text>
              </TouchableOpacity>
            ) : (
              <Text style={ghStyles.hint}>Pelapor, handler, atau PIC kategori bisa menjalankannya ulang.</Text>
            )}
          </View>
        ) : log.github.sedang ? (
          <View style={ghStyles.row}>
            <ActivityIndicator size="small" color="#38bdf8" />
            <Text style={ghStyles.info}>
              {log.github.sedang === 'kerjakan' ? 'Claude sedang mengerjakan perbaikan…' : 'Claude sedang menilai laporan ini…'}
            </Text>
          </View>
        ) : (
          <View style={[ghStyles.row, { flexWrap: 'wrap' }]}>
            {log.github.labels
              .filter((l) => ['ai:minor', 'ai:butuh-review', 'ai:kurang-jelas', 'ai:pr'].includes(l))
              .map((l) => (
                <View key={l} style={ghStyles.aiChip}>
                  <Ionicons name="sparkles" size={10} color="#fbbf24" />
                  <Text style={ghStyles.aiChipText}>
                    {l === 'ai:minor' ? 'AI: perbaikan kecil' : l === 'ai:butuh-review' ? 'AI: butuh review IT' : l === 'ai:kurang-jelas' ? 'AI: laporan kurang jelas' : 'AI: PR dibuat'}
                  </Text>
                </View>
              ))}
          </View>
        )}

        {log.github.pr && (
          <TouchableOpacity
            style={ghStyles.prRow}
            onPress={() => log.github?.pr?.url && Linking.openURL(log.github.pr.url).catch(() => Alert.alert('Error', 'Gagal buka PR.'))}
          >
            <Ionicons
              name={log.github.pr.state === 'merged' ? 'git-merge-outline' : 'git-pull-request-outline'}
              size={16}
              color={log.github.pr.state === 'merged' ? '#22c55e' : log.github.pr.state === 'open' ? '#38bdf8' : '#8a94a6'}
            />
            <Text style={[ghStyles.prText, { color: log.github.pr.state === 'merged' ? '#22c55e' : log.github.pr.state === 'open' ? '#38bdf8' : '#8a94a6' }]}>
              PR #{log.github.pr.number} · {log.github.pr.state === 'merged' ? 'Merged — sudah masuk ke kode' : log.github.pr.state === 'open' ? 'Menunggu review & merge' : 'Ditutup tanpa merge'}
            </Text>
          </TouchableOpacity>
        )}
        {/* §29: bertanya dulu sebelum eksekusi. Hanya untuk kelas yang memang butuh
            pertimbangan manusia — `minor` sengaja tidak dapat tombol ini. */}
        {log.github.aksi?.diskusi && (
          <View style={ghStyles.kendalaBox}>
            <Text style={ghStyles.diskusiLabel}>Ada yang ingin ditanyakan dulu?</Text>
            <TextInput
              style={ghStyles.kendalaInput}
              placeholder="Mis. 'opsi 1 atau 2 yang lebih aman?' atau 'bisa pakai pola tab per kelas seperti Kode Masuk?'"
              placeholderTextColor="#6b7280"
              value={tanya}
              onChangeText={setTanya}
              multiline
              maxLength={3000}
            />
            <TouchableOpacity
              style={[ghStyles.diskusiBtn, (!tanya.trim() || diskusiMutation.isPending) && { opacity: 0.5 }]}
              disabled={!tanya.trim() || diskusiMutation.isPending}
              onPress={confirmDiskusi}
            >
              {diskusiMutation.isPending
                ? <ActivityIndicator size="small" color="#38bdf8" />
                : <Ionicons name="chatbubble-ellipses-outline" size={16} color="#38bdf8" />}
              <Text style={ghStyles.diskusiBtnText}>Diskusikan dulu dengan Claude</Text>
            </TouchableOpacity>
            <Text style={ghStyles.hint}>
              Claude menjawab sebagai komentar (1–3 menit) tanpa menulis kode.
            </Text>
          </View>
        )}

        {/* §25/§27: satu tombol, dua ragam. `kerjakan_ulang` = PR sebelumnya sudah
            merged/ditutup → catatan WAJIB; persetujuan awal → catatan opsional. */}
        {log.github.aksi?.kerjakan && (
          <View style={ghStyles.kendalaBox}>
            <Text style={ghStyles.kendalaLabel}>
              {log.github.aksi.kerjakan_ulang ? 'Masih ada kendala setelah perbaikan?' : 'Setuju dengan penilaian Claude?'}
            </Text>
            <TextInput
              style={ghStyles.kendalaInput}
              placeholder={log.github.aksi.kerjakan_ulang
                ? 'Wajib: apa yang masih bermasalah? (mis. tombol muncul tapi tidak bisa ditekan di Android 12)'
                : 'Opsional: catatan supaya eksekusinya tepat (mis. jangan ubah warna, cukup lebarnya)'}
              placeholderTextColor="#6b7280"
              value={kendala}
              onChangeText={setKendala}
              multiline
              maxLength={3000}
            />
            <TouchableOpacity
              style={[
                log.github.aksi.kerjakan_ulang ? ghStyles.kendalaBtn : ghStyles.setujuBtn,
                ((log.github.aksi.kerjakan_ulang && !kendala.trim()) || kendalaMutation.isPending) && { opacity: 0.5 },
              ]}
              disabled={(log.github.aksi.kerjakan_ulang && !kendala.trim()) || kendalaMutation.isPending}
              onPress={confirmKendala}
            >
              {kendalaMutation.isPending
                ? <ActivityIndicator size="small" color={log.github.aksi.kerjakan_ulang ? '#111827' : '#fff'} />
                : <Ionicons
                    name={log.github.aksi.kerjakan_ulang ? 'refresh' : 'checkmark-circle-outline'}
                    size={16}
                    color={log.github.aksi.kerjakan_ulang ? '#111827' : '#fff'}
                  />}
              <Text style={log.github.aksi.kerjakan_ulang ? ghStyles.kendalaBtnText : ghStyles.setujuBtnText}>
                {log.github.aksi.kerjakan_ulang
                  ? 'Masih ada kendala — minta Claude perbaiki lagi'
                  : 'Setuju — minta Claude kerjakan & buat PR'}
              </Text>
            </TouchableOpacity>
            {!log.github.aksi.kerjakan_ulang && (
              <Text style={ghStyles.hint}>
                Kamu tercatat sebagai handler, dan merge tetap dilakukan tim IT.
              </Text>
            )}
          </View>
        )}

        {/* §21: minta penilaian / nilai ulang. Paling bawah — ini langkah paling awal,
            jadi pada laporan yang sudah ditriase ia jarang dipakai. */}
        {log.github.aksi?.triase && (
          <TouchableOpacity
            style={[ghStyles.triaseBtn, triaseMutation.isPending && { opacity: 0.5 }]}
            disabled={triaseMutation.isPending}
            onPress={() => confirmTriase(!!log.github?.aksi?.sudah_ditriase)}
          >
            {triaseMutation.isPending
              ? <ActivityIndicator size="small" color="#fbbf24" />
              : <Ionicons name="sparkles-outline" size={15} color="#fbbf24" />}
            <Text style={ghStyles.triaseBtnText}>
              {log.github.aksi.sudah_ditriase ? 'Nilai ulang oleh Claude' : 'Minta triase AI'}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={ghStyles.hint}>Membuat issue baru di GitHub tetap dilakukan dari HUB web.</Text>
      </View>
    </>
  );
}

const ghStyles = StyleSheet.create({
  // Disalin dari gaya `sectionLabel` layar pemanggil supaya judul bagiannya tetap
  // seragam dengan bagian lain di halaman (LAMPIRAN, KOMENTAR, dst).
  sectionLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  card:  { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, gap: 8, marginBottom: 14 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeOpen: { backgroundColor: 'rgba(34,197,94,0.15)' }, badgeOpenText: { color: '#22c55e' },
  badgeMuted: { backgroundColor: 'rgba(138,148,166,0.15)' }, badgeMutedText: { color: '#8a94a6' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  nomor: { color: '#fff', fontWeight: '600', fontSize: 14 },
  repo:  { color: '#8a94a6', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  info:  { color: '#38bdf8', fontSize: 12 },
  aiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251,191,36,.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  aiChipText: { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  prText: { fontSize: 12, fontWeight: '600', flex: 1 },
  hint:  { color: '#6b7280', fontSize: 10 },
  kendalaBox:   { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  kendalaLabel: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
  kendalaInput: { minHeight: 64, maxHeight: 140, color: '#fff', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10, textAlignVertical: 'top' },
  kendalaBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fbbf24', borderRadius: 8, paddingVertical: 10 },
  kendalaBtnText: { color: '#111827', fontSize: 13, fontWeight: '700' },
  macetBox:   { gap: 6, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 8, padding: 10 },
  macetTitle: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  macetText:  { color: '#cbd5e1', fontSize: 12, lineHeight: 17 },
  macetBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 10, marginTop: 2 },
  macetBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  diskusiLabel: { color: '#38bdf8', fontSize: 12, fontWeight: '600' },
  diskusiBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(56,189,248,0.5)', borderRadius: 8, paddingVertical: 10 },
  diskusiBtnText: { color: '#38bdf8', fontSize: 13, fontWeight: '700' },
  setujuBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10 },
  setujuBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  triaseBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)', borderRadius: 8, paddingVertical: 9, marginTop: 2 },
  triaseBtnText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
});
