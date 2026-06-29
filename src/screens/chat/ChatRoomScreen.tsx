import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Platform, Keyboard, Alert, Modal, Animated,
  type ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';

import { chatApi, type ChatMessage } from '../../api/chat';
import { useAuth } from '../../store/auth';
import { useToast } from '../../components/Toast';
import ImageViewerModal from '../../components/ImageViewerModal';
import VideoPlayerModal from '../../components/VideoPlayerModal';
import VideoThumbnail   from '../../components/VideoThumbnail';
import { pickAndCompressVideo, type PickedVideo, formatDuration } from '../../utils/videoPicker';
import { openDocumentExternal, openDocumentSmart } from '../../utils/openDocument';
import { transcodeHeicIfNeeded } from '../../utils/transcodeHeicIfNeeded';
import { localDateKey, formatChatDateSeparator } from '../../utils/formatDate';
import ForwardSheet from './ForwardSheet';
import MessageReadStatusModal from './MessageReadStatusModal';
import LinkText from '../../components/LinkText';

// Bottom sheet action menu — gantikan Alert.alert yg Android-nya stuck saat
// >3 button atau Modal-conflict. Backdrop tap & hardware back close otomatis
// (onRequestClose). Tap item: close dulu, baru execute (mencegah race antara
// modal unmount & action navigation/Modal lain seperti picker).
type ActionItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};
function ChatActionSheet({
  visible, title, items, onClose,
}: { visible: boolean; title?: string; items: ActionItem[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  // Android gesture nav / 3-button nav bar tinggi-nya variatif (mis. Samsung
  // gesture pill cukup besar) — hardcode paddingBottom 30 sering ketutup tombol
  // Batal. Pakai insets.bottom + 12 dgn floor 24 supaya selalu clear nav bar.
  const sheetPaddingBottom = Math.max(insets.bottom + 12, 24);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.sheetBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.sheetContainer, { paddingBottom: sheetPaddingBottom }]}
          onStartShouldSetResponder={() => true}
        >
          {title && <Text style={styles.sheetTitle}>{title}</Text>}
          {items.map((it, i) => (
            <TouchableOpacity
              key={i}
              style={styles.sheetItem}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                // Delay supaya Modal unmount dulu sebelum action (mis. buka picker)
                // — race condition antara 2 Modal di Android bisa bikin stuck.
                setTimeout(it.onPress, 120);
              }}
            >
              <Ionicons
                name={it.icon}
                size={20}
                color={it.destructive ? '#ef4444' : '#cbd5e1'}
                style={{ width: 28 }}
              />
              <Text style={[styles.sheetItemText, it.destructive && { color: '#ef4444' }]}>
                {it.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.sheetItem, styles.sheetCancel]}
            activeOpacity={0.7}
            onPress={onClose}
          >
            <Text style={[styles.sheetItemText, { color: '#8a94a6', fontWeight: '600' }]}>
              Batal
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Helper dokumen (icon + size formatter) ──────────────
const DOC_EXTS_ALLOWED = ['pdf', 'docx', 'xlsx', 'pptx'] as const;
function fmtFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024)    return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}
function docIconName(nama: string | null | undefined): keyof typeof Ionicons.glyphMap {
  const ext = String(nama ?? '').toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':                return 'document-text';
    case 'doc': case 'docx':   return 'document-text';
    case 'xls': case 'xlsx':   return 'grid';
    case 'ppt': case 'pptx':   return 'easel';
    default:                   return 'document';
  }
}
function docIconColor(nama: string | null | undefined): string {
  const ext = String(nama ?? '').toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':                return '#ef4444'; // merah
    case 'doc': case 'docx':   return '#3b82f6'; // biru
    case 'xls': case 'xlsx':   return '#22c55e'; // hijau
    case 'ppt': case 'pptx':   return '#f59e0b'; // oranye
    default:                   return '#8a94a6';
  }
}

type SharedFile = {
  fileName?: string | null;
  mimeType?: string | null;
  path?: string | null;
};

