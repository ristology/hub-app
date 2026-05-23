import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Image, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Keyboard, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { errorLogApi, type ErrorLogStatus, type ErrorLogKomentar } from '../../api/errorLog';
import { notifApi, NotifModel } from '../../api/notif';
import PhotoCarousel    from '../../components/PhotoCarousel';
import VideoThumbnail   from '../../components/VideoThumbnail';
import VideoPlayerModal from '../../components/VideoPlayerModal';
import ImageViewerModal from '../../components/ImageViewerModal';
import KaryawanPicker from '../../components/KaryawanPicker';
import PickerSheet, { type PickerOption } from '../../components/PickerSheet';
import MentionText    from '../../components/MentionText';
import LinkText       from '../../components/LinkText';
import { useKomentarHighlight } from '../../hooks/useKomentarHighlight';
import type { KaryawanRingkas } from '../../api/feed';

type RouteParams = { id: number; highlightKomentarId?: number | null };

const STATUS_OPTIONS: { key: ErrorLogStatus; label: string; color: string }[] = [
  { key: 'open',        label: 'Open',       color: '#ef4444' },
  { key: 'in_progress', label: 'Proses',     color: '#f59e0b' },
  { key: 'resolved',    label: 'Resolved',   color: '#22c55e' },
  { key: 'unresolved',  label: 'Unresolved', color: '#a78bfa' },
  { key: 'closed',      label: 'Closed',     color: '#8a94a6' },
];

