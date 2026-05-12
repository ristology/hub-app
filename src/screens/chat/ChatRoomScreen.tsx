import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Platform, Keyboard, Alert, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';

import { chatApi, type ChatMessage } from '../../api/chat';
import { useAuth } from '../../store/auth';
import ImageViewerModal from '../../components/ImageViewerModal';
import VideoPlayerModal from '../../components/VideoPlayerModal';
import VideoThumbnail   from '../../components/VideoThumbnail';
import { pickAndCompressVideo, type PickedVideo, formatDuration } from '../../utils/videoPicker';

type RouteParams = { roomId: number; nama: string; foto: string | null };

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

  const { roomId, nama, foto } = route.params;
  const [pesan, setPesan] = useState('');
  const [pendingImage, setPendingImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [pendingVideo, setPendingVideo] = useState<PickedVideo | null>(null);
  const [videoCompressing, setVideoCompressing] = useState(false);
  const [caption, setCaption] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [videoPlayerUri, setVideoPlayerUri] = useState<string | null>(null);
  // Pesan yang gagal kirim — disimpan local, tampil sebagai ghost bubble dgn icon error
  const [failedMessages, setFailedMessages] = useState<{ tempId: string; pesan: string; replyToId?: number }[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chat-room', roomId],
    queryFn:  () => chatApi.show(roomId),
    refetchInterval: 5000, // polling 5 detik (sementara, sebelum Reverb integrated)
  });

  // Mark read setiap kali layar dibuka / data berubah
  useEffect(() => {
    chatApi.markRead(roomId).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
  }, [roomId, data]);

  // Refetch saat layar fokus (mis. user kembali dari background) — pastikan
  // reads array selalu up-to-date untuk render status read
  useFocusEffect(useCallback(() => {
    refetch();
    chatApi.markRead(roomId).catch(() => {});
  }, [roomId, refetch]));

  const sendMutation = useMutation({
    mutationFn: (payload: {
      pesan?: string;
      foto?: any;
      video?: any;
      video_thumbnail?: any;
      video_duration_sec?: number;
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
  });

  const handleSend = () => {
    if (!pesan.trim()) return;
    sendMutation.mutate({ pesan: pesan.trim(), replyToId: replyTo?.id });
  };

  const retryFailed = (f: { tempId: string; pesan: string; replyToId?: number }) => {
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
      setPendingImage({
        uri: a.uri,
        name: a.fileName ?? `chat-${Date.now()}.${ext}`,
        type: mime,
      });
      setCaption('');
    }
  };

  const sendPendingImage = () => {
    if (!pendingImage) return;
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
    if (!pendingVideo) return;
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

  const messages = (data?.messages.data ?? []) as ChatMessage[];

  // Read status: max last_read dari user lain (bukan diri sendiri)
  const otherMaxRead = (data?.reads ?? [])
    .filter((r) => r.user_id !== user?.id)
    .reduce((max, r) => Math.max(max, r.last_read_message_id), 0);

  const getMessageStatus = (msg: ChatMessage): 'sent' | 'read' => {
    return otherMaxRead >= msg.id ? 'read' : 'sent';
  };

  // Scroll FlatList ke pesan yg di-reply + highlight sebentar
  const scrollToMessage = (messageId: number) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) {
      // Pesan tidak ada di list yg sudah di-load (mungkin di history lebih lama)
      return;
    }
    flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    setHighlightedMsgId(messageId);
    setTimeout(() => setHighlightedMsgId(null), 2500);
  };

  const handleLongPressMessage = (msg: ChatMessage) => {
    if (msg.dihapus_at) return; // Pesan deleted — no actions

    const isMine = msg.user_id === user?.id;

    // Build action buttons: Balas (semua), Hapus (hanya milik sendiri)
    const buttons: any[] = [
      { text: 'Batal', style: 'cancel' },
      { text: 'Balas', onPress: () => setReplyTo(msg) },
    ];
    if (isMine) {
      buttons.push({
        text: 'Hapus',
        style: 'destructive',
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

    Alert.alert(
      'Pilih aksi',
      isMine ? 'Apa yang ingin dilakukan dgn pesan ini?' : `Balas pesan dari ${msg.user.nama}?`,
      buttons,
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine   = item.user_id === user?.id;
    const isHapus  = !!item.dihapus_at;
    return (
      <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        {!isMine && (
          item.user.foto ? (
            <Image source={{ uri: item.user.foto }} style={styles.bubbleAvatar} />
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
          {!isMine && <Text style={styles.bubbleSender}>{item.user.nama}</Text>}

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
              {item.pesan && (
                <Text style={styles.bubbleText}>{item.pesan}</Text>
              )}
            </>
          )}
          <View style={styles.bubbleMeta}>
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
          {foto ? (
            <Image source={{ uri: foto }} style={styles.topAvatar} />
          ) : (
            <View style={[styles.topAvatar, styles.bubbleAvatarFallback]}>
              <Text style={styles.bubbleAvatarText}>{nama.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.topName} numberOfLines={1}>{nama}</Text>
        </View>

        {/* Messages */}
        {isLoading && !data ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            inverted // pesan terbaru di bawah, scroll ke atas untuk lihat history
            contentContainerStyle={styles.list}
            onScrollToIndexFailed={(info) => {
              // Pesan target belum rendered (FlatList virtualization). Retry dgn delay.
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index, animated: true, viewPosition: 0.5,
                });
              }, 300);
            }}
          />
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
        {replyTo && (
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

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickImage} style={styles.iconBtn} disabled={sendMutation.isPending}>
            <Ionicons name="image-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pickVideo}
            style={styles.iconBtn}
            disabled={sendMutation.isPending || videoCompressing}
          >
            {videoCompressing
              ? <ActivityIndicator size="small" color="#a855f7" />
              : <Ionicons name="videocam-outline" size={22} color="#a855f7" />}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={replyTo ? `Balas ${replyTo.user.nama}...` : 'Tulis pesan...'}
            placeholderTextColor="#6b7280"
            value={pesan}
            onChangeText={setPesan}
            multiline
            maxLength={5000}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSend}
            disabled={!pesan.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
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

  list: { padding: 12, gap: 8 },

  bubbleRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
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