type RouteParams = {
  roomId: number;
  nama: string;
  foto: string | null;
  /** id pesan yg harus di-scroll + highlight (dari tap push notif chat) */
  highlightMessageId?: number | null;
  // Share-to-HUB: forward dari ChatList saat user pilih room tujuan share.
  // Auto-set sbg pendingImage / pre-fill caption.
  sharedFiles?: SharedFile[];
  sharedText?: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatRoomScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);

  // Track keyboard height manually — lebih reliable dari KAV behavior
  // di Android edge-to-edge (KAV punya bug residual padding saat hide).
  useEffect(() => {
    const showName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showName, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideName, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const { roomId, nama, foto, highlightMessageId, sharedFiles, sharedText } = route.params;
  const [pesan, setPesan] = useState('');
  const [pendingImage, setPendingImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [pendingVideo, setPendingVideo] = useState<PickedVideo | null>(null);
  const [videoCompressing, setVideoCompressing] = useState(false);
  const [pickingDoc, setPickingDoc] = useState(false);
  const [caption, setCaption] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  /** State edit mode — null = mode kirim normal. Set saat user pilih "Edit pesan". */
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [sharedConsumed, setSharedConsumed] = useState(false);

  // ── Sticky date header (a la WhatsApp) ─────────────────────────────
  // Label tanggal grup pesan yg sedang di top viewport (visual). Tampil
  // float di atas FlatList saat user scroll, auto-fade keluar 2 detik
  // setelah scroll berhenti.
  const [stickyLabel, setStickyLabel]   = useState<string>('');
  const stickyOpacity                   = useRef(new Animated.Value(0)).current;
  const stickyHideTimerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStickyDate = useCallback(() => {
    if (stickyHideTimerRef.current) clearTimeout(stickyHideTimerRef.current);
    Animated.timing(stickyOpacity, {
      toValue: 1, duration: 150, useNativeDriver: true,
    }).start();
  }, [stickyOpacity]);

  const scheduleStickyHide = useCallback(() => {
    if (stickyHideTimerRef.current) clearTimeout(stickyHideTimerRef.current);
    stickyHideTimerRef.current = setTimeout(() => {
      Animated.timing(stickyOpacity, {
        toValue: 0, duration: 250, useNativeDriver: true,
      }).start();
    }, 2000);
  }, [stickyOpacity]);

  useEffect(() => () => {
    if (stickyHideTimerRef.current) clearTimeout(stickyHideTimerRef.current);
  }, []);

  // viewabilityConfig HARUS stable supaya FlatList tidak warn "Changing
  // viewabilityConfig on the fly is not supported".
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (!viewableItems.length) return;
    // FlatList inverted: index lebih tinggi = visually di atas. Topmost visible
    // = item dgn index terbesar di antara viewable.
    const topmost = viewableItems.reduce((max, v) =>
      (v.index ?? -1) > (max.index ?? -1) ? v : max
    );
    const item = topmost.item as ChatListItem;
    let label = '';
    if (item.type === 'separator') {
      label = item.label;
    } else {
      label = formatChatDateSeparator(item.message.created_at);
    }
    if (label) setStickyLabel(label);
  }).current;

  // Share-to-HUB: auto-set pendingImage dari shared file + pre-fill caption.
  // Guard sharedConsumed supaya tidak duplikat di re-render. CLEAR params
  // setelah consume supaya re-mount (back ke ChatList lalu re-open same room)
  // tidak konsumsi ulang konten yg sama — React Navigation cache params
  // per route key.
  useEffect(() => {
    if (sharedConsumed) return;
    if (!sharedFiles?.length && !sharedText) return;

    (async () => {
      if (sharedText) setCaption(sharedText);

      const first = sharedFiles?.[0];
      if (first?.path) {
        try {
          const rawUri = first.path;
          const uri    = rawUri.startsWith('file://') ? rawUri : `file://${rawUri}`;
          const transcoded = await transcodeHeicIfNeeded({
            uri,
            name: first.fileName ?? `shared-${Date.now()}.jpg`,
            type: first.mimeType ?? 'image/jpeg',
          });
          setPendingImage(transcoded);
        } catch (e) {
          console.warn('[Share] consume sharedFiles gagal:', e);
        }
      }
      setSharedConsumed(true);
      // Clear params supaya next mount (re-open same room dari list) tidak
      // re-trigger consume effect dgn konten yg sama.
      navigation.setParams({ sharedFiles: undefined, sharedText: undefined } as never);
    })();
  }, [sharedFiles, sharedText, sharedConsumed, navigation]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [videoPlayerUri, setVideoPlayerUri] = useState<string | null>(null);
  // id pesan yang sedang diteruskan — buka ForwardSheet kalau non-null
  const [forwardMsgId, setForwardMsgId] = useState<number | null>(null);
  /** Pesan yang sedang dibuka modal "Info dibaca"-nya. */
  const [readStatusMsg, setReadStatusMsg] = useState<ChatMessage | null>(null);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [actionSheetMsg, setActionSheetMsg] = useState<ChatMessage | null>(null);
  const toast = useToast();
  // Pesan yang gagal kirim — disimpan local, tampil sebagai ghost bubble dgn icon error
  const [failedMessages, setFailedMessages] = useState<{ tempId: string; pesan: string; replyToId?: number }[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chat-room', roomId],
    queryFn:  () => chatApi.show(roomId),
    refetchInterval: 5000, // polling 5 detik (sementara, sebelum Reverb integrated)
  });

  // Mark read setiap kali layar dibuka / data berubah.
  // PENTING: invalidate CHAIN setelah markRead resolve (sebelumnya
  // invalidate immediate → race condition, server belum proses markRead
  // saat refetch jalan → badge stuck). Plus invalidate notif-count
  // (bottom tab badge Pesan) — sebelumnya cuma chat-rooms, badge bottom
  // tab harus tunggu polling 20s.
  // Optimistic: hitung notif.pesan baru dgn mengurangi unread room ini
  // dari total. Room lain yg masih ada unread tetap terhitung.
  const clearPesanBadgeOptimistic = useCallback(() => {
    queryClient.setQueryData(['notif-count'], (old: any) => {
      if (!old) return old;
      const rooms: any = queryClient.getQueryData(['chat-rooms']);
      const currentRoomUnread = Array.isArray(rooms)
        ? (rooms.find((r: any) => r.id === roomId)?.unread_count ?? 0)
        : 0;
      return { ...old, pesan: Math.max(0, (old.pesan ?? 0) - currentRoomUnread) };
    });
  }, [queryClient, roomId]);

  const onMarkReadDone = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
    queryClient.invalidateQueries({ queryKey: ['notif-count'] });
  }, [queryClient]);

  useEffect(() => {
    clearPesanBadgeOptimistic();
    chatApi.markRead(roomId).then(onMarkReadDone).catch(() => {});
  }, [roomId, data, clearPesanBadgeOptimistic, onMarkReadDone]);

  // Refetch saat layar fokus (mis. user kembali dari background) — pastikan
  // reads array selalu up-to-date untuk render status read.
  useFocusEffect(useCallback(() => {
    refetch();
    clearPesanBadgeOptimistic();
    chatApi.markRead(roomId).then(onMarkReadDone).catch(() => {});
  }, [roomId, refetch, clearPesanBadgeOptimistic, onMarkReadDone]));

  // ── Anti double-submit lock (sync via useRef) ─────────────────
  // mutation.isPending baru jadi true SETELAH React re-render. Kalau user
  // tap super cepat / multi-touch, 2 onPress bisa masuk di tick yg sama
  // SEBELUM disabled prop terupdate → 2x sendMutation.mutate() → pesan
  // double terkirim. useRef sync di JS, lock instant tanpa nunggu render.
  const sendLockRef = useRef(false);
  const releaseSendLock = () => { sendLockRef.current = false; };

  const sendMutation = useMutation({
    mutationFn: (payload: {
      pesan?: string;
      foto?: any;
      video?: any;
      video_thumbnail?: any;
      video_duration_sec?: number;
      dokumen?: any;
      replyToId?: number;
      tempId?: string;
    }) =>
      chatApi.send(roomId, payload).then((r) => ({ ...r, tempId: payload.tempId })),
    onSuccess: (res) => {
      // Hapus dari failed kalau ini retry
      if (res.tempId) {
        setFailedMessages((prev) => prev.filter((f) => f.tempId !== res.tempId));
      }
      setPesan('');
      setPendingImage(null);
      setPendingVideo(null);
      setCaption('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['chat-room', roomId] });
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
    },
    onError: (e: any, vars) => {
      // Tambah ke failed messages — hanya untuk pesan teks (foto skip dulu)
      if (vars && vars.pesan && !vars.foto) {
        setFailedMessages((prev) => {
          // Kalau retry & masih gagal, tetap ada
          if (vars.tempId && prev.some((f) => f.tempId === vars.tempId)) return prev;
          return [...prev, {
            tempId: vars.tempId ?? `f-${Date.now()}`,
            pesan: vars.pesan ?? '',
            replyToId: vars.replyToId,
          }];
        });
      }
      Alert.alert('Gagal kirim', e.response?.data?.message ?? 'Periksa koneksi & coba lagi.');
    },
    onSettled: releaseSendLock,
  });

  const editMutation = useMutation({
    mutationFn: ({ messageId, pesan }: { messageId: number; pesan: string }) =>
      chatApi.editMessage(roomId, messageId, pesan),
    onSuccess: () => {
      setEditingMessage(null);
      setPesan('');
      queryClient.invalidateQueries({ queryKey: ['chat-room', roomId] });
    },
    onError: (e: any) => {
      Alert.alert('Gagal edit', e.response?.data?.message ?? 'Periksa koneksi & coba lagi.');
    },
    onSettled: releaseSendLock,
  });

  const handleSend = () => {
    if (sendLockRef.current) return;          // sync lock — block tap kedua di tick yg sama
    if (!pesan.trim()) return;
    sendLockRef.current = true;
    if (editingMessage) {
      editMutation.mutate({ messageId: editingMessage.id, pesan: pesan.trim() });
      return;
    }
    sendMutation.mutate({ pesan: pesan.trim(), replyToId: replyTo?.id });
  };

  const retryFailed = (f: { tempId: string; pesan: string; replyToId?: number }) => {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    sendMutation.mutate({ pesan: f.pesan, replyToId: f.replyToId, tempId: f.tempId });
  };

  const removeFailed = (tempId: string) => {
    setFailedMessages((prev) => prev.filter((f) => f.tempId !== tempId));
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Beri izin akses galeri di pengaturan HP.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // Tidak set quality utk GIF — supaya animation tidak hilang
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const isGif = (a.mimeType?.includes('gif')) || a.uri.toLowerCase().endsWith('.gif');
      const ext   = isGif ? 'gif' : 'jpg';
      const mime  = a.mimeType ?? (isGif ? 'image/gif' : 'image/jpeg');
      // Transcode HEIC → JPEG (skip kalau GIF supaya animation tetap)
      const initial = {
        uri: a.uri,
        name: a.fileName ?? `chat-${Date.now()}.${ext}`,
        type: mime,
      };
      const finalAsset = isGif ? initial : await transcodeHeicIfNeeded(initial);
      setPendingImage(finalAsset);
      setCaption('');
    }
  };

  const sendPendingImage = () => {
    if (sendLockRef.current) return;
    if (!pendingImage) return;
    sendLockRef.current = true;
    sendMutation.mutate({
      pesan: caption.trim() || undefined,
      foto: pendingImage,
      replyToId: replyTo?.id,
    });
  };

  const cancelPendingImage = () => {
    setPendingImage(null);
    setCaption('');
  };

  // Video picker — kompres + thumbnail di videoPicker helper
  const pickVideo = async () => {
    setVideoCompressing(true);
    try {
      const picked = await pickAndCompressVideo('gallery');
      if (picked) {
        setPendingVideo(picked);
        setCaption('');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Gagal proses video.');
    } finally {
      setVideoCompressing(false);
    }
  };

  const sendPendingVideo = () => {
    if (sendLockRef.current) return;
    if (!pendingVideo) return;
    sendLockRef.current = true;
    sendMutation.mutate({
      pesan: caption.trim() || undefined,
      video:              pendingVideo.video,
      video_thumbnail:    pendingVideo.thumbnail,
      video_duration_sec: pendingVideo.video.durationSec,
      replyToId:          replyTo?.id,
    });
  };

  const cancelPendingVideo = () => {
    setPendingVideo(null);
    setCaption('');
  };

  // Single "+" attach menu — buka custom bottom sheet (BUKAN Alert.alert).
  // Alert.alert di Android cuma support 3 button native; 4+ bikin stuck atau
  // tidak bisa di-close/back. Custom Modal bottom sheet handle Android back
  // (onRequestClose) + tap backdrop = consistent dgn iOS.
  const openAttachMenu = () => {
    if (sendMutation.isPending || videoCompressing || pickingDoc) return;
    setAttachSheetOpen(true);
  };

  // Pilih & langsung kirim dokumen (PDF/DOCX/XLSX/PPTX). Tanpa preview modal
  // — file di-cache oleh DocumentPicker, kita kirim FormData ke /chat/.../messages.
  // Backend validate mimes + mimetypes whitelist + max 20MB. Nama asli dipakai
  // untuk display & download client-side.
  const pickDocument = async () => {
    if (sendMutation.isPending || pickingDoc) return;
    setPickingDoc(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;

      const a = result.assets[0];
      // Validasi ekstensi (defensive, sesuai backend whitelist)
      const ext = (a.name ?? '').toLowerCase().split('.').pop() ?? '';
      if (!DOC_EXTS_ALLOWED.includes(ext as any)) {
        Alert.alert('Format tidak didukung', 'Hanya PDF, DOCX, XLSX, PPTX yang bisa dikirim.');
        return;
      }
      if (a.size && a.size > 20 * 1024 * 1024) {
        Alert.alert('Terlalu besar', 'Ukuran dokumen maksimal 20 MB.');
        return;
      }

      if (sendLockRef.current) return;
      sendLockRef.current = true;
      sendMutation.mutate({
        dokumen: {
          uri:  a.uri,
          name: a.name ?? `dokumen.${ext}`,
          type: a.mimeType ?? 'application/octet-stream',
        },
        replyToId: replyTo?.id,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Gagal pilih dokumen.');
    } finally {
      setPickingDoc(false);
    }
  };

  const messages = (data?.messages.data ?? []) as ChatMessage[];

  /**
   * Inject date separator items di antara grup tanggal. messages dari API
   * urut newest→oldest. FlatList `inverted` → index lebih tinggi tampil di
   * atas visual. Separator untuk tanggal X harus tampil di atas pesan paling
   * tua tanggal X (= di atas messages[i] saat messages[i+1] beda tanggal,
   * atau saat i = last index = oldest message overall).
   *
   * Bentuk item gabungan didiskriminasi via `type` — renderItem branch.
   */
  type ChatListItem =
    | { type: 'message';   key: string; message: ChatMessage }
    | { type: 'separator'; key: string; label: string };

  const listItems = useMemo<ChatListItem[]>(() => {
    const items: ChatListItem[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      items.push({ type: 'message', key: `m-${m.id}`, message: m });
      const next = messages[i + 1];
      const currKey = localDateKey(m.created_at);
      const nextKey = next ? localDateKey(next.created_at) : null;
      if (currKey !== nextKey) {
        items.push({
          type: 'separator',
          key:  `sep-${currKey}`,
          label: formatChatDateSeparator(m.created_at),
        });
      }
    }
    return items;
  }, [messages]);

  // Tipe room + nama/foto dinamis dari query — supaya kalau admin edit nama
  // grup di GroupInfoScreen, top bar ikut update saat balik (bukan stale
  // route param). Fallback ke route param sebelum query selesai.
  const isGroup     = data?.room.data.type === 'group';
  const displayNama = data?.room.data.nama ?? nama;
  const displayFoto = data?.room.data.foto ?? foto;
  // user_id lawan bicara (private chat) — utk buka profil saat tap nama
  const otherUserId = data?.room.data.other_user_id ?? null;

  // Read status: max last_read dari user lain (bukan diri sendiri)
  const otherMaxRead = (data?.reads ?? [])
    .filter((r) => r.user_id !== user?.id)
    .reduce((max, r) => Math.max(max, r.last_read_message_id), 0);

  const getMessageStatus = (msg: ChatMessage): 'sent' | 'read' => {
    return otherMaxRead >= msg.id ? 'read' : 'sent';
  };

  // Scroll FlatList ke pesan yg di-reply + highlight sebentar.
  // Inverted FlatList scrollToIndex sering flaky di iOS — wrapper sini retry
  // dgn ascending delay supaya pasti landing setelah virtualization render item.
  const scrollToMessage = (messageId: number) => {
    // findIndex di listItems (bukan messages) karena FlatList data = listItems
    // sekarang punya separator items juga.
    const idx = listItems.findIndex((it) => it.type === 'message' && it.message.id === messageId);
    if (idx < 0) {
      // Pesan tidak ada di list yg sudah di-load (mungkin di history lebih lama)
      return;
    }
    setHighlightedMsgId(messageId);
    setTimeout(() => setHighlightedMsgId(null), 2500);

    // Try scrollToIndex; kalau item belum rendered → onScrollToIndexFailed handler
    // bawah otomatis retry. Tambah 2nd attempt dgn delay sebagai safety net
    // untuk inverted list yg kadang gagal apply animation pertama kalinya.
    const attempt = (animated: boolean) => {
      try {
        flatListRef.current?.scrollToIndex({ index: idx, animated, viewPosition: 0.5 });
      } catch (e) {
        // scrollToIndex bisa throw kalau ref unavailable — silent ignore, retry akan jalan
      }
    };
    attempt(true);
    // Retry 150ms kemudian dgn animated=false sebagai fallback kalau attempt pertama
    // gagal (inverted FlatList iOS sometimes ignore first animated scroll)
    setTimeout(() => attempt(false), 150);
    // Final safety: animated scroll lagi setelah list settle
    setTimeout(() => attempt(true), 400);
  };

  // Deep link dari tap push notif chat — scroll + highlight ke pesan yg
  // di-notif. highlightMessageId dibawa via route param (= model_id pesan).
  // Pesan dari push biasanya pesan terbaru → pasti ada di 50 pesan terakhir
  // yang ter-load. Ref di-key by id supaya notif baru (id beda) tetap
  // ter-highlight walau screen sudah pernah handle notif sebelumnya.
  const lastHighlightedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!highlightMessageId) return;
    if (lastHighlightedRef.current === highlightMessageId) return;
    const msgs = data?.messages.data ?? [];
    if (!msgs.some((m) => m.id === highlightMessageId)) return;
    lastHighlightedRef.current = highlightMessageId;
    // delay supaya FlatList selesai render item dulu sebelum scroll
    setTimeout(() => scrollToMessage(highlightMessageId), 450);
  }, [data, highlightMessageId]);

  // Download media (gambar/video) — direct save ke Galeri/Foto via
  // expo-media-library. Fallback ke share sheet OS kalau user tolak izin
  // (mereka tetap bisa pilih "Simpan ke Galeri" dari menu share).
  const handleDownloadMedia = async (msg: ChatMessage) => {
    const isVideo = msg.tipe === 'video';
    const url     = isVideo ? msg.video_url : msg.foto_url;
    if (!url) return;
    const urlExt = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    const ext    = isVideo
      ? 'mp4'
      : (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(urlExt) ? urlExt : 'jpg');
    const filename = `afresto-chat-${msg.id}.${ext}`;
    const cacheUri = (FileSystem.cacheDirectory ?? '') + filename;

    try {
      // Cek izin Media Library (Photos di iOS, External Storage di Android).
      // requestPermissionsAsync minta izin kalau belum, atau cek kalau sudah.
      const perm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (!perm.granted) {
        // User tolak izin → fallback ke share sheet (pola lama, masih jalan)
        await openDocumentExternal(url, filename, isVideo ? 'video/mp4' : undefined);
        return;
      }

      // Download file ke cache dulu (expo-media-library butuh local file URI)
      const dl = await FileSystem.downloadAsync(url, cacheUri);
      if (dl.status !== 200) {
        toast.error('Gagal download media.');
        return;
      }

      // Save ke galeri / foto. saveToLibraryAsync auto-pick album default
      // (Camera Roll di iOS, Pictures/Movies di Android).
      await MediaLibrary.saveToLibraryAsync(dl.uri);
      toast.success(isVideo ? 'Video tersimpan ke galeri' : 'Foto tersimpan ke galeri');

      // Cleanup cache file (optional — sistem akan auto-purge anyway)
      FileSystem.deleteAsync(dl.uri, { idempotent: true }).catch(() => {});
    } catch (e: any) {
      // Error apapun → fallback share sheet supaya user tetap bisa save manual
      try {
        await openDocumentExternal(url, filename, isVideo ? 'video/mp4' : undefined);
      } catch {
        toast.error(e?.message ?? 'Gagal simpan media ke galeri.');
      }
    }
  };

  // Long-press bubble pesan → buka custom bottom sheet (gantikan Alert.alert
  // yg di Android stuck saat 5 button: Balas/Salin/Download/Teruskan/Hapus).
  // Sheet sebenarnya di-render di JSX bawah berdasarkan actionSheetMsg.
  const handleLongPressMessage = (msg: ChatMessage) => {
    if (msg.dihapus_at) return;
    setActionSheetMsg(msg);
  };

  // Build items utk message action sheet — dipanggil saat render Modal.
  const buildMessageActions = (msg: ChatMessage): ActionItem[] => {
    const isMine  = msg.user_id === user?.id;
    const isMedia = msg.tipe === 'image' || msg.tipe === 'video';
    const isFile  = msg.tipe === 'file';
    const hasText = !!msg.pesan && msg.pesan.trim().length > 0;

    const items: ActionItem[] = [
      { label: 'Balas',    icon: 'arrow-undo-outline', onPress: () => setReplyTo(msg) },
    ];
    if (hasText) {
      items.push({
        label: 'Salin teks',
        icon: 'copy-outline',
        onPress: async () => {
          try {
            await Clipboard.setStringAsync(msg.pesan!);
            toast.success('Teks pesan disalin');
          } catch {
            toast.error('Gagal salin teks');
          }
        },
      });
    }
    if (isMedia) {
      items.push({ label: 'Download', icon: 'download-outline', onPress: () => handleDownloadMedia(msg) });
      items.push({ label: 'Teruskan', icon: 'arrow-redo-outline', onPress: () => setForwardMsgId(msg.id) });
    } else if (isFile) {
      // Dokumen — tap default sudah buka via openDocumentSmart. Aksi tambahan:
      // simpan ke device → download + share sheet (iOS "Save to Files",
      // Android "Save / Drive / app lain"). User explicit dapat opsi save.
      items.push({
        label: 'Simpan dokumen',
        icon: 'download-outline',
        onPress: async () => {
          if (!msg.dokumen_url) return;
          await openDocumentExternal(
            msg.dokumen_url,
            msg.dokumen_nama ?? 'dokumen',
            msg.dokumen_mime ?? undefined,
          );
        },
      });
      items.push({ label: 'Teruskan', icon: 'arrow-redo-outline', onPress: () => setForwardMsgId(msg.id) });
    } else {
      // Text-only: tetap bisa teruskan
      items.push({ label: 'Teruskan', icon: 'arrow-redo-outline', onPress: () => setForwardMsgId(msg.id) });
    }
    // Edit — hanya pesan teks milik sendiri dalam window 15 menit (backend gate via can_edit).
    if (isMine && msg.tipe === 'text' && msg.can_edit) {
      items.push({
        label: 'Edit pesan',
        icon: 'pencil-outline',
        onPress: () => {
          setEditingMessage(msg);
          setPesan(msg.pesan ?? '');
          setReplyTo(null);
        },
      });
    }
    // "Info dibaca" — hanya untuk pesan sendiri di grup chat. Private chat
    // sudah punya single/double tick — tidak perlu modal.
    if (isMine && isGroup && !msg.dihapus_at) {
      items.push({
        label: 'Info dibaca',
        icon: 'eye-outline',
        onPress: () => setReadStatusMsg(msg),
      });
    }
    if (isMine) {
      items.push({
        label: 'Hapus pesan',
        icon: 'trash-outline',
        destructive: true,
        onPress: async () => {
          try {
            await chatApi.deleteMessage(roomId, msg.id);
            queryClient.invalidateQueries({ queryKey: ['chat-room', roomId] });
            queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus pesan.');
          }
        },
      });
    }
    return items;
  };

  const renderListItem = ({ item }: { item: ChatListItem }) => {
    if (item.type === 'separator') {
      return (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{item.label}</Text>
        </View>
      );
    }
    return renderMessage({ item: item.message });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine   = item.user_id === user?.id;
    const isHapus  = !!item.dihapus_at;
    return (
      <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        {!isMine && (
          item.user.foto ? (
            <TouchableOpacity activeOpacity={0.85} onPress={() => setViewerUri(item.user.foto!)}>
              <Image source={{ uri: item.user.foto }} style={styles.bubbleAvatar} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.bubbleAvatar, styles.bubbleAvatarFallback]}>
              <Text style={styles.bubbleAvatarText}>{item.user.nama?.charAt(0).toUpperCase() ?? '?'}</Text>
            </View>
          )
        )}
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => handleLongPressMessage(item)}
          delayLongPress={350}
          style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther,
            isHapus && styles.bubbleDeleted,
            highlightedMsgId === item.id && styles.bubbleHighlight]}
        >
          {!isMine && (
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => (navigation as any).navigate('UserProfile', { userId: item.user_id })}
            >
              <Text style={styles.bubbleSender}>{item.user.nama}</Text>
            </TouchableOpacity>
          )}

          {/* Quoted reply preview di atas pesan utama — tap untuk scroll ke pesan asli */}
          {item.reply_to && !isHapus && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => item.reply_to && scrollToMessage(item.reply_to.id)}
              style={[styles.quotedBox, isMine ? styles.quotedBoxMine : styles.quotedBoxOther]}
            >
              <Text style={styles.quotedSender} numberOfLines={1}>{item.reply_to.user_nama}</Text>
              <Text style={styles.quotedText} numberOfLines={2}>
                {item.reply_to.dihapus
                  ? '🚫 Pesan dihapus'
                  : (item.reply_to.tipe === 'image' && !item.reply_to.pesan
                      ? '🖼️ Foto'
                      : item.reply_to.pesan)}
              </Text>
            </TouchableOpacity>
          )}

          {isHapus ? (
            <Text style={styles.bubbleDeletedText}>
              <Ionicons name="ban-outline" size={11} color="#8a94a6" /> Pesan ini dihapus
            </Text>
          ) : (
            <>
              {item.foto_url && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setViewerUri(item.foto_url)}
                  onLongPress={() => handleLongPressMessage(item)}
                  delayLongPress={350}
                >
                  <ExpoImage source={{ uri: item.foto_url }} style={styles.bubbleImage} contentFit="cover" />
                </TouchableOpacity>
              )}
              {item.video_thumbnail_url && item.video_url && (
                <View style={{ width: 220, marginVertical: 2 }}>
                  <VideoThumbnail
                    thumbnailUri={item.video_thumbnail_url}
                    durationSec={item.video_duration_sec}
                    onPress={() => setVideoPlayerUri(item.video_url)}
                    height={140}
                    borderRadius={10}
                  />
                </View>
              )}
              {/* Dokumen (PDF/DOCX/XLSX/PPTX) — tap → openDocumentSmart
                  (PDF → browser native, Office → MS Online Viewer, fallback share) */}
              {item.tipe === 'file' && item.dokumen_url && (
                <TouchableOpacity
                  style={styles.docCard}
                  onPress={() => openDocumentSmart(item.dokumen_url!, item.dokumen_nama ?? 'dokumen')}
                  onLongPress={() => handleLongPressMessage(item)}
                  delayLongPress={350}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={docIconName(item.dokumen_nama)}
                    size={26}
                    color={docIconColor(item.dokumen_nama)}
                  />
                  <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                    <Text style={styles.docName} numberOfLines={2}>{item.dokumen_nama}</Text>
                    <Text style={styles.docMeta}>{fmtFileSize(item.dokumen_size)}</Text>
                  </View>
                  <Ionicons name="download-outline" size={18} color="#8a94a6" />
                </TouchableOpacity>
              )}
              {item.pesan && (
                <LinkText
                  text={item.pesan}
                  style={styles.bubbleText}
                  linkColor={isMine ? '#bfdbfe' : '#7dd3fc'}
                />
              )}
            </>
          )}
          <View style={styles.bubbleMeta}>
            {item.edited_at && !isHapus && (
              <Text style={styles.bubbleEdited}>diedit</Text>
            )}
            <Text style={styles.bubbleTime}>{formatTime(item.created_at)}</Text>
            {isMine && !isHapus && (
              getMessageStatus(item) === 'read' ? (
                <Ionicons name="checkmark-done" size={16} color="#4ade80" />
              ) : (
                <Ionicons name="checkmark" size={16} color="#fb923c" />
              )
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{
        flex: 1,
        // Android edge-to-edge: kbHeight tidak include nav bar inset, perlu ditambah
        // iOS: kbHeight sudah include home indicator
        paddingBottom: kbHeight > 0
          ? kbHeight + (Platform.OS === 'android' ? insets.bottom : 0)
          : 0,
      }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          {displayFoto ? (
            <TouchableOpacity activeOpacity={0.85} onPress={() => setViewerUri(displayFoto)}>
              <Image source={{ uri: displayFoto }} style={styles.topAvatar} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.topAvatar, styles.bubbleAvatarFallback]}>
              <Text style={styles.bubbleAvatarText}>{displayNama.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {isGroup ? (
            // Grup: nama tappable → buka GroupInfoScreen (anggota + deskripsi)
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.7}
              onPress={() => (navigation as any).navigate('GroupInfo', { roomId })}
            >
              <Text style={styles.topName} numberOfLines={1}>{displayNama}</Text>
              <Text style={styles.topSubtitle}>Tap untuk info grup</Text>
            </TouchableOpacity>
          ) : otherUserId ? (
            // Private: nama tappable → buka profil lawan bicara
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.7}
              onPress={() => (navigation as any).navigate('UserProfile', { userId: otherUserId })}
            >
              <Text style={styles.topName} numberOfLines={1}>{displayNama}</Text>
              <Text style={styles.topSubtitle}>Tap untuk lihat profil</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.topName} numberOfLines={1}>{displayNama}</Text>
          )}
        </View>

        {/* Messages */}
        {isLoading && !data ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={listItems}
              keyExtractor={(item) => item.key}
              renderItem={renderListItem}
              inverted // pesan terbaru di bawah, scroll ke atas untuk lihat history
              contentContainerStyle={styles.list}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
              onScrollBeginDrag={showStickyDate}
              onScroll={showStickyDate}
              scrollEventThrottle={16}
              onScrollEndDrag={scheduleStickyHide}
              onMomentumScrollEnd={scheduleStickyHide}
              onScrollToIndexFailed={(info) => {
                // Pesan target belum rendered (FlatList virtualization). Retry dgn delay.
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index, animated: true, viewPosition: 0.5,
                  });
                }, 300);
              }}
            />
            {/* Sticky date header — floating di atas FlatList, fade in/out */}
            {!!stickyLabel && (
              <Animated.View
                pointerEvents="none"
                style={[styles.stickyDate, { opacity: stickyOpacity }]}
              >
                <Text style={styles.stickyDateText}>{stickyLabel}</Text>
              </Animated.View>
            )}
          </View>
        )}

        {/* Pesan gagal kirim — ghost bubble dgn icon error + retry/remove */}
        {failedMessages.length > 0 && (
          <View style={styles.failedWrap}>
            {failedMessages.map((f) => (
              <View key={f.tempId} style={styles.failedRow}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.failedText} numberOfLines={1}>{f.pesan}</Text>
                <TouchableOpacity onPress={() => retryFailed(f)} hitSlop={6}>
                  <Text style={styles.failedAction}>Coba lagi</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeFailed(f.tempId)} hitSlop={6}>
                  <Ionicons name="close" size={16} color="#8a94a6" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Reply banner */}
        {replyTo && !editingMessage && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerBar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBannerLabel}>Membalas {replyTo.user.nama}</Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {replyTo.tipe === 'video' && !replyTo.pesan
                  ? '🎬 Video'
                  : replyTo.tipe === 'image' && !replyTo.pesan
                  ? '🖼️ Foto'
                  : replyTo.pesan}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color="#8a94a6" />
            </TouchableOpacity>
          </View>
        )}

        {/* Edit banner — tampil saat user pilih "Edit pesan" dari long-press */}
        {editingMessage && (
          <View style={[styles.replyBanner, { borderLeftColor: '#f59e0b' }]}>
            <View style={[styles.replyBannerBar, { backgroundColor: '#f59e0b' }]} />
            <Ionicons name="pencil" size={14} color="#f59e0b" style={{ marginRight: 6 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyBannerLabel, { color: '#fbbf24' }]}>Mengedit pesan</Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {editingMessage.pesan}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => { setEditingMessage(null); setPesan(''); }}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color="#8a94a6" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          {/* Satu tombol "+" — tap → Alert pilih gambar/video/dokumen.
              Lebih hemat ruang horizontal dibanding 3 ikon terpisah.
              Disabled saat edit mode — edit hanya teks. */}
          <TouchableOpacity
            onPress={openAttachMenu}
            style={styles.iconBtn}
            disabled={sendMutation.isPending || videoCompressing || pickingDoc || !!editingMessage}
          >
            {(videoCompressing || pickingDoc)
              ? <ActivityIndicator size="small" color="#3b82f6" />
              : <Ionicons name="add-circle" size={28} color={editingMessage ? '#374151' : '#3b82f6'} />}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={
              editingMessage ? 'Edit pesan...'
              : replyTo ? `Balas ${replyTo.user.nama}...`
              : 'Tulis pesan...'
            }
            placeholderTextColor="#6b7280"
            value={pesan}
            onChangeText={setPesan}
            multiline
            maxLength={5000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, editingMessage && { backgroundColor: '#f59e0b' }]}
            onPress={handleSend}
            disabled={!pesan.trim() || sendMutation.isPending || editMutation.isPending}
          >
            {(sendMutation.isPending || editMutation.isPending)
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>

        {/* Spacer warna sama dgn input bar, mengisi safe area bawah saat
            keyboard tidak aktif — supaya input bar tidak terlihat floating */}
        {kbHeight === 0 && (
          <View style={{ height: insets.bottom, backgroundColor: '#0a0f1a' }} />
        )}
      </View>

      {/* Image preview modal — ala WhatsApp: preview + caption sebelum kirim */}
      <Modal
        visible={!!pendingImage}
        animationType="slide"
        transparent={false}
        onRequestClose={cancelPendingImage}
      >
        <SafeAreaView style={previewStyles.container} edges={['top']}>
          <View style={previewStyles.topBar}>
            <TouchableOpacity onPress={cancelPendingImage} style={previewStyles.iconBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={previewStyles.title}>Kirim Foto</Text>
          </View>

          <View style={previewStyles.imageWrap}>
            {pendingImage && (
              <Image source={{ uri: pendingImage.uri }} style={previewStyles.image} resizeMode="contain" />
            )}
          </View>

          <View style={[previewStyles.inputBar, {
            paddingBottom: kbHeight > 0
              ? 8 + (Platform.OS === 'android' ? insets.bottom : 0)
              : 8 + insets.bottom,
            marginBottom: kbHeight,
          }]}>
            <TextInput
              style={previewStyles.input}
              placeholder="Tambah keterangan (opsional)..."
              placeholderTextColor="#6b7280"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={5000}
            />
            <TouchableOpacity
              style={previewStyles.sendBtn}
              onPress={sendPendingImage}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={20} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Video preview modal — pattern sama dengan image preview */}
      <Modal
        visible={!!pendingVideo}
        animationType="slide"
        transparent={false}
        onRequestClose={cancelPendingVideo}
      >
        <SafeAreaView style={previewStyles.container} edges={['top']}>
          <View style={previewStyles.topBar}>
            <TouchableOpacity onPress={cancelPendingVideo} style={previewStyles.iconBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={previewStyles.title}>Kirim Video</Text>
          </View>

          <View style={previewStyles.imageWrap}>
            {pendingVideo && (
              <View style={{ width: '90%', aspectRatio: 16 / 9, position: 'relative' }}>
                <Image
                  source={{ uri: pendingVideo.thumbnail.uri }}
                  style={{ width: '100%', height: '100%', borderRadius: 12 }}
                  resizeMode="cover"
                />
                <View style={{
                  ...StyleSheet.absoluteFillObject,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                }}>
                  <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.9)" />
                </View>
                <View style={{
                  position: 'absolute', bottom: 8, right: 8,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 8, paddingVertical: 3,
                  backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4,
                }}>
                  <Ionicons name="videocam" size={12} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                    {formatDuration(pendingVideo.video.durationSec)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={[previewStyles.inputBar, {
            paddingBottom: kbHeight > 0
              ? 8 + (Platform.OS === 'android' ? insets.bottom : 0)
              : 8 + insets.bottom,
            marginBottom: kbHeight,
          }]}>
            <TextInput
              style={previewStyles.input}
              placeholder="Tambah keterangan (opsional)..."
              placeholderTextColor="#6b7280"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={5000}
            />
            <TouchableOpacity
              style={previewStyles.sendBtn}
              onPress={sendPendingVideo}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={20} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
      <VideoPlayerModal
        visible={!!videoPlayerUri}
        videoUri={videoPlayerUri}
        onClose={() => setVideoPlayerUri(null)}
      />

      {/* Sheet pilih room tujuan saat meneruskan gambar/video */}
      <ForwardSheet
        visible={forwardMsgId !== null}
        messageId={forwardMsgId}
        onClose={() => setForwardMsgId(null)}
      />

      {/* Modal "Info dibaca" — siapa baca / belum baca pesan grup. */}
      <MessageReadStatusModal
        visible={readStatusMsg !== null}
        roomId={readStatusMsg ? roomId : null}
        messageId={readStatusMsg?.id ?? null}
        onClose={() => setReadStatusMsg(null)}
      />

      {/* Bottom sheet "+" attach (Gambar/Video/Dokumen) — gantikan Alert.alert
          yg di Android stuck saat 4 button. */}
      <ChatActionSheet
        visible={attachSheetOpen}
        title="Lampirkan"
        onClose={() => setAttachSheetOpen(false)}
        items={[
          { label: 'Gambar',  icon: 'image-outline',           onPress: pickImage },
          { label: 'Video',   icon: 'videocam-outline',        onPress: pickVideo },
          { label: 'Dokumen', icon: 'document-attach-outline', onPress: pickDocument },
        ]}
      />

      {/* Bottom sheet aksi pesan (Balas/Salin/Download/Teruskan/Hapus) —
          dibangun dinamis berdasarkan tipe pesan & ownership. */}
      <ChatActionSheet
        visible={actionSheetMsg !== null}
        title="Pilih aksi"
        onClose={() => setActionSheetMsg(null)}
        items={actionSheetMsg ? buildMessageActions(actionSheetMsg) : []}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { padding: 4 },
  topAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c2333' },
  topName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  topSubtitle: { color: '#8a94a6', fontSize: 11, marginTop: 1 },

  list: { padding: 12, gap: 8 },

  bubbleRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  dateSeparator:  {
    alignSelf: 'center',
    marginVertical: 12,
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
  dateSeparatorText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  // Sticky pill di top FlatList — tampil saat scroll, fade out 2s setelah idle
  stickyDate: {
    position: 'absolute',
    top: 8, alignSelf: 'center', left: 0, right: 0,
    alignItems: 'center',
  },
  stickyDateText: {
    color: '#cbd5e1', fontSize: 11, fontWeight: '700',
    backgroundColor: 'rgba(20, 30, 50, 0.92)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
    elevation: 3,
  },
  bubbleRowLeft:  { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleAvatar:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1c2333' },
  bubbleAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  bubbleAvatarText:     { color: '#fff', fontSize: 12, fontWeight: '700' },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleMine: {
    backgroundColor: '#1e3a8a',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  bubbleSender: { color: '#a8b6ff', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  bubbleText:   { fontSize: 14, lineHeight: 19, color: '#fff' },

  quotedBox: {
    borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 4,
    paddingRight: 8, borderRadius: 4, marginBottom: 6,
  },
  quotedBoxMine:  { backgroundColor: 'rgba(255,255,255,0.15)', borderLeftColor: '#bfdbfe' },
  quotedBoxOther: { backgroundColor: 'rgba(255,255,255,0.06)', borderLeftColor: '#3b82f6' },
  quotedSender:   { color: '#a8b6ff', fontSize: 11, fontWeight: '700', marginBottom: 1 },
  quotedText:     { color: '#c5cdd9', fontSize: 12, fontStyle: 'italic' },
  bubbleHighlight: {
    borderWidth: 2, borderColor: '#fbbf24',
    shadowColor: '#fbbf24', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 8, elevation: 6,
  },

  replyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderTopWidth: 1, borderTopColor: 'rgba(59,130,246,0.25)',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  replyBannerBar:   { width: 3, height: 30, borderRadius: 2, backgroundColor: '#3b82f6' },
  replyBannerLabel: { color: '#3b82f6', fontSize: 11, fontWeight: '700' },
  replyBannerText:  { color: '#c5cdd9', fontSize: 12, marginTop: 1 },
  bubbleDeleted:     { opacity: 0.6 },
  bubbleDeletedText: { color: '#8a94a6', fontSize: 13, fontStyle: 'italic' },
  bubbleTime:   { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  bubbleEdited: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontStyle: 'italic', marginRight: 4 },
  bubbleMeta:   {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 3, alignSelf: 'flex-end',
  },

  failedWrap: { paddingHorizontal: 12, paddingTop: 6, gap: 6 },
  failedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  failedText:   { color: '#fff', fontSize: 13, flex: 1 },
  failedAction: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  bubbleImage:  { width: 200, height: 200, borderRadius: 8, marginBottom: 4 },
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 4,
    minWidth: 200, maxWidth: 260, marginBottom: 4,
  },
  docName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  docMeta: { color: '#8a94a6', fontSize: 11, marginTop: 1 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    padding: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0a0f1a',
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
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

  // ── Bottom sheet action menu ─────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0d1421',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingTop: 10, paddingHorizontal: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    color: '#8a94a6', fontSize: 13, fontWeight: '600',
    textAlign: 'center', paddingVertical: 10, marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 10,
  },
  sheetItemText: { color: '#e2e8f0', fontSize: 15 },
  sheetCancel: {
    marginTop: 6,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});

const previewStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 8, paddingVertical: 8,
  },
  iconBtn: { padding: 8 },
  title:   { color: '#fff', fontSize: 16, fontWeight: '600' },
  imageWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image:   { width: '100%', height: '100%' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: '#0a0f1a',
  },
  input: {
    flex: 1, maxHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22,
    fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
});
