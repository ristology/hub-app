import React, { useState } from 'react';
import {
  View, Text, ScrollView, Image, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { feedApi, type FeedKomentar, type KaryawanRingkas } from '../../api/feed';
import PhotoCarousel  from '../../components/PhotoCarousel';
import KaryawanPicker from '../../components/KaryawanPicker';
import MentionText    from '../../components/MentionText';

type RouteParams = { id: number };

export default function FeedDetailScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation();
  const { id } = route.params;
  const queryClient = useQueryClient();
  const [komentar, setKomentar]       = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAt,   setMentionAt]   = useState<number | null>(null);

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
  });

  const likeMutation = useMutation({
    mutationFn: () => feedApi.toggleLike(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => feedApi.comment(id, text),
    onSuccess: () => {
      setKomentar('');
      queryClient.invalidateQueries({ queryKey: ['feed', id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal kirim komentar.'),
  });

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Detail Feed</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
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

          {/* Konten */}
          {feed.konten ? <MentionText text={feed.konten} style={styles.konten} /> : null}

          {/* Foto carousel */}
          {feed.foto_urls?.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <PhotoCarousel fotos={feed.foto_urls} height={320} />
            </View>
          )}

          {/* Lokasi (kalau ada) */}
          {feed.lokasi && (
            <View style={styles.lokasiBox}>
              <Ionicons name="location" size={14} color="#3b82f6" />
              <Text style={styles.lokasiText}>{feed.lokasi}</Text>
            </View>
          )}

          {/* Aksi like */}
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

          {/* Komentar list */}
          <View style={styles.comments}>
            <Text style={styles.commentsTitle}>Komentar</Text>
            {feed.komentar?.length ? (
              feed.komentar.map((k) => <CommentItem key={k.id} k={k} />)
            ) : (
              <Text style={styles.empty}>Belum ada komentar.</Text>
            )}
          </View>
        </ScrollView>

        {/* Input komentar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.mentionBtn}
            onPress={() => setMentionOpen(true)}
          >
            <Ionicons name="at" size={18} color="#3b82f6" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Tulis komentar... ketik @ untuk mention"
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
      </KeyboardAvoidingView>

      <KaryawanPicker
        visible={mentionOpen}
        onClose={() => { setMentionOpen(false); setMentionAt(null); }}
        mode="single"
        onPick={insertMention}
        title="Mention Karyawan"
      />
    </SafeAreaView>
  );
}

function CommentItem({ k }: { k: FeedKomentar }) {
  return (
    <View style={styles.commentItem}>
      <Image source={{ uri: k.foto }} style={styles.commentAvatar} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.commentName}>{k.nama}</Text>
        <MentionText text={k.komentar} style={styles.commentText} />
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
  topTitle:  { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 4 },
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
  commentItem:   { flexDirection: 'row', marginBottom: 12 },
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
