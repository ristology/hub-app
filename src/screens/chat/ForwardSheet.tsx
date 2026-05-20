import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Keyboard, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { chatApi, type ChatRoom } from '../../api/chat';
import { useToast } from '../../components/Toast';

type Props = {
  visible: boolean;
  /** id pesan yang akan diteruskan. null = sheet tertutup. */
  messageId: number | null;
  onClose: () => void;
  /** dipanggil setelah forward sukses */
  onForwarded?: () => void;
};

/**
 * Bottom sheet untuk memilih room tujuan saat meneruskan (forward) pesan
 * gambar/video. Multi-select — bisa forward ke beberapa room sekaligus.
 */
export default function ForwardSheet({ visible, messageId, onClose, onForwarded }: Props) {
  const insets  = useSafeAreaInsets();
  const screenH = Dimensions.get('window').height;
  const toast   = useToast();

  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [sending, setSending]   = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn:  chatApi.rooms,
    enabled:  visible,
  });

  // Reset state tiap kali sheet dibuka
  useEffect(() => {
    if (visible) { setSearch(''); setSelected([]); }
  }, [visible]);

  // Manual keyboard handling (KAV tidak reliable di dalam Modal)
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const rooms = useMemo(() => {
    const list = data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.nama.toLowerCase().includes(q));
  }, [data, search]);

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (!messageId || selected.length === 0) return;
    setSending(true);
    try {
      await chatApi.forwardMessage(messageId, selected);
      toast.success(`Diteruskan ke ${selected.length} chat.`);
      onForwarded?.();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Gagal meneruskan pesan.');
    } finally {
      setSending(false);
    }
  };

  const ANDROID_IME_SAFETY = 60;
  const effectiveKb = kbHeight > 0
    ? kbHeight + (Platform.OS === 'android' ? ANDROID_IME_SAFETY : 0)
    : 0;
  const availableH = screenH - insets.top - 40;
  const sheetH = effectiveKb > 0
    ? Math.max(280, availableH - effectiveKb)
    : Math.min(560, availableH);
  const sheetPadBottom = kbHeight > 0 ? 12 : insets.bottom + 12;

  const renderRoom = ({ item }: { item: ChatRoom }) => {
    const isSelected = selected.includes(item.id);
    return (
      <TouchableOpacity
        onPress={() => toggle(item.id)}
        style={[styles.item, isSelected && styles.itemSelected]}
        activeOpacity={0.7}
      >
        {item.foto ? (
          <Image source={{ uri: item.foto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFb]}>
            <Text style={styles.avatarText}>{item.nama.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>{item.nama}</Text>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={isSelected ? '#3b82f6' : '#6b7280'}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: effectiveKb }]}>
        <View style={[styles.sheet, { height: sheetH, paddingBottom: sheetPadBottom }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Teruskan ke...</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari chat..."
              placeholderTextColor="#6b7280"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {isLoading && !data ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={rooms}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRoom}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {search ? 'Tidak ada chat ditemukan.' : 'Belum ada chat.'}
                </Text>
              }
              contentContainerStyle={{ paddingBottom: 12 }}
            />
          )}

          <TouchableOpacity
            onPress={handleForward}
            disabled={selected.length === 0 || sending}
            style={[
              styles.forwardBtn,
              (selected.length === 0 || sending) && styles.forwardBtnDisabled,
            ]}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.forwardBtnText}>
                  Teruskan{selected.length > 0 ? ` (${selected.length})` : ''}
                </Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d1421', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16,
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
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8,
  },
  itemSelected: { backgroundColor: 'rgba(59,130,246,0.10)' },
  avatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1c2333' },
  avatarFb:  { alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
  name:      { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },
  empty:     { color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 30 },
  forwardBtn: {
    backgroundColor: '#3b82f6', paddingVertical: 13,
    borderRadius: 10, alignItems: 'center', marginTop: 8,
  },
  forwardBtnDisabled: { opacity: 0.5 },
  forwardBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
