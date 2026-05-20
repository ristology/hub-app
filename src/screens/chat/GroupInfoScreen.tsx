import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { chatApi, type GroupMember } from '../../api/chat';
import { useAuth } from '../../store/auth';
import KaryawanPicker from '../../components/KaryawanPicker';
import { useToast } from '../../components/Toast';

type RouteParams = { roomId: number };

export default function GroupInfoScreen() {
  const route       = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation  = useNavigation<any>();
  const insets      = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user }    = useAuth();
  const toast       = useToast();

  const { roomId } = route.params;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chat-group-info', roomId],
    queryFn:  () => chatApi.groupInfo(roomId),
  });

  const isAdmin = data?.is_admin ?? false;

  // ── Edit nama + deskripsi ───────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editNama, setEditNama] = useState('');
  const [editDesk, setEditDesk] = useState('');
  const [saving,   setSaving]   = useState(false);

  const openEdit = () => {
    setEditNama(data?.nama ?? '');
    setEditDesk(data?.deskripsi ?? '');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editNama.trim()) { Alert.alert('Validasi', 'Nama grup wajib diisi.'); return; }
    setSaving(true);
    try {
      await chatApi.updateGroup(roomId, {
        nama:      editNama.trim(),
        deskripsi: editDesk.trim() || null,
      });
      setEditOpen(false);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['chat-room', roomId] });
      toast.success('Grup diperbarui.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Gagal memperbarui grup.');
    } finally {
      setSaving(false);
    }
  };

  // ── Remove anggota ──────────────────────────────────────────
  const handleRemoveMember = (m: GroupMember) => {
    Alert.alert('Keluarkan Anggota', `Keluarkan ${m.nama} dari grup?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluarkan', style: 'destructive',
        onPress: async () => {
          try {
            await chatApi.removeMember(roomId, m.user_id);
            await refetch();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message ?? 'Gagal mengeluarkan anggota.');
          }
        },
      },
    ]);
  };

  // ── Tambah anggota ──────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toAdd, setToAdd] = useState<{ id: number; nama: string }[]>([]);

  // Adapter: chatApi.searchUsers (user_id) → bentuk KaryawanRingkas (id) yg
  // dipakai KaryawanPicker. Exclude anggota yg sudah ada di grup.
  const searchForGroup = useCallback(async (q: string) => {
    const { data: users } = await chatApi.searchUsers(q);
    const existing = new Set((data?.members ?? []).map((m) => m.user_id));
    return {
      data: users
        .filter((u) => !existing.has(u.user_id))
        .map((u) => ({ id: u.user_id, nama: u.nama, jabatan: u.jabatan, foto: u.foto })),
    };
  }, [data]);

  const toggleAdd = useCallback((k: { id: number; nama: string }) => {
    setToAdd((prev) =>
      prev.some((x) => x.id === k.id)
        ? prev.filter((x) => x.id !== k.id)
        : [...prev, { id: k.id, nama: k.nama }]
    );
  }, []);

  const commitAddMembers = async () => {
    setPickerOpen(false);
    if (toAdd.length === 0) return;
    try {
      await chatApi.addMembers(roomId, toAdd.map((x) => x.id));
      const n = toAdd.length;
      setToAdd([]);
      await refetch();
      toast.success(`${n} anggota ditambahkan.`);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Gagal menambah anggota.');
    }
  };

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Info Grup</Text>
        {isAdmin && (
          <TouchableOpacity onPress={openEdit} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="create-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
        )}
      </View>

      {/* paddingBottom insets.bottom + 90 — clear bottom tab bar (Pesan tab
          tetap visible di GroupInfoScreen). Pola wajib semua scrollable
          container di screen ber-tab bar. */}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
        {/* Header grup */}
        <View style={styles.groupHeader}>
          {data.foto ? (
            <Image source={{ uri: data.foto }} style={styles.groupAvatar} />
          ) : (
            <View style={[styles.groupAvatar, styles.avatarFb]}>
              <Text style={styles.groupAvatarText}>{data.nama.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.groupName}>{data.nama}</Text>
          <Text style={styles.groupMeta}>Grup · {data.members.length} anggota</Text>
        </View>

        {/* Deskripsi */}
        <Text style={styles.sectionLabel}>DESKRIPSI</Text>
        <View style={styles.card}>
          {data.deskripsi ? (
            <Text style={styles.deskText}>{data.deskripsi}</Text>
          ) : (
            <Text style={styles.deskEmpty}>
              {isAdmin ? 'Belum ada deskripsi. Tap ikon edit di atas untuk menambah.' : 'Belum ada deskripsi.'}
            </Text>
          )}
        </View>

        {/* Anggota */}
        <View style={styles.memberHead}>
          <Text style={styles.sectionLabel}>ANGGOTA ({data.members.length})</Text>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => { setToAdd([]); setPickerOpen(true); }}
              style={styles.addBtn}
            >
              <Ionicons name="person-add" size={14} color="#3b82f6" />
              <Text style={styles.addBtnText}>Tambah</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          {data.members.map((m, idx) => {
            const isMe         = m.user_id === user?.id;
            const canRemove    = isAdmin && !m.is_creator && !isMe;
            return (
              <TouchableOpacity
                key={m.user_id}
                activeOpacity={0.6}
                onPress={() => navigation.navigate('UserProfile', { userId: m.user_id })}
                onLongPress={canRemove ? () => handleRemoveMember(m) : undefined}
                delayLongPress={350}
                style={[styles.memberRow, idx > 0 && styles.memberRowBorder]}
              >
                {m.foto ? (
                  <Image source={{ uri: m.foto }} style={styles.memberAvatar} />
                ) : (
                  <View style={[styles.memberAvatar, styles.avatarFb]}>
                    <Text style={styles.memberAvatarText}>{m.nama.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.nama}{isMe ? ' (Saya)' : ''}
                  </Text>
                  {m.jabatan ? <Text style={styles.memberJabatan} numberOfLines={1}>{m.jabatan}</Text> : null}
                </View>
                {m.is_creator ? (
                  <View style={[styles.badge, styles.badgeCreator]}>
                    <Ionicons name="star" size={10} color="#f59e0b" />
                    <Text style={[styles.badgeText, { color: '#f59e0b' }]}>Pembuat</Text>
                  </View>
                ) : m.is_admin ? (
                  <View style={[styles.badge, styles.badgeAdmin]}>
                    <Ionicons name="shield-checkmark" size={10} color="#3b82f6" />
                    <Text style={[styles.badgeText, { color: '#3b82f6' }]}>Admin</Text>
                  </View>
                ) : null}
                {canRemove && (
                  <TouchableOpacity onPress={() => handleRemoveMember(m)} hitSlop={8} style={{ marginLeft: 8 }}>
                    <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {isAdmin && (
          <Text style={styles.hint}>
            Tahan (long-press) anggota atau tap ikon merah untuk mengeluarkan dari grup.
          </Text>
        )}
      </ScrollView>

      {/* Modal Edit Grup */}
      <Modal visible={editOpen} animationType="fade" transparent onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Grup</Text>
              <TouchableOpacity onPress={() => setEditOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color="#8a94a6" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Nama Grup</Text>
            <TextInput
              style={styles.input}
              value={editNama}
              onChangeText={setEditNama}
              placeholder="Nama grup"
              placeholderTextColor="#6b7280"
              maxLength={100}
            />

            <Text style={styles.fieldLabel}>Deskripsi</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={editDesk}
              onChangeText={setEditDesk}
              placeholder="Deskripsi grup (opsional)"
              placeholderTextColor="#6b7280"
              multiline
              maxLength={500}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setEditOpen(false)}>
                <Text style={styles.btnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={saveEdit} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnSaveText}>Simpan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Picker tambah anggota */}
      <KaryawanPicker
        visible={pickerOpen}
        onClose={commitAddMembers}
        mode="multiple"
        selectedIds={toAdd.map((x) => x.id)}
        onPick={toggleAdd}
        title="Tambah Anggota"
        searchFn={searchForGroup}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 4 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },

  groupHeader: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  groupAvatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#1c2333' },
  avatarFb:    { alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  groupName:   { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  groupMeta:   { color: '#8a94a6', fontSize: 12, marginTop: 4 },

  sectionLabel: {
    color: '#8a94a6', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 14, marginBottom: 8, marginLeft: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
  },
  deskText:  { color: '#fff', fontSize: 14, lineHeight: 20, paddingVertical: 14 },
  deskEmpty: { color: '#6b7280', fontSize: 13, fontStyle: 'italic', paddingVertical: 14 },

  memberHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingRight: 16,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.30)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    marginTop: 8,
  },
  addBtnText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
  },
  memberRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  memberAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1c2333' },
  memberAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  memberName:    { color: '#fff', fontSize: 14, fontWeight: '500' },
  memberJabatan: { color: '#8a94a6', fontSize: 11, marginTop: 1 },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
    borderWidth: 1,
  },
  badgeCreator: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)' },
  badgeAdmin:   { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.35)' },
  badgeText:    { fontSize: 10, fontWeight: '700' },

  hint: {
    color: '#6b7280', fontSize: 11, fontStyle: 'italic',
    marginHorizontal: 16, marginTop: 10,
  },

  // Modal edit
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: 'rgba(26,32,48,0.98)',
    borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fieldLabel: { color: '#8a94a6', fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  btnCancel:     { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  btnCancelText: { color: '#8a94a6', fontSize: 13, fontWeight: '600' },
  btnSave: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#3b82f6', minWidth: 80, alignItems: 'center',
  },
  btnSaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