// Status yang boleh diubah handler. closed & open (reopen) adalah hak pelapor
// — ditangani lewat tombol "Tindakan pelapor" terpisah.
const HANDLER_KEYS: ErrorLogStatus[] = ['in_progress', 'resolved', 'unresolved'];

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ErrorLogDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { id, highlightKomentarId } = route.params;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // Tandai notif Error Log ini sebagai dibaca → badge bottom tab berkurang
  useEffect(() => {
    notifApi.markRead(NotifModel.ErrorLog, id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['notif-count'] }))
      .catch(() => {});
  }, [id]);
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showName, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideName, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  const { scrollRef, onScroll, registerKomRef, highlightedId, onContentReady, scrollToKomentar } = useKomentarHighlight(highlightKomentarId);
  const [komentar, setKomentar] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAt,   setMentionAt]   = useState<number | null>(null);
  const [replyTo,     setReplyTo]     = useState<{ id: number; nama: string } | null>(null);
  const [videoPlayerUri, setVideoPlayerUri] = useState<string | null>(null);
  const [reassignOpen,   setReassignOpen]   = useState(false);
  const [photoViewerUri, setPhotoViewerUri] = useState<string | null>(null);

  const handleKomentarChange = (next: string) => {
    if (next.length > komentar.length) {
      const lastChar = next.charAt(next.length - 1);
      if (lastChar === '@') {
        setMentionAt(next.length - 1);
        setMentionOpen(true);
      }
    }
    setKomentar(next);
  };

  const insertMention = (k: KaryawanRingkas) => {
    const tag = '@' + k.nama.replace(/\s+/g, '_') + ' ';
    if (mentionAt !== null) {
      const before = komentar.substring(0, mentionAt);
      const after  = komentar.substring(mentionAt + 1);
      setKomentar(before + tag + after);
    } else {
      setKomentar((prev) => (prev ? `${prev} ${tag}` : tag));
    }
    setMentionAt(null);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['error-log', id],
    queryFn:  () => errorLogApi.detail(id),
    refetchInterval: 5000, // Polling utk update komentar realtime
  });

  const statusMutation = useMutation({
    mutationFn: (status: ErrorLogStatus) => errorLogApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-log', id] });
      queryClient.invalidateQueries({ queryKey: ['error-log'] });
      queryClient.invalidateQueries({ queryKey: ['error-log-stats'] });
      toast.success('Status diperbarui.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal ubah status.'),
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => errorLogApi.comment(id, text, replyTo?.id),
    onSuccess: (response) => {
      setKomentar('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['error-log', id] });
      scrollToKomentar(response.data.id);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal kirim komentar.'),
  });

  const destroyMut = useMutation({
    mutationFn: () => errorLogApi.destroy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-log'] });
      queryClient.invalidateQueries({ queryKey: ['error-log-stats'] });
      toast.success('Error log dihapus.');
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus.'),
  });

  // Daftar PIC alternatif utk reassign — fetch lazily saat picker dibuka.
  const { data: handlerData } = useQuery({
    queryKey: ['error-log-handlers'],
    queryFn:  errorLogApi.handlers,
    enabled:  reassignOpen,
  });

  const handlerOptions: PickerOption[] = useMemo(() => {
    const currentHandlerId = data?.data?.handler?.id;
    return (handlerData?.data ?? [])
      .filter((k) => k.id !== currentHandlerId)
      .map((k) => ({ id: k.id, label: k.nama }));
  }, [handlerData, data]);

  const reassignMutation = useMutation({
    mutationFn: (picKaryawanId: number) => errorLogApi.reassign(id, picKaryawanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-log', id] });
      queryClient.invalidateQueries({ queryKey: ['error-log'] });
      toast.success('Handler dialihkan ke PIC lain.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal alihkan handler.'),
  });

  const confirmDelete = () => {
    Alert.alert('Hapus Error Log?', 'Laporan ini akan dihapus permanen.', [
      { text: 'Batal' },
      { text: 'Hapus', style: 'destructive', onPress: () => destroyMut.mutate() },
    ]);
  };

  // Konfirmasi pilihan PIC saat reassign
  const handlePickPic = (opt: PickerOption) => {
    setReassignOpen(false);
    if (opt.id == null) return;
    const picId   = Number(opt.id);
    const picNama = opt.label;
    Alert.alert(
      'Alihkan Handler?',
      `Alihkan tugas error log ini ke ${picNama}? PIC baru & pelapor akan diberitahu.`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Alihkan', onPress: () => reassignMutation.mutate(picId) },
      ],
    );
  };

  // Konfirmasi aksi pelapor — tutup kasus / buka kembali laporan
  const confirmStatus = (status: ErrorLogStatus) => {
    const isClose = status === 'closed';
    Alert.alert(
      isClose ? 'Tutup Laporan?' : 'Buka Kembali Laporan?',
      isClose
        ? 'Laporan error ini akan ditandai selesai (Closed).'
        : 'Laporan akan dibuka kembali ke status Open agar dapat ditangani ulang.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: isClose ? 'Tutup' : 'Buka Kembali',
          style: isClose ? 'default' : 'destructive',
          onPress: () => statusMutation.mutate(status),
        },
      ],
    );
  };

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  const log = data.data;
  const komentarList = data.komentar.data;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{
        flex: 1,
        paddingBottom: kbHeight > 0
          ? kbHeight + (Platform.OS === 'android' ? insets.bottom : 0)
          : 0,
      }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Detail Error Log</Text>
          {log.can_edit && (
            <>
              <TouchableOpacity onPress={() => navigation.navigate('CreateErrorLog', { id })} style={styles.backBtn}>
                <Ionicons name="create-outline" size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} style={styles.backBtn}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={onContentReady}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {/* Klien + kategori */}
          <View style={styles.headerInfo}>
            {log.klien?.nama && (
              <Text style={styles.klienText}>
                <Ionicons name="business-outline" size={14} color="#3b82f6" /> {log.klien.nama}
              </Text>
            )}
            {log.kategori?.nama && (
              <Text style={styles.kategoriText}>
                <Ionicons name="pricetag-outline" size={12} color="#8a94a6" /> {log.kategori.nama}
              </Text>
            )}
          </View>

          {/* Foto carousel */}
          {log.foto_urls && log.foto_urls.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <PhotoCarousel
                fotos={log.foto_urls}
                height={250}
                onPressPhoto={(uri) => setPhotoViewerUri(uri)}
              />
            </View>
          )}

          {/* Video */}
          {log.video_thumbnail_url && log.video_url && (
            <View style={{ marginBottom: 12 }}>
              <VideoThumbnail
                thumbnailUri={log.video_thumbnail_url}
                durationSec={log.video_duration_sec}
                onPress={() => setVideoPlayerUri(log.video_url)}
                height={250}
              />
            </View>
          )}

          {/* Keterangan */}
          <Text style={styles.sectionLabel}>KETERANGAN</Text>
          <Text style={styles.keterangan}>{log.keterangan}</Text>

          {/* URL & credentials */}
          {(log.url || log.username) && (
            <>
              <Text style={styles.sectionLabel}>AKSES</Text>
              <View style={styles.infoBox}>
                {log.url && <InfoRow icon="link-outline" label="URL" value={log.url} />}
                {log.username && <InfoRow icon="person-outline" label="Username" value={log.username} />}
                {log.password && <InfoRow icon="key-outline" label="Password" value={log.password} />}
              </View>
            </>
          )}

          {/* Status */}
          <Text style={styles.sectionLabel}>STATUS</Text>

          {/* Status saat ini — selalu tampil */}
          {(() => {
            const cur = STATUS_OPTIONS.find((s) => s.key === log.status);
            return cur ? (
              <View style={[styles.statusBadge,
                { backgroundColor: cur.color + '30', borderColor: cur.color }]}>
                <View style={[styles.statusDot, { backgroundColor: cur.color }]} />
                <Text style={[styles.statusBadgeText, { color: cur.color }]}>{cur.label}</Text>
              </View>
            ) : null;
          })()}

          {/* Aksi handler — ubah status penanganan (in_progress / resolved) */}
          {log.can_update_status && log.status !== 'closed' && (
            <View style={styles.statusActionWrap}>
              <Text style={styles.statusHint}>Ubah status penanganan</Text>
              <View style={styles.statusGroup}>
                {HANDLER_KEYS.map((key) => {
                  const s = STATUS_OPTIONS.find((o) => o.key === key)!;
                  const isCurrent = log.status === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => statusMutation.mutate(key)}
                      disabled={statusMutation.isPending || isCurrent}
                      style={[
                        styles.statusBtn,
                        isCurrent && { backgroundColor: s.color + '30', borderColor: s.color },
                      ]}
                    >
                      <Text style={[
                        styles.statusBtnText,
                        isCurrent && { color: s.color, fontWeight: '700' },
                      ]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Aksi handler — alihkan handler ke PIC lain (overhandle) */}
          {log.can_reassign && log.status !== 'closed' && (
            <View style={styles.statusActionWrap}>
              <Text style={styles.statusHint}>Alihkan handler ke PIC lain</Text>
              <TouchableOpacity
                onPress={() => setReassignOpen(true)}
                disabled={reassignMutation.isPending}
                style={[styles.statusBtn, styles.statusActionBtn,
                  { borderColor: 'rgba(245,158,11,0.40)', alignSelf: 'stretch' }]}
              >
                <Ionicons name="swap-horizontal" size={14} color="#f59e0b" />
                <Text style={[styles.statusBtnText, { color: '#f59e0b', fontWeight: '600' }]}>
                  Alihkan ke PIC Lain
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Aksi pelapor — tutup kasus / buka kembali laporan */}
          {log.can_close && (
            <View style={styles.statusActionWrap}>
              <Text style={styles.statusHint}>Tindakan pelapor</Text>
              <View style={styles.statusGroup}>
                {log.status !== 'closed' && (
                  <TouchableOpacity
                    onPress={() => confirmStatus('closed')}
                    disabled={statusMutation.isPending}
                    style={[styles.statusBtn, styles.statusActionBtn]}
                  >
                    <Ionicons name="lock-closed" size={14} color="#8a94a6" />
                    <Text style={styles.statusBtnText}>Closed</Text>
                  </TouchableOpacity>
                )}
                {(log.status === 'resolved' || log.status === 'unresolved' || log.status === 'closed') && (
                  <TouchableOpacity
                    onPress={() => confirmStatus('open')}
                    disabled={statusMutation.isPending}
                    style={[styles.statusBtn, styles.statusActionBtn,
                      { borderColor: 'rgba(239,68,68,0.40)' }]}
                  >
                    <Ionicons name="refresh" size={14} color="#ef4444" />
                    <Text style={[styles.statusBtnText, { color: '#ef4444' }]}>Open</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Pelapor + handler */}
          <Text style={styles.sectionLabel}>PIHAK TERLIBAT</Text>
          <View style={styles.infoBox}>
            {log.pelapor && (
              <UserRow
                label="Pelapor"
                nama={log.pelapor.nama_lengkap}
                foto={log.pelapor.foto}
              />
            )}
            {log.handler && (
              <UserRow
                label="Handler"
                nama={log.handler.nama_lengkap}
                foto={log.handler.foto}
              />
            )}
          </View>

          {/* Catatan penanganan */}
          {log.catatan_penanganan && (
            <>
              <Text style={styles.sectionLabel}>CATATAN PENANGANAN</Text>
              <View style={styles.catatanBox}>
                <Text style={styles.catatanText}>{log.catatan_penanganan}</Text>
              </View>
            </>
          )}

          {log.resolved_at && (
            <Text style={styles.resolvedText}>
              ✅ Resolved pada {formatDate(log.resolved_at)}
            </Text>
          )}

          {/* Komentar */}
          <Text style={styles.sectionLabel}>KOMENTAR ({komentarList.length})</Text>
          {komentarList.length > 0 ? (
            komentarList.map((k) => (
              <View key={k.id}>
                <KomentarItem
                  k={k}
                  bindRef={registerKomRef(k.id)}
                  highlighted={highlightedId === k.id}
                  onReply={() => setReplyTo({ id: k.id, nama: k.nama })}
                />
                {k.replies && k.replies.length > 0 && k.replies.map((r) => (
                  <View key={r.id} style={komStyles.replyWrap}>
                    <KomentarItem
                      k={r}
                      bindRef={registerKomRef(r.id)}
                      highlighted={highlightedId === r.id}
                      onReply={() => setReplyTo({ id: k.id, nama: r.nama })}
                    />
                  </View>
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Belum ada komentar.</Text>
          )}
        </ScrollView>

        {/* Reply banner */}
        {replyTo && (
          <View style={styles.replyBanner}>
            <Ionicons name="arrow-undo" size={14} color="#3b82f6" />
            <Text style={styles.replyBannerText}>Membalas <Text style={{ fontWeight: '700' }}>{replyTo.nama}</Text></Text>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color="#8a94a6" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input komentar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.mentionBtn} onPress={() => setMentionOpen(true)}>
            <Ionicons name="at" size={18} color="#3b82f6" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={replyTo ? `Balas ${replyTo.nama}...` : 'Tulis komentar... ketik @ untuk mention'}
            placeholderTextColor="#6b7280"
            value={komentar}
            onChangeText={handleKomentarChange}
            multiline
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => komentar.trim() && commentMutation.mutate(komentar.trim())}
            disabled={!komentar.trim() || commentMutation.isPending}
          >
            {commentMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>

        {kbHeight === 0 && (
          <View style={{ height: insets.bottom, backgroundColor: '#0a0f1a' }} />
        )}
      </View>

      <KaryawanPicker
        visible={mentionOpen}
        onClose={() => { setMentionOpen(false); setMentionAt(null); }}
        mode="single"
        onPick={insertMention}
        title="Mention Karyawan"
      />

      <VideoPlayerModal
        visible={!!videoPlayerUri}
        videoUri={videoPlayerUri}
        onClose={() => setVideoPlayerUri(null)}
      />

      <ImageViewerModal
        uri={photoViewerUri}
        onClose={() => setPhotoViewerUri(null)}
      />

      <PickerSheet
        visible={reassignOpen}
        title="Pilih PIC Baru"
        options={handlerOptions}
        selectedId={null}
        onPick={handlePickPic}
        onClose={() => setReassignOpen(false)}
        searchable
      />
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  const isUrlField = label.toUpperCase() === 'URL';
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon} size={14} color="#3b82f6" />
      <Text style={infoStyles.label}>{label}:</Text>
      {isUrlField ? (
        <LinkText text={value} style={infoStyles.value} />
      ) : (
        <Text style={infoStyles.value} selectable>{value}</Text>
      )}
    </View>
  );
}

function UserRow({ label, nama, foto }: { label: string; nama: string; foto: string | null }) {
  return (
    <View style={infoStyles.userRow}>
      {foto ? (
        <Image source={{ uri: foto }} style={infoStyles.avatar} />
      ) : (
        <View style={[infoStyles.avatar, infoStyles.avatarFallback]}>
          <Text style={infoStyles.avatarText}>{nama.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.userName}>{nama}</Text>
      </View>
    </View>
  );
}

function KomentarItem({ k, bindRef, highlighted, onReply }: {
  k: ErrorLogKomentar;
  bindRef?: (v: View | null) => void;
  highlighted?: boolean;
  onReply?: () => void;
}) {
  return (
    <View ref={bindRef} style={[komStyles.item, highlighted && komStyles.itemHighlight]}>
      {k.foto ? (
        <Image source={{ uri: k.foto }} style={komStyles.avatar} />
      ) : (
        <View style={[komStyles.avatar, komStyles.avatarFallback]}>
          <Text style={komStyles.avatarText}>{k.nama.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={komStyles.nama}>{k.nama}</Text>
        <MentionText text={k.komentar} style={komStyles.text} />
        {onReply && (
          <TouchableOpacity onPress={onReply} hitSlop={6}>
            <Text style={komStyles.replyBtn}>Balas</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  label:     { color: '#8a94a6', fontSize: 11, fontWeight: '500' },
  value:     { color: '#fff', fontSize: 13, flex: 1 },
  userRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: '#fff', fontWeight: '700' },
  userName:  { color: '#fff', fontSize: 13, fontWeight: '500', marginTop: 2 },
});

const komStyles = StyleSheet.create({
  item:    { flexDirection: 'row', marginBottom: 12, padding: 8, borderRadius: 8 },
  itemHighlight: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.40)',
  },
  replyWrap: {
    marginLeft: 30, paddingLeft: 8,
    borderLeftWidth: 2, borderLeftColor: 'rgba(59,130,246,0.30)',
  },
  replyBtn: { color: '#3b82f6', fontSize: 11, fontWeight: '600', marginTop: 4 },
  avatar:  { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  nama:    { color: '#fff', fontWeight: '600', fontSize: 13 },
  text:    { color: '#c5cdd9', fontSize: 13, marginTop: 2, lineHeight: 18 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 24 },
  headerInfo: { marginBottom: 12 },
  klienText: { color: '#3b82f6', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  kategoriText: { color: '#8a94a6', fontSize: 12 },
  sectionLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 16, marginBottom: 8,
  },
  keterangan: { color: '#fff', fontSize: 14, lineHeight: 21 },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statusGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusBtn: {
    flex: 1, minWidth: 70, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  statusBtnText: { color: '#8a94a6', fontSize: 12 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 13, fontWeight: '700' },
  statusActionWrap: { marginTop: 12 },
  statusHint: { color: '#6b7280', fontSize: 11, marginBottom: 6 },
  statusActionBtn: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  catatanBox: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.20)',
    borderRadius: 8, padding: 10,
  },
  catatanText: { color: '#d6dce6', fontSize: 13, lineHeight: 19 },
  resolvedText: { color: '#22c55e', fontSize: 12, marginTop: 8, textAlign: 'center' },
  emptyText: { color: '#6b7280', fontSize: 12, fontStyle: 'italic' },
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderTopWidth: 1, borderTopColor: 'rgba(59,130,246,0.25)',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  replyBannerText: { color: '#c5cdd9', fontSize: 12, flex: 1 },
  inputBar: {
    flexDirection: 'row', padding: 8, gap: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0a0f1a',
  },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    maxHeight: 100, fontSize: 14,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
  mentionBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
});
