import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet,
  TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { chatApi, type ChatRoom } from '../../api/chat';

type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { roomId: number; nama: string; foto: string | null };
  NewChat: undefined;
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  if (same) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

export default function ChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ChatStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn:  chatApi.rooms,
    // Poll tiap 5 detik supaya chat baru / unread count auto-muncul
    refetchInterval: 5000,
  });

  // Refresh tiap layar di-focus (kalau habis kirim pesan, list update)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity
      style={styles.roomItem}
      onPress={() => navigation.navigate('ChatRoom', {
        roomId: item.id, nama: item.nama, foto: item.foto,
      })}
      activeOpacity={0.7}
    >
      {item.foto ? (
        <Image source={{ uri: item.foto }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{item.nama.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={styles.roomTopRow}>
          <Text style={styles.roomName} numberOfLines={1}>{item.nama}</Text>
          {item.last_message && (
            <Text style={styles.timeText}>{formatTime(item.last_message.created_at)}</Text>
          )}
        </View>

        <View style={styles.roomBottomRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.last_message
              ? item.last_message.tipe === 'image'
                ? '🖼️ Foto'
                : item.last_message.pesan ?? ''
              : '— Mulai chat —'}
          </Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
      </View>

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="chatbubbles-outline" size={48} color="#3b3f4a" />
            <Text style={styles.empty}>Belum ada chat. Mulai chat baru.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
        activeOpacity={0.85}
      >
        <Ionicons name="create" size={26} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 4 },
  title:     { color: '#fff', fontSize: 24, fontWeight: '700' },
  list:      { paddingHorizontal: 16 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 60 },
  roomItem:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  avatar:    { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: '#fff', fontWeight: '700', fontSize: 18 },
  roomTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  roomBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  roomName:  { color: '#fff', fontWeight: '600', fontSize: 15, flex: 1 },
  timeText:  { color: '#6b7280', fontSize: 11 },
  lastMessage: { color: '#8a94a6', fontSize: 13, flex: 1 },
  unreadBadge: {
    backgroundColor: '#3b82f6', borderRadius: 10, minWidth: 20, height: 20,
    paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty:     { color: '#8a94a6', fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
});
