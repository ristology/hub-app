import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Alert, Modal, FlatList, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useTabBarStyle } from '../../navigation/useTabBarStyle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  requestApi, type RequestKomentar, type PicRingkas,
} from '../../api/clientRequest';
import PhotoCarousel  from '../../components/PhotoCarousel';
import KaryawanPicker from '../../components/KaryawanPicker';
import MentionText    from '../../components/MentionText';
import { useKomentarHighlight } from '../../hooks/useKomentarHighlight';
import type { KaryawanRingkas } from '../../api/feed';

type RouteParams = { id: number; highlightKomentarId?: number | null };

const STATUS_STYLE = {
  menunggu: { bg: 'rgba(107,114,128,0.20)', color: '#8a94a6', label: 'Menunggu' },
  diterima: { bg: 'rgba(59,130,246,0.20)',  color: '#3b82f6', label: 'Diterima' },
  proses:   { bg: 'rgba(245,158,11,0.20)',  color: '#f59e0b', label: 'Dalam Proses' },
  selesai:  { bg: 'rgba(34,197,94,0.20)',   color: '#22c55e', label: 'Selesai' },
  ditolak:  { bg: 'rgba(239,68,68,0.20)',   color: '#ef4444', label: 'Ditolak' },
} as const;

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTime(s: string): string {
  const d = new Date(s);
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function RequestDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { id, highlightKomentarId } = route.params;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const tabBarStyle = useTabBarStyle();

  // Sembunyikan bottom tab bar saat di Request detail (full-screen UX dgn komentar input).
  // Pakai useFocusEffect karena RequestDetail ada di nested stack 2 level
  // (Menu Tab → MenuStack → Request → RequestStack → RequestDetail) yg tidak
  // ter-handle oleh getFocusedRouteNameFromRoute (1-level traversal saja).
  useFocusEffect(React.useCallback(() => {
    let nav: any = navigation.getParent();
    while (nav && nav.getState?.()?.type !== 'tab') {
      nav = nav.getParent?.();
    }
    if (!nav) return;
    nav.setOptions({ tabBarStyle: { display: 'none' } });
    return () => nav.setOptions({ tabBarStyle });
  }, [navigation, tabBarStyle]));
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showName, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideName, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  const { scrollRef, onScroll, registerKomRef, highlightedId, onContentReady } = useKomentarHighlight(highlightKomentarId);

  const [komentar, setKomentar] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAt,   setMentionAt]   = useState<number | null>(null);
  const [replyTo,     setReplyTo]     = useState<{ id: number; nama: string } | null>(null);

  const [terimaOpen, setTerimaOpen] = useState(false);
  const [tolakOpen,  setTolakOpen]  = useState(false);
  const [responOpen, setResponOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['request', id],
    queryFn:  () => requestApi.detail(id),
    refetchInterval: 5000, // Polling utk update komentar realtime
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['request', id] });
    queryClient.invalidateQueries({ queryKey: ['request'] });
    queryClient.invalidateQueries({ queryKey: ['request-stats'] });
  };

  const terimaMut = useMutation({
    mutationFn: (picUserId: number) => requestApi.terima(id, picUserId),
    onSuccess: () => { invalidate(); setTerimaOpen(false); },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal terima request.'),
  });

  const tolakMut = useMutation({
    mutationFn: (alasan: string) => requestApi.tolak(id, alasan),
    onSuccess: () => { invalidate(); setTolakOpen(false); },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal tolak request.'),
  });

  const selesaiMut = useMutation({
    mutationFn: () => requestApi.selesai(id),
    onSuccess: () => invalidate(),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal selesaikan request.'),
  });

  const responMut = useMutation({
    mutationFn: (payload: { catatan: string; pic_id?: number; proses?: boolean }) => requestApi.respon(id, payload),
    onSuccess: () => { invalidate(); setResponOpen(false); },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal kirim respon.'),
  });

  const commentMut = useMutation({
    mutationFn: (text: string) => requestApi.comment(id, text, replyTo?.id),
    onSuccess: () => { setKomentar(''); setReplyTo(null); invalidate(); },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal kirim komentar.'),
  });

  const destroyMut = useMutation({
    mutationFn: () => requestApi.destroy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['request-stats'] });
      toast.success('Request dihapus.');
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus.'),
  });

  const confirmDelete = () => {
    Alert.alert('Hapus Request?', 'Request beserta semua respon dan komentarnya akan dihapus permanen.', [
      { text: 'Batal' },
      { text: 'Hapus', style: 'destructive', onPress: () => destroyMut.mutate() },
    ]);
  };

  const handleKomentarChange = (next: string) => {
    if (next.length > komentar.length && next.charAt(next.length - 1) === '@') {
      setMentionAt(next.length - 1);
      setMentionOpen(true);
    }
    setKomentar(next);
  };

  const insertMention = (k: KaryawanRingkas) => {
    const tag = '@' + k.nama.replace(/\s+/g, '_') + ' ';
    if (mentionAt !== null) {
      setKomentar(komentar.substring(0, mentionAt) + tag + komentar.substring(mentionAt + 1));
    } else {
      setKomentar((prev) => (prev ? `${prev} ${tag}` : tag));
    }
    setMentionAt(null);
  };

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </SafeAreaView>
    );
  }

  const r = data.data;
  const isIt = data.is_it_admin;
  const komentarList = data.komentar.data;
  const statusStyle = STATUS_STYLE[r.status];

  const canTerima  = isIt && r.status === 'menunggu';
  const canTolak   = isIt && (r.status === 'menunggu' || r.status === 'diterima');
  const canSelesai = isIt && (r.status === 'diterima' || r.status === 'proses');
  const canRespon  = isIt && r.status !== 'selesai' && r.status !== 'ditolak';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{
        flex: 1,
        paddingBottom: kbHeight > 0
          ? kbHeight + (Platform.OS === 'android' ? insets.bottom : 0)
          : 0,
      }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Detail Request</Text>
          {r.can_edit && (
            <TouchableOpacity onPress={confirmDelete} style={styles.backBtn}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={onContentReady}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <Text style={styles.namaKlien}>{r.nama_klien}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
          </View>

          {/* Lampiran gambar */}
          {r.gambar_urls && r.gambar_urls.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <PhotoCarousel fotos={r.gambar_urls} height={250} />
            </View>
          )}

          {/* Keterangan */}
          <Text style={styles.sectionLabel}>KETERANGAN</Text>
          <Text style={styles.keterangan}>{r.keterangan}</Text>

          {/* Tanggal & deadline */}
          <Text style={styles.sectionLabel}>JADWAL</Text>
          <View style={styles.infoBox}>
            <InfoRow icon="calendar-outline" label="Tanggal Request" value={formatDate(r.tanggal_request)} />
            <InfoRow icon="flag-outline" label="Deadline" value={formatDate(r.deadline)}
              valueColor={r.deadline_status === 'overdue' ? '#ef4444' : r.deadline_status === 'near' ? '#f59e0b' : undefined}
            />
          </View>

          {/* Pencatat & PIC */}
          <Text style={styles.sectionLabel}>PIHAK TERLIBAT</Text>
          <View style={styles.infoBox}>
            {r.pencatat && (
              <UserRow label="Dicatat oleh" nama={r.pencatat.nama_lengkap} foto={r.pencatat.foto} />
            )}
            {r.pic && (
              <UserRow label="PIC" nama={r.pic.nama_lengkap} foto={r.pic.foto} />
            )}
            {!r.pic && (
              <Text style={styles.notAssigned}>PIC belum ditentukan</Text>
            )}
          </View>

          {/* Alasan tolak */}
          {r.status === 'ditolak' && r.alasan_tolak && (
            <>
              <Text style={styles.sectionLabel}>ALASAN PENOLAKAN</Text>
              <View style={styles.alasanBox}>
                <Text style={styles.alasanText}>{r.alasan_tolak}</Text>
              </View>
            </>
          )}

          {/* Dokumen lampiran */}
          {r.dokumen && r.dokumen.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>DOKUMEN</Text>
              {r.dokumen.map((d) => (
                <TouchableOpacity key={d.id} style={styles.docItem} onPress={() => Linking.openURL(d.url)}>
                  <Ionicons name="document-text-outline" size={20} color="#3b82f6" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName} numberOfLines={1}>{d.nama}</Text>
                    <Text style={styles.docSize}>{(d.ukuran / 1024).toFixed(0)} KB</Text>
                  </View>
                  <Ionicons name="download-outline" size={18} color="#8a94a6" />
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Aksi IT/Admin */}
          {isIt && (canTerima || canTolak || canSelesai || canRespon) && (
            <>
              <Text style={styles.sectionLabel}>AKSI IT / ADMIN</Text>
              <View style={styles.actionRow}>
                {canTerima && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBlue]} onPress={() => setTerimaOpen(true)}>
                    <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
                    <Text style={[styles.actionText, { color: '#3b82f6' }]}>Terima</Text>
                  </TouchableOpacity>
                )}
                {canTolak && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionRed]} onPress={() => setTolakOpen(true)}>
                    <Ionicons name="close-circle" size={16} color="#ef4444" />
                    <Text style={[styles.actionText, { color: '#ef4444' }]}>Tolak</Text>
                  </TouchableOpacity>
                )}
                {canSelesai && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionGreen]}
                    onPress={() => Alert.alert('Konfirmasi', 'Tandai request ini sebagai selesai?', [
                      { text: 'Batal' },
                      { text: 'Selesai', onPress: () => selesaiMut.mutate() },
                    ])}>
                    <Ionicons name="checkmark-done" size={16} color="#22c55e" />
                    <Text style={[styles.actionText, { color: '#22c55e' }]}>Selesai</Text>
                  </TouchableOpacity>
                )}
                {canRespon && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionYellow]} onPress={() => setResponOpen(true)}>
                    <Ionicons name="chatbox-ellipses" size={16} color="#f59e0b" />
                    <Text style={[styles.actionText, { color: '#f59e0b' }]}>Respon</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Riwayat respon */}
          {r.respon && r.respon.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>RIWAYAT RESPON ({r.respon.length})</Text>
              {r.respon.map((rp) => (
                <View key={rp.id} style={styles.responItem}>
                  <View style={styles.responHeader}>
                    <Text style={styles.responUser}>{rp.user?.nama ?? '—'}</Text>
                    <Text style={styles.responDate}>{formatDateTime(rp.created_at)}</Text>
                  </View>
                  {rp.status_sebelum !== rp.status_sesudah && (
                    <Text style={styles.responStatusChange}>
                      {rp.status_sebelum} → <Text style={{ color: '#3b82f6' }}>{rp.status_sesudah}</Text>
                    </Text>
                  )}
                  <Text style={styles.responCatatan}>{rp.catatan}</Text>
                </View>
              ))}
            </>
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
            onPress={() => komentar.trim() && commentMut.mutate(komentar.trim())}
            disabled={!komentar.trim() || commentMut.isPending}
          >
            {commentMut.isPending
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

      <TerimaModal
        visible={terimaOpen}
        onClose={() => setTerimaOpen(false)}
        onSubmit={(picUserId) => terimaMut.mutate(picUserId)}
        loading={terimaMut.isPending}
      />

      <TolakModal
        visible={tolakOpen}
        onClose={() => setTolakOpen(false)}
        onSubmit={(alasan) => tolakMut.mutate(alasan)}
        loading={tolakMut.isPending}
      />

      <ResponModal
        visible={responOpen}
        onClose={() => setResponOpen(false)}
        canMarkProses={r.status === 'diterima'}
        onSubmit={(payload) => responMut.mutate(payload)}
        loading={responMut.isPending}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, valueColor }:
  { icon: any; label: string; value: string; valueColor?: string }) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon} size={14} color="#3b82f6" />
      <View style={{ flex: 1 }}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, valueColor && { color: valueColor }]}>{value}</Text>
      </View>
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
  k: RequestKomentar;
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

