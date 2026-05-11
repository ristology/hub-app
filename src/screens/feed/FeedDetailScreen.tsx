import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Image, TextInput, TouchableOpacity,
  ActivityIndicator, Keyboard, Platform, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { feedApi, type FeedKomentar, type KaryawanRingkas } from '../../api/feed';
import { notifApi, NotifModel } from '../../api/notif';
import { useAuth } from '../../store/auth';
import PhotoCarousel     from '../../components/PhotoCarousel';
import VideoThumbnail    from '../../components/VideoThumbnail';
import VideoPlayerModal  from '../../components/VideoPlayerModal';
import ImageViewerModal  from '../../components/ImageViewerModal';
import KaryawanPicker from '../../components/KaryawanPicker';
import MentionText    from '../../components/MentionText';
import { useKomentarHighlight } from '../../hooks/useKomentarHighlight';

type RouteParams = { id: number; highlightKomentarId?: number | null };

export default function FeedDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { id, highlightKomentarId } = route.params;
  const { scrollRef, onScroll, registerKomRef, highlightedId, onContentReady, scrollToKomentar } = useKomentarHighlight(highlightKomentarId);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Tandai notifikasi terkait feed ini sebagai dibaca → badge berkurang.
  // Invalidate juga ['feed'] supaya list-nya refetch on focus dengan
  // has_unread_notif=false (red dot kartu hilang).
  useEffect(() => {
    notifApi.markRead(NotifModel.Feed, id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['notif-count'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
      })
      .catch(() => {});
  }, [id]);

  const [komentar, setKomentar]       = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAt,   setMentionAt]   = useState<number | null>(null);
  const [replyTo,     setReplyTo]     = useState<{ id: number; nama: string } | null>(null);
  const [videoPlayerUri, setVideoPlayerUri] = useState<string | null>(null);
  const [photoViewerUri, setPhotoViewerUri] = useState<string | null>(null);

  // Manual keyboard listener — per feedback_mobile_keyboard_patterns memory,
  // JANGAN pakai KeyboardAvoidingView (buggy di Android edge-to-edge).
  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showName, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideName, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

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
    queryKey: ['feed', id],
    queryFn:  () => feedApi.detail(id),
    refetchInterval: 5000,
  });

  const likeMutation = useMutation({
    mutationFn: () => feedApi.toggleLike(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => feedApi.comment(id, text, replyTo?.id),
    onSuccess: (response) => {
      setKomentar('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['feed', id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      scrollToKomentar(response.data.id);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal kirim komentar.'),
  });

  const destroyMutation = useMutation({
    mutationFn: () => feedApi.destroy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal hapus feed.'),
  });

  const confirmDelete = () => {
    Alert.alert('Hapus Feed?', 'Postingan beserta foto dan komentarnya akan dihapus permanen.', [
      { text: 'Batal' },
      { text: 'Hapus', style: 'destructive', onPress: () => destroyMutation.mutate() },
    ]);
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

  const feed = data.data;
  const isOwner = (feed.karyawan?.user_id != null && feed.karyawan.user_id === user?.id)
               || (user?.karyawan_id != null && feed.karyawan?.id === user.karyawan_id);
  const canEdit = feed.can_edit || user?.role === 'admin' || isOwner;

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
          <Text style={styles.topTitle}>Detail Feed</Text>
          {canEdit && (
            <>
              <TouchableOpacity onPress={() => navigation.navigate('CreateFeed', { feedId: id })} style={styles.menuBtn} hitSlop={8}>
                <Ionicons name="create-outline" size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} style={styles.menuBtn} hitSlop={8}>
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
          {/* Header — pengirim */}
          <View style={styles.header}>
            {feed.karyawan.foto ? (
              <Image source={{ uri: feed.karyawan.foto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>
                  {feed.karyawan.nama_lengkap?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{feed.karyawan.nama_lengkap}</Text>
              <Text style={styles.meta}>{feed.karyawan.jabatan ?? '—'}</Text>
            </View>
          </View>

          {feed.konten ? <MentionText text={feed.konten} style={styles.konten} /> : null}

          {feed.foto_urls?.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <PhotoCarousel
                fotos={feed.foto_urls}
                height={320}
                onPressPhoto={(uri) => setPhotoViewerUri(uri)}
              />
            </View>
          )}

          {feed.video_thumbnail_url && feed.video_url && (
            <View style={{ marginBottom: 12 }}>
              <VideoThumbnail
                thumbnailUri={feed.video_thumbnail_url}
                durationSec={feed.video_duration_sec}
                onPress={() => setVideoPlayerUri(feed.video_url)}
                height={320}
              />
            </View>
          )}

          {feed.lokasi && (
            <View style={styles.lokasiBox}>
              <Ionicons name="location" size={14} color="#3b82f6" />
              <Text style={styles.lokasiText}>{feed.lokasi}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => likeMutation.mutate()}
              style={styles.likeBtn}
              disabled={likeMutation.isPending}
            >
              <Ionicons
                name={feed.sudah_like ? 'heart' : 'heart-outline'}
                size={22}
                color={feed.sudah_like ? '#ef4444' : '#8a94a6'}
              />
              <Text style={[styles.actionText, feed.sudah_like && { color: '#ef4444' }]}>
                {feed.jumlah_like} suka
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionText}>{feed.jumlah_komentar} komentar</Text>
          </View>

          <View style={styles.comments}>
            <Text style={styles.commentsTitle}>Komentar</Text>
            {feed.komentar?.length ? (
              feed.komentar.map((k) => (
                <View key={k.id}>
                  <CommentItem
                    k={k}
                    bindRef={registerKomRef(k.id)}
                    highlighted={highlightedId === k.id}
                    onReply={() => setReplyTo({ id: k.id, nama: k.nama })}
                  />
                  {k.replies && k.replies.length > 0 && k.replies.map((r) => (
                    <View key={r.id} style={styles.replyWrap}>
                      <CommentItem
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
              <Text style={styles.empty}>Belum ada komentar.</Text>
            )}
          </View>
        </ScrollView>

        {replyTo && (
          <View style={styles.replyBanner}>
            <Ionicons name="arrow-undo" size={14} color="#3b82f6" />
            <Text style={styles.replyBannerText}>Membalas <Text style={{ fontWeight: '700' }}>{replyTo.nama}</Text></Text>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color="#8a94a6" />
            </TouchableOpacity>
          </View>
        )}

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
            disabled={commentMutation.isPending || !komentar.trim()}
          >
            {commentMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
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

      <VideoPlayerModal
        visible={!!videoPlayerUri}
        videoUri={videoPlayerUri}
        onClose={() => setVideoPlayerUri(null)}
      />

      <ImageViewerModal
        uri={photoViewerUri}
        onClose={() => setPhotoViewerUri(null)}
      />
    </SafeAreaView>
  );
}

function CommentItem({ k, bindRef, highlighted, onReply }: {
  k: FeedKomentar;
  bindRef?: (v: View | null) => void;
  highlighted?: boolean;
  onReply?: () => void;
}) {
  return (
    <View ref={bindRef} style={[styles.commentItem, highlighted && styles.commentHighlight]}>
      <Image source={{ uri: k.foto }} style={styles.commentAvatar} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.commentName}>{k.nama}</Text>
        <MentionText text={k.komentar} style={styles.commentText} />
        {onReply && (
          <TouchableOpacity onPress={onReply} hitSlop={6}>
            <Text style={styles.replyBtn}>Balas</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar:    {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:   { padding: 8 },
  topTitle:  { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 4, flex: 1 },
  menuBtn:   { padding: 8 },
  scroll:    { padding: 16, paddingBottom: 24 },
  header:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
  name:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  meta:      { color: '#8a94a6', fontSize: 12, marginTop: 1 },
  konten:    { color: '#d6dce6', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  lokasiBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8,
  },
  lokasiText: { color: '#3b82f6', fontSize: 12, fontWeight: '500' },
  actions:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', marginTop: 8,
  },
  likeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText:{ color: '#8a94a6', fontSize: 13 },
  comments:  { marginTop: 16 },
  commentsTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 10 },
  commentItem:   { flexDirection: 'row', marginBottom: 12, padding: 8, borderRadius: 8 },
  commentHighlight: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.40)',
  },
  replyBtn:      { color: '#3b82f6', fontSize: 11, fontWeight: '600', marginTop: 4 },
  replyWrap:     { marginLeft: 30, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: 'rgba(59,130,246,0.30)' },
  replyBanner:   {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderTopWidth: 1, borderTopColor: 'rgba(59,130,246,0.25)',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  replyBannerText: { color: '#c5cdd9', fontSize: 12, flex: 1 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1c2333' },
  commentName:   { color: '#fff', fontWeight: '600', fontSize: 13 },
  commentText:   { color: '#c5cdd9', fontSize: 13, marginTop: 2, lineHeight: 18 },
  empty:         { color: '#8a94a6', fontSize: 13, fontStyle: 'italic' },
  inputBar:      {
    flexDirection: 'row', padding: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0a0f1a',
  },
  input:    {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22,
    maxHeight: 100, fontSize: 14,
  },
  sendBtn:  {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
  mentionBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
});
