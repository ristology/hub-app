import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { chatApi, type ChatUser } from '../../api/chat';

type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { roomId: number; nama: string; foto: string | null };
  NewChat: undefined;
};

export default function NewChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ChatStackParamList>>();
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);

  // Debounced search
  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await chatApi.searchUsers(search);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const startChat = async (u: ChatUser) => {
    setOpening(u.user_id);
    try {
      const { data: room } = await chatApi.openPrivate(u.user_id);
      // Replace screen ke room (bukan push, supaya back langsung ke list)
      navigation.replace('ChatRoom', {
        roomId: room.id,
        nama:   room.nama,
        foto:   room.foto,
      });
    } catch {
      setOpening(null);
    }
  };

  const renderItem = ({ item }: { item: ChatUser }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => startChat(item)}
      activeOpacity={0.7}
      disabled={opening === item.user_id}
    >
      {item.foto ? (
        <Image source={{ uri: item.foto }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{item.nama.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.userName} numberOfLines={1}>{item.nama}</Text>
        {item.jabatan && <Text style={styles.userJabatan} numberOfLines={1}>{item.jabatan}</Text>}
      </View>
      {opening === item.user_id && <ActivityIndicator size="small" color="#3b82f6" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Chat Baru</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama karyawan..."
          placeholderTextColor="#6b7280"
          value={search}
          onChangeText={setSearch}
          autoFocus
          autoCapitalize="none"
        />
      </View>

      {loading && results.length === 0 ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.user_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search ? 'Tidak ada karyawan ditemukan.' : 'Mulai ketik untuk mencari.'}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { padding: 4 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 12, marginHorizontal: 16, marginVertical: 12,
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },

  list: { paddingHorizontal: 16 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 60 },
  userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  userName: { color: '#fff', fontWeight: '500', fontSize: 14 },
  userJabatan: { color: '#8a94a6', fontSize: 12, marginTop: 2 },
  empty: { color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 30 },
});
