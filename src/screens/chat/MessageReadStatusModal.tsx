/**
 * Modal info "Siapa baca / belum baca" pesan grup. Mirror WhatsApp pattern:
 * 2 section — "Dibaca oleh (N)" + "Belum baca (M)". Tap luar atau X tutup.
 */
import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList, Image,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../../api/chat';
import { formatTanggalJam } from '../../utils/formatDate';

type Props = {
  visible: boolean;
  roomId: number | null;
  messageId: number | null;
  onClose: () => void;
};

type ReadRow   = { user_id: number; nama: string; foto: string | null; read_at: string };
type UnreadRow = { user_id: number; nama: string; foto: string | null };

export default function MessageReadStatusModal({ visible, roomId, messageId, onClose }: Props) {
  const enabled = visible && !!roomId && !!messageId;
  const { data, isLoading, error } = useQuery({
    queryKey: ['chat-read-status', roomId, messageId],
    queryFn:  () => chatApi.messageReadStatus(roomId!, messageId!),
    enabled,
    staleTime: 0, // selalu fresh saat buka
  });

  const renderUser = (item: ReadRow | UnreadRow, withTime: boolean) => (
    <View style={styles.row} key={item.user_id}>
      {item.foto ? (
        <Image source={{ uri: item.foto }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{item.nama.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.nama} numberOfLines={1}>{item.nama}</Text>
        {withTime && 'read_at' in item && item.read_at ? (
          <Text style={styles.time}>{formatTanggalJam(item.read_at)}</Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Info Dibaca</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {isLoading && (
            <View style={styles.center}>
              <ActivityIndicator color="#3b82f6" />
              <Text style={styles.muted}>Memuat...</Text>
            </View>
          )}

          {error && !isLoading && (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={36} color="#ef4444" />
              <Text style={styles.errorText}>
                {(error as any)?.response?.data?.message ?? 'Gagal memuat info dibaca.'}
              </Text>
            </View>
          )}

          {data && !isLoading && (
            <FlatList
              data={[]}
              renderItem={() => null}
              ListHeaderComponent={() => (
                <>
                  {/* Section: Dibaca oleh */}
                  <View style={styles.sectionHeader}>
                    <Ionicons name="checkmark-done" size={16} color="#4ade80" />
                    <Text style={styles.sectionTitle}>Dibaca oleh ({data.read_by.length})</Text>
                  </View>
                  {data.read_by.length === 0 ? (
                    <Text style={styles.emptyText}>Belum ada yang baca.</Text>
                  ) : (
                    data.read_by.map((r) => renderUser(r, true))
                  )}

                  {/* Divider */}
                  <View style={styles.divider} />

                  {/* Section: Belum baca */}
                  <View style={styles.sectionHeader}>
                    <Ionicons name="checkmark" size={16} color="#fb923c" />
                    <Text style={styles.sectionTitle}>Belum baca ({data.unread_by.length})</Text>
                  </View>
                  {data.unread_by.length === 0 ? (
                    <Text style={styles.emptyText}>Semua anggota sudah baca.</Text>
                  ) : (
                    data.unread_by.map((r) => renderUser(r, false))
                  )}

                  <View style={{ height: 20 }} />
                </>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d1421',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 16, paddingBottom: 8,
    maxHeight: '85%',
  },
  header: { paddingTop: 8 },
  handle: {
    alignSelf: 'center',
    width: 36, height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2, marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 16, paddingBottom: 8,
  },
  sectionTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 8,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c2333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  nama: { color: '#fff', fontSize: 14, fontWeight: '500' },
  time: { color: '#8a94a6', fontSize: 11, marginTop: 2 },

  center: { padding: 40, alignItems: 'center', gap: 8 },
  muted: { color: '#8a94a6', fontSize: 12 },
  errorText: { color: '#fca5a5', fontSize: 13, textAlign: 'center', marginTop: 4 },
  emptyText: { color: '#8a94a6', fontSize: 12, fontStyle: 'italic', paddingVertical: 8 },
});