// ─────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────

function TerimaModal({ visible, onClose, onSubmit, loading }: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (picUserId: number) => void;
  loading: boolean;
}) {
  const [picList, setPicList] = useState<PicRingkas[]>([]);
  const [loadingPic, setLoadingPic] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadingPic(true);
    requestApi.listPic()
      .then(({ data }) => setPicList(data))
      .finally(() => setLoadingPic(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Pilih PIC untuk Terima Request</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {loadingPic ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 30 }} />
          ) : picList.length === 0 ? (
            <Text style={modalStyles.empty}>Tidak ada karyawan IT yang tersedia.</Text>
          ) : (
            <FlatList
              data={picList}
              keyExtractor={(item) => String(item.user_id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => onSubmit(item.user_id)}
                  disabled={loading}
                  style={modalStyles.picItem}
                >
                  {item.foto ? (
                    <Image source={{ uri: item.foto }} style={modalStyles.picAvatar} />
                  ) : (
                    <View style={[modalStyles.picAvatar, modalStyles.picAvatarFb]}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>
                        {item.nama.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={modalStyles.picName}>{item.nama}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#6b7280" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function TolakModal({ visible, onClose, onSubmit, loading }: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (alasan: string) => void;
  loading: boolean;
}) {
  const [alasan, setAlasan] = useState('');

  useEffect(() => { if (visible) setAlasan(''); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={modalStyles.backdrop}
      >
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Tolak Request</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.label}>Alasan penolakan</Text>
          <TextInput
            style={[modalStyles.input, { minHeight: 100 }]}
            placeholder="Tulis alasan kenapa request ditolak..."
            placeholderTextColor="#6b7280"
            value={alasan}
            onChangeText={setAlasan}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[modalStyles.submitBtn, { backgroundColor: '#ef4444' }]}
            onPress={() => alasan.trim() && onSubmit(alasan.trim())}
            disabled={!alasan.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={modalStyles.submitText}>Tolak Request</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ResponModal({ visible, onClose, onSubmit, loading, canMarkProses }: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: { catatan: string; pic_id?: number; proses?: boolean }) => void;
  loading: boolean;
  canMarkProses: boolean;
}) {
  const [catatan, setCatatan] = useState('');
  const [proses, setProses]   = useState(false);
  const [picId,  setPicId]    = useState<number | null>(null);
  const [picNama, setPicNama] = useState<string | null>(null);
  const [picModalOpen, setPicModalOpen] = useState(false);
  const [picList, setPicList] = useState<PicRingkas[]>([]);

  useEffect(() => {
    if (!visible) {
      setCatatan(''); setProses(false); setPicId(null); setPicNama(null);
      return;
    }
    requestApi.listPic().then(({ data }) => setPicList(data));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={modalStyles.backdrop}
      >
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Tambah Respon</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.label}>Catatan respon</Text>
          <TextInput
            style={[modalStyles.input, { minHeight: 100 }]}
            placeholder="Update progress, catatan teknis, dll..."
            placeholderTextColor="#6b7280"
            value={catatan}
            onChangeText={setCatatan}
            multiline
            textAlignVertical="top"
          />

          <Text style={modalStyles.label}>Assign / Ubah PIC (opsional)</Text>
          <TouchableOpacity style={modalStyles.input} onPress={() => setPicModalOpen(true)}>
            <Text style={{ color: picNama ? '#fff' : '#6b7280', fontSize: 14 }}>
              {picNama ?? 'Pilih PIC...'}
            </Text>
          </TouchableOpacity>

          {canMarkProses && (
            <TouchableOpacity
              style={modalStyles.checkRow}
              onPress={() => setProses((p) => !p)}
            >
              <Ionicons
                name={proses ? 'checkbox' : 'square-outline'}
                size={22}
                color={proses ? '#3b82f6' : '#8a94a6'}
              />
              <Text style={modalStyles.checkText}>Ubah status ke "Dalam Proses"</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[modalStyles.submitBtn, { backgroundColor: '#3b82f6' }]}
            onPress={() => catatan.trim() && onSubmit({
              catatan: catatan.trim(),
              pic_id:  picId ?? undefined,
              proses,
            })}
            disabled={!catatan.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={modalStyles.submitText}>Kirim Respon</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Sub-modal pilih PIC */}
        <Modal visible={picModalOpen} animationType="fade" transparent onRequestClose={() => setPicModalOpen(false)}>
          <TouchableOpacity style={modalStyles.backdrop} activeOpacity={1} onPress={() => setPicModalOpen(false)}>
            <View style={[modalStyles.sheet, { maxHeight: '70%' }]}>
              <View style={modalStyles.handle} />
              <View style={modalStyles.header}>
                <Text style={modalStyles.title}>Pilih PIC</Text>
                <TouchableOpacity onPress={() => setPicModalOpen(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={picList}
                keyExtractor={(item) => String(item.user_id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setPicId(item.user_id);
                      setPicNama(item.nama);
                      setPicModalOpen(false);
                    }}
                    style={modalStyles.picItem}
                  >
                    {item.foto ? (
                      <Image source={{ uri: item.foto }} style={modalStyles.picAvatar} />
                    ) : (
                      <View style={[modalStyles.picAvatar, modalStyles.picAvatarFb]}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>{item.nama.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={modalStyles.picName}>{item.nama}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────

const infoStyles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  label:     { color: '#8a94a6', fontSize: 11, marginBottom: 2 },
  value:     { color: '#fff', fontSize: 13, fontWeight: '500' },
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

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d1421', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 24, maxHeight: '85%', minHeight: '40%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginTop: 8, marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  title:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  label: {
    color: '#8a94a6', fontSize: 12, fontWeight: '600',
    marginTop: 8, marginBottom: 6, letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10,
    fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  submitBtn: {
    paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 16,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  checkText: { color: '#fff', fontSize: 13 },
  picItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8,
  },
  picAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c2333' },
  picAvatarFb: { alignItems: 'center', justifyContent: 'center' },
  picName: { color: '#fff', fontSize: 14, flex: 1 },
  empty: { color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 30 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },
  scroll: { padding: 16, paddingBottom: 24 },
  namaKlien: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statusPill: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12, marginTop: 8,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  sectionLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 18, marginBottom: 8,
  },
  keterangan: { color: '#fff', fontSize: 14, lineHeight: 21 },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  notAssigned: { color: '#6b7280', fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },
  alasanBox: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.20)',
    borderRadius: 8, padding: 10,
  },
  alasanText: { color: '#ffd6d6', fontSize: 13, lineHeight: 19 },
  docItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, padding: 10, marginBottom: 6,
  },
  docName: { color: '#fff', fontSize: 13, fontWeight: '500' },
  docSize: { color: '#8a94a6', fontSize: 11, marginTop: 1 },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1,
  },
  actionBlue:   { backgroundColor: 'rgba(59,130,246,0.10)',  borderColor: 'rgba(59,130,246,0.40)' },
  actionRed:    { backgroundColor: 'rgba(239,68,68,0.10)',   borderColor: 'rgba(239,68,68,0.40)' },
  actionGreen:  { backgroundColor: 'rgba(34,197,94,0.10)',   borderColor: 'rgba(34,197,94,0.40)' },
  actionYellow: { backgroundColor: 'rgba(245,158,11,0.10)',  borderColor: 'rgba(245,158,11,0.40)' },
  actionText: { fontSize: 12, fontWeight: '600' },

  responItem: {
    backgroundColor: 'rgba(59,130,246,0.05)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  responHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  responUser: { color: '#fff', fontWeight: '600', fontSize: 12 },
  responDate: { color: '#6b7280', fontSize: 11 },
  responStatusChange: { color: '#8a94a6', fontSize: 11, marginBottom: 4, fontStyle: 'italic' },
  responCatatan: { color: '#d6dce6', fontSize: 13, lineHeight: 19 },

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
