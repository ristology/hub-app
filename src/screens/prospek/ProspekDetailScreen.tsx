import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Alert, Linking, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { prospekApi, type ProspekStatus, type ProspekKomentar } from '../../api/prospek';
import { notifApi, NotifModel } from '../../api/notif';
import KaryawanPicker from '../../components/KaryawanPicker';
import MentionText    from '../../components/MentionText';
import { useKomentarHighlight } from '../../hooks/useKomentarHighlight';
import { formatRelativeDanTanggal } from '../../utils/formatDate';
import DatePickerInput from '../../components/DatePickerInput';
import { useToast } from '../../components/Toast';
import type { KaryawanRingkas } from '../../api/feed';

type RouteParams = { id: number; highlightKomentarId?: number | null };

const STATUS_OPTIONS: { key: ProspekStatus; label: string; color: string }[] = [
  { key: 'prospek',   label: 'Prospek',   color: '#8a94a6' },
  { key: 'follow_up', label: 'Follow Up', color: '#06b6d4' },
  { key: 'proposal',  label: 'Proposal',  color: '#3b82f6' },
  { key: 'negosiasi', label: 'Negosiasi', color: '#f59e0b' },
  { key: 'trial',     label: 'Trial',     color: '#a855f7' },
  { key: 'kontrak',   label: 'Kontrak',   color: '#22c55e' },
  { key: 'batal',     label: 'Batal',     color: '#ef4444' },
];

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ProspekDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { id, highlightKomentarId } = route.params;
  const queryClient = useQueryClient();

  // Tandai notif Prospek ini sebagai dibaca → badge bottom tab + list +
  // stats + home menu badge semua refresh. Optimistic decrement supaya
  // badge hilang instant tanpa nunggu refetch.
  useEffect(() => {
    queryClient.setQueryData(['notif-count'], (old: any) =>
      old ? { ...old, prospek: Math.max(0, (old.prospek ?? 0) - 1) } : old
    );
    notifApi.markRead(NotifModel.Prospek, id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['notif-count'] });
        queryClient.invalidateQueries({ queryKey: ['prospek'] });
        queryClient.invalidateQueries({ queryKey: ['prospek-stats'] });
        queryClient.invalidateQueries({ queryKey: ['home-prospek'] });
      })
      .catch(() => {});
  }, [id]);

  const { scrollRef, onScroll, registerKomRef, highlightedId, onContentReady, scrollToKomentar } = useKomentarHighlight(highlightKomentarId);
  const [komentar, setKomentar] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAt,   setMentionAt]   = useState<number | null>(null);
  const [replyTo,     setReplyTo]     = useState<{ id: number; nama: string } | null>(null);

  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);

  // Manual keyboard listener — pattern sama dgn ChatRoomScreen
  useEffect(() => {
    const showName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showName, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideName, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Bottom sheet "Tambah catatan pertemuan"
  const [pertemuanOpen, setPertemuanOpen] = useState(false);
  const [pertTanggal,    setPertTanggal]    = useState('');
  const [pertBerikutnya, setPertBerikutnya] = useState('');
  const [pertKeterangan, setPertKeterangan] = useState('');
  const toast = useToast();

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
    queryKey: ['prospek', id],
    queryFn:  () => prospekApi.detail(id),
    refetchInterval: 5000, // Polling utk update komentar realtime
  });

  const statusMutation = useMutation({
    mutationFn: (status: ProspekStatus) => prospekApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospek', id] });
      queryClient.invalidateQueries({ queryKey: ['prospek'] });
      queryClient.invalidateQueries({ queryKey: ['prospek-stats'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => prospekApi.comment(id, text, replyTo?.id),
    onSuccess: (response) => {
      setKomentar('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['prospek', id] });
      scrollToKomentar(response.data.id);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal kirim komentar.'),
  });

  // ── Edit komentar (long-press own, window 15 menit) ──
  const [editingKom, setEditingKom] = useState<{ id: number; original: string } | null>(null);
  const editCommentMutation = useMutation({
    mutationFn: ({ kid, text }: { kid: number; text: string }) => prospekApi.editComment(id, kid, text),
    onSuccess: () => {
      setEditingKom(null);
      setKomentar('');
      queryClient.invalidateQueries({ queryKey: ['prospek', id] });
    },
    onError: (e: any) => Alert.alert('Gagal edit', e.response?.data?.message ?? 'Periksa koneksi.'),
  });

  const handleLongPressKom = (k: ProspekKomentar) => {
    if (!k.can_edit) return;
    Alert.alert('Komentar', '', [
      { text: 'Edit', onPress: () => {
          setEditingKom({ id: k.id, original: k.komentar });
          setKomentar(k.komentar);
          setReplyTo(null);
        } },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const handleSubmitKomentar = () => {
    const t = komentar.trim();
    if (!t) return;
    if (editingKom) editCommentMutation.mutate({ kid: editingKom.id, text: t });
    else commentMutation.mutate(t);
  };

  const pertemuanMutation = useMutation({
    mutationFn: () => prospekApi.addPertemuan(id, {
      tanggal: pertTanggal,
      tanggal_berikutnya: pertBerikutnya || undefined,
      keterangan: pertKeterangan,
    }),
    onSuccess: () => {
      setPertemuanOpen(false);
      setPertTanggal(''); setPertBerikutnya(''); setPertKeterangan('');
      queryClient.invalidateQueries({ queryKey: ['prospek', id] });
      queryClient.invalidateQueries({ queryKey: ['prospek'] });
      toast.success('Pertemuan dicatat.');
    },
    onError: (e: any) => Alert.alert('Error',
      e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join('\n')
        ?? 'Gagal catat pertemuan.'),
  });

  const submitPertemuan = () => {
    if (!pertTanggal)        return Alert.alert('Validasi', 'Tanggal pertemuan wajib diisi.');
    if (!pertKeterangan.trim()) return Alert.alert('Validasi', 'Keterangan wajib diisi.');
    pertemuanMutation.mutate();
  };

  const destroyPertemuanMut = useMutation({
    mutationFn: (pertemuanId: number) => prospekApi.destroyPertemuan(id, pertemuanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospek', id] });
      queryClient.invalidateQueries({ queryKey: ['prospek'] });
      toast.success('Pertemuan dihapus.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus pertemuan.'),
  });

  const confirmDeletePertemuan = (pertemuanId: number) => {
    Alert.alert('Hapus Pertemuan?', 'Catatan pertemuan ini akan dihapus permanen.', [
      { text: 'Batal' },
      { text: 'Hapus', style: 'destructive', onPress: () => destroyPertemuanMut.mutate(pertemuanId) },
    ]);
  };

  const destroyProspekMut = useMutation({
    mutationFn: () => prospekApi.destroy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospek'] });
      queryClient.invalidateQueries({ queryKey: ['prospek-stats'] });
      toast.success('Prospek dihapus.');
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus prospek.'),
  });

  const confirmDeleteProspek = () => {
    Alert.alert(
      'Hapus Prospek?',
      `Hapus prospek "${data?.data.nama_klien ?? ''}" beserta semua pertemuan dan komentarnya? Aksi ini tidak bisa dibatalkan.`,
      [
        { text: 'Batal' },
        { text: 'Hapus', style: 'destructive', onPress: () => destroyProspekMut.mutate() },
      ],
    );
  };

  // ── Jadikan Klien Resmi (convert) ─────────────────────────
  const convertMutation = useMutation({
    mutationFn: () => prospekApi.convertToKlien(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['prospek', id] });
      queryClient.invalidateQueries({ queryKey: ['prospek'] });
      queryClient.invalidateQueries({ queryKey: ['prospek-stats'] });
      toast.success(res.message ?? 'Prospek berhasil jadi klien resmi.');
    },
    onError: (e: any) => Alert.alert('Gagal', e.response?.data?.message ?? 'Gagal jadikan klien resmi.'),
  });

  const confirmConvert = () => {
    Alert.alert(
      'Jadikan Klien Resmi?',
      `Klien "${data?.data.nama_klien ?? ''}" akan didaftarkan sebagai klien resmi. Lanjutkan?`,
      [
        { text: 'Batal' },
        { text: 'Jadikan Klien', onPress: () => convertMutation.mutate() },
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

  const p = data.data;
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
          <Text style={styles.topTitle}>Detail Prospek</Text>
          {p.can_edit && (
            <>
              <TouchableOpacity onPress={() => setPertemuanOpen(true)} style={styles.addBtn}>
                <Ionicons name="add-circle-outline" size={22} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('CreateProspek', { id })} style={styles.addBtn}>
                <Ionicons name="create-outline" size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDeleteProspek} style={styles.addBtn}>
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
          {/* Nama klien */}
          <Text style={styles.namaKlien}>{p.nama_klien}</Text>
          {p.kota && <Text style={styles.subInfo}>📍 {p.kota}</Text>}

          {/* Status switcher */}
          <Text style={styles.sectionLabel}>STATUS</Text>
          {p.can_edit ? (
            <View style={styles.statusGroup}>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => statusMutation.mutate(s.key)}
                  disabled={statusMutation.isPending || p.status === s.key}
                  style={[styles.statusBtn, p.status === s.key && {
                    backgroundColor: s.color + '30', borderColor: s.color,
                  }]}
                >
                  <Text style={[styles.statusBtnText, p.status === s.key && {
                    color: s.color, fontWeight: '700',
                  }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            // Read-only: tampilkan status sekarang saja (tidak bisa diubah)
            (() => {
              const cur = STATUS_OPTIONS.find((s) => s.key === p.status);
              return cur ? (
                <View style={[styles.statusBtn, { alignSelf: 'flex-start',
                  backgroundColor: cur.color + '30', borderColor: cur.color }]}>
                  <Text style={[styles.statusBtnText, { color: cur.color, fontWeight: '700' }]}>{cur.label}</Text>
                </View>
              ) : null;
            })()
          )}

          {/* Jadikan Klien Resmi — tampil hanya kalau status='kontrak' DAN user
              adalah Creator/Admin/Direktur (backend gate via can_convert). */}
          {p.can_convert && (
            <TouchableOpacity
              style={styles.convertBtn}
              onPress={confirmConvert}
              disabled={convertMutation.isPending}
              activeOpacity={0.85}
            >
              {convertMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trophy" size={18} color="#fff" />
                  <Text style={styles.convertBtnText}>Jadikan Klien Resmi</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Kontak */}
          <Text style={styles.sectionLabel}>KONTAK</Text>
          <View style={styles.infoBox}>
            {p.kontak_nama && <InfoRow icon="person-outline" label="Nama" value={p.kontak_nama} />}
            {p.kontak_email && <InfoRow icon="mail-outline" label="Email" value={p.kontak_email}
              onPress={() => Linking.openURL(`mailto:${p.kontak_email}`)} />}
            {p.kontak_hp && <InfoRow icon="call-outline" label="HP" value={p.kontak_hp}
              onPress={() => Linking.openURL(`tel:${p.kontak_hp}`)} />}
            {p.alamat && <InfoRow icon="location-outline" label="Alamat" value={p.alamat} />}
          </View>

          {/* Tanggal pertemuan */}
          <Text style={styles.sectionLabel}>JADWAL</Text>
          <View style={styles.infoBox}>
            <InfoRow icon="calendar-outline" label="Pertemuan Pertama" value={formatDate(p.tanggal_pertemuan_pertama)} />
            <InfoRow icon="calendar-clear-outline" label="Pertemuan Terakhir" value={formatDate(p.tanggal_pertemuan_terakhir)} />
            <InfoRow
              icon="calendar-number-outline"
              label="Pertemuan Berikutnya"
              value={formatDate(p.tanggal_pertemuan_berikutnya)}
              valueColor={p.is_overdue ? '#ef4444' : undefined}
            />
          </View>

          {/* Riwayat pertemuan */}
          <Text style={styles.sectionLabel}>
            RIWAYAT PERTEMUAN ({p.pertemuan?.length ?? 0})
          </Text>
          {p.pertemuan && p.pertemuan.length > 0 && p.pertemuan.map((pt) => (
            <View key={pt.id} style={styles.pertemuanItem}>
              <View style={styles.pertemuanRow}>
                <View style={styles.pertemuanDate}>
                  <Ionicons name="calendar" size={14} color="#3b82f6" />
                  <Text style={styles.pertemuanDateText}>{formatDate(pt.tanggal)}</Text>
                </View>
                {p.can_edit && (
                  <TouchableOpacity onPress={() => confirmDeletePertemuan(pt.id)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.pertemuanKet}>{pt.keterangan}</Text>
              {pt.tanggal_berikutnya && (
                <Text style={styles.pertemuanNext}>
                  → Lanjut: {formatDate(pt.tanggal_berikutnya)}
                </Text>
              )}
            </View>
          ))}
          {p.can_edit && (
            <TouchableOpacity style={styles.addPertemuanBtn} onPress={() => setPertemuanOpen(true)}>
              <Ionicons name="add-circle" size={18} color="#22c55e" />
              <Text style={styles.addPertemuanText}>Tambah catatan pertemuan</Text>
            </TouchableOpacity>
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
                  onLongPress={() => handleLongPressKom(k)}
                />
                {k.replies && k.replies.length > 0 && k.replies.map((r) => (
                  <View key={r.id} style={komStyles.replyWrap}>
                    <KomentarItem
                      k={r}
                      bindRef={registerKomRef(r.id)}
                      highlighted={highlightedId === r.id}
                      onReply={() => setReplyTo({ id: k.id, nama: r.nama })}
                      onLongPress={() => handleLongPressKom(r)}
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
        {replyTo && !editingKom && (
          <View style={styles.replyBanner}>
            <Ionicons name="arrow-undo" size={14} color="#3b82f6" />
            <Text style={styles.replyBannerText}>Membalas <Text style={{ fontWeight: '700' }}>{replyTo.nama}</Text></Text>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color="#8a94a6" />
            </TouchableOpacity>
          </View>
        )}
        {editingKom && (
          <View style={[styles.replyBanner, { borderLeftColor: '#f59e0b' }]}>
            <Ionicons name="pencil" size={14} color="#f59e0b" />
            <Text style={[styles.replyBannerText, { color: '#fbbf24' }]} numberOfLines={1}>
              Mengedit komentar: {editingKom.original.slice(0, 60)}
            </Text>
            <TouchableOpacity onPress={() => { setEditingKom(null); setKomentar(''); }} hitSlop={8}>
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
            placeholder={
              editingKom ? 'Edit komentar...'
              : replyTo ? `Balas ${replyTo.nama}...`
              : 'Tulis komentar... ketik @ untuk mention'
            }
            placeholderTextColor="#6b7280"
            value={komentar}
            onChangeText={handleKomentarChange}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, editingKom && { backgroundColor: '#f59e0b' }]}
            onPress={handleSubmitKomentar}
            disabled={!komentar.trim() || commentMutation.isPending || editCommentMutation.isPending}
          >
            {(commentMutation.isPending || editCommentMutation.isPending)
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name={editingKom ? 'checkmark' : 'send'} size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>

        {/* Spacer warna sama dgn input bar — supaya tidak floating saat keyboard tidak aktif */}
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

      {/* Bottom sheet: Tambah catatan pertemuan */}
      <Modal visible={pertemuanOpen} transparent animationType="slide" onRequestClose={() => setPertemuanOpen(false)}>
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.sheetBackdrop}
        >
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setPertemuanOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: 24, maxHeight: '85%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Catatan Pertemuan</Text>
              <TouchableOpacity onPress={() => setPertemuanOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color="#8a94a6" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetLabel}>Tanggal Pertemuan <Text style={styles.sheetReq}>*</Text></Text>
              <DatePickerInput value={pertTanggal} onChange={setPertTanggal} />

              <Text style={styles.sheetLabel}>Tanggal Pertemuan Berikutnya</Text>
              <DatePickerInput value={pertBerikutnya} onChange={setPertBerikutnya} placeholder="Opsional" />

              <Text style={styles.sheetLabel}>Keterangan <Text style={styles.sheetReq}>*</Text></Text>
              <TextInput
                style={[styles.sheetInput, { minHeight: 110 }]}
                value={pertKeterangan}
                onChangeText={setPertKeterangan}
                placeholder="Hasil pertemuan, kesepakatan, follow-up..."
                placeholderTextColor="#6b7280"
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />

              <TouchableOpacity
                style={styles.sheetSubmit}
                onPress={submitPertemuan}
                disabled={pertemuanMutation.isPending}
              >
                {pertemuanMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.sheetSubmitText}>Simpan Pertemuan</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, onPress, valueColor }:
  { icon: any; label: string; value: string; onPress?: () => void; valueColor?: string }) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={infoStyles.row} onPress={onPress}>
      <Ionicons name={icon} size={14} color="#3b82f6" />
      <View style={{ flex: 1 }}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, valueColor && { color: valueColor }]}>{value}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={14} color="#6b7280" />}
    </Wrapper>
  );
}

function KomentarItem({ k, bindRef, highlighted, onReply, onLongPress }: {
  k: ProspekKomentar;
  bindRef?: (v: View | null) => void;
  highlighted?: boolean;
  onReply?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <TouchableOpacity
      ref={bindRef as any}
      activeOpacity={onLongPress ? 0.7 : 1}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={!onLongPress}
      style={[komStyles.item, highlighted && komStyles.itemHighlight]}
    >
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
        <Text style={komStyles.time}>
          {formatRelativeDanTanggal(k.created_at)}
          {k.edited_at ? <Text style={{ fontStyle: 'italic' }}> · diedit</Text> : null}
        </Text>
        {onReply && (
          <TouchableOpacity onPress={onReply} hitSlop={6}>
            <Text style={komStyles.replyBtn}>Balas</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  label: { color: '#8a94a6', fontSize: 11, marginBottom: 2 },
  value: { color: '#fff', fontSize: 13, fontWeight: '500' },
});

const komStyles = StyleSheet.create({
  item: { flexDirection: 'row', marginBottom: 12, padding: 8, borderRadius: 8 },
  itemHighlight: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.40)',
  },
  replyWrap: {
    marginLeft: 30, paddingLeft: 8,
    borderLeftWidth: 2, borderLeftColor: 'rgba(59,130,246,0.30)',
  },
  replyBtn: { color: '#3b82f6', fontSize: 11, fontWeight: '600', marginTop: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  nama: { color: '#fff', fontWeight: '600', fontSize: 13 },
  text: { color: '#c5cdd9', fontSize: 13, marginTop: 2, lineHeight: 18 },
  time: { color: '#6b7280', fontSize: 10, marginTop: 4 },
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
  addBtn:   { padding: 8 },
  scroll: { padding: 16, paddingBottom: 24 },
  namaKlien: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subInfo: { color: '#8a94a6', fontSize: 13, marginTop: 4 },
  sectionLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 18, marginBottom: 8,
  },
  statusGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  statusBtnText: { color: '#8a94a6', fontSize: 12 },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  pertemuanItem: {
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.20)',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  pertemuanDate: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  pertemuanDateText: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  pertemuanKet: { color: '#d6dce6', fontSize: 13, lineHeight: 19 },
  pertemuanRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pertemuanNext: { color: '#22c55e', fontSize: 11, marginTop: 4 },
  // "Jadikan Klien Resmi" — tombol solid hijau (parity dgn web btn-success)
  convertBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#22c55e',
    paddingVertical: 14, borderRadius: 12,
    marginTop: 4, marginBottom: 16,
    shadowColor: '#22c55e', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6,
    elevation: 3,
  },
  convertBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  addPertemuanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', borderStyle: 'dashed',
    paddingVertical: 12, borderRadius: 10, marginTop: 4,
  },
  addPertemuanText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1c2333',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 8,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sheetLabel: {
    color: '#8a94a6', fontSize: 12, fontWeight: '600',
    marginTop: 12, marginBottom: 6, letterSpacing: 0.5,
  },
  sheetReq:   { color: '#ef4444' },
  sheetInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10,
    fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetSubmit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3b82f6', paddingVertical: 14,
    borderRadius: 12, marginTop: 18,
  },
  sheetSubmitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
