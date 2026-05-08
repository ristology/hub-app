import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Platform, Keyboard, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { chatApi, type ChatMessage } from '../../api/chat';
import { useAuth } from '../../store/auth';

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

  const sendMutation = useMutation({
    mutationFn: (payload: { pesan?: string; foto?: any }) => chatApi.send(roomId, payload),
    onSuccess: () => {
      setPesan('');
      queryClient.invalidateQueries({ queryKey: ['chat-room', roomId] });
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
    },
    onError: (e: any) => {
      Alert.alert('Error', e.response?.data?.message ?? 'Gagal kirim pesan.');
    },
  });

  const handleSend = () => {
    if (!pesan.trim()) return;
    sendMutation.mutate({ pesan: pesan.trim() });
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Beri izin akses galeri di pengaturan HP.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      sendMutation.mutate({
        pesan: pesan.trim() || undefined,
        foto: {
          uri: a.uri,
          name: a.fileName ?? `chat-${Date.now()}.jpg`,
          type: a.mimeType ?? 'image/jpeg',
        },
      });
    }
  };

  const messages = (data?.messages.data ?? []) as ChatMessage[];

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.user_id === user?.id;
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
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {!isMine && <Text style={styles.bubbleSender}>{item.user.nama}</Text>}
          {item.foto_url && (
            <Image source={{ uri: item.foto_url }} style={styles.bubbleImage} resizeMode="cover" />
          )}
          {item.pesan && (
            <Text style={[styles.bubbleText, isMine ? { color: '#fff' } : { color: '#fff' }]}>
              {item.pesan}
            </Text>
          )}
          <Text style={styles.bubbleTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ flex: 1, paddingBottom: Math.max(insets.bottom, kbHeight) }}>
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
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickImage} style={styles.iconBtn} disabled={sendMutation.isPending}>
            <Ionicons name="image-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Tulis pesan..."
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
      </View>
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
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  bubbleSender: { color: '#a8b6ff', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  bubbleText:   { fontSize: 14, lineHeight: 19 },
  bubbleTime:   { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
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
