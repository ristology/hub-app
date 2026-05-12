/**
 * ProfileSheet — animated panel yang slide turun dari atas.
 * Tampilkan data profile karyawan + tombol ganti foto + ganti password.
 *
 * Pattern: bukan Modal, melainkan Animated overlay (sesuai feedback memory
 * tentang sheet stacking yang harus pakai Animated.View).
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Image, ActivityIndicator,
  Dimensions, ScrollView, TouchableWithoutFeedback, Alert, Modal, TextInput,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { profileApi, type ProfileResponse } from '../api/profile';
import { useAuth } from '../store/auth';
import { useToast } from './Toast';
import SaveButton from './SaveButton';
import ImageViewerModal from './ImageViewerModal';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const { height: SCREEN_H } = Dimensions.get('window');
const ANIM_DURATION = 280;

export default function ProfileSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { setUserFoto } = useAuth();

  const slideAnim = useRef(new Animated.Value(-SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwLama, setPwLama]           = useState('');
  const [pwBaru, setPwBaru]           = useState('');
  const [pwKonfirm, setPwKonfirm]     = useState('');
  const [pwShow, setPwShow]           = useState(false);
  const [fotoViewerUri, setFotoViewerUri] = useState<string | null>(null);

  // Fetch profile saat sheet dibuka
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn:  profileApi.show,
    enabled:  visible,
  });

  // Animasi slide
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: visible ? 0 : -SCREEN_H,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  // Upload foto mutation
  const fotoMut = useMutation({
    mutationFn: (foto: { uri: string; name: string; type: string }) => profileApi.updateFoto(foto),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setUserFoto(res.foto_url);
      toast.success('Foto profil diperbarui.');
    },
    onError: () => toast.error('Gagal upload foto.'),
  });

  // Ubah password mutation
  const pwMut = useMutation({
    mutationFn: () => profileApi.ubahPassword({
      password_lama:               pwLama,
      password_baru:               pwBaru,
      password_baru_confirmation:  pwKonfirm,
    }),
    onSuccess: () => {
      toast.success('Password berhasil diubah.');
      setPwModalOpen(false);
      setPwLama(''); setPwBaru(''); setPwKonfirm('');
    },
    onError: (e: any) => {
      const msg = e.response?.data?.errors?.password_lama?.[0]
               ?? e.response?.data?.errors?.password_baru?.[0]
               ?? e.response?.data?.message
               ?? 'Gagal ubah password.';
      Alert.alert('Error', msg);
    },
  });

  const pilihFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Galeri', 'Berikan izin akses galeri untuk pilih foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const ext   = asset.uri.split('.').pop() ?? 'jpg';
    fotoMut.mutate({
      uri:  asset.uri,
      name: `foto.${ext}`,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    });
  };

  const submitUbahPw = () => {
    if (!pwLama || !pwBaru || !pwKonfirm) {
      Alert.alert('Validasi', 'Semua field wajib diisi.');
      return;
    }
    if (pwBaru.length < 6) {
      Alert.alert('Validasi', 'Password baru minimal 6 karakter.');
      return;
    }
    if (pwBaru !== pwKonfirm) {
      Alert.alert('Validasi', 'Konfirmasi password tidak cocok.');
      return;
    }
    pwMut.mutate();
  };

  const k = data?.karyawan;
  const u = data?.user;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { opacity: backdropOpacity },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Panel slide */}
      <Animated.View
        style={[
          styles.panel,
          {
            paddingTop: insets.top,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>Profil Saya</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {isLoading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Avatar + Nama */}
              <View style={styles.avatarSection}>
                <View style={styles.avatarWrap}>
                  {k?.foto_url ? (
                    <TouchableOpacity activeOpacity={0.85} onPress={() => setFotoViewerUri(k.foto_url)}>
                      <Image source={{ uri: k.foto_url }} style={styles.avatar} />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.avatar, styles.avatarFb]}>
                      <Text style={styles.avatarText}>{u?.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.cameraBtn}
                    onPress={pilihFoto}
                    disabled={fotoMut.isPending}
                  >
                    {fotoMut.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="camera" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.name}>{k?.nama_lengkap ?? u?.name}</Text>
                <Text style={styles.subtle}>{k?.jabatan ?? '—'}</Text>
                {k?.departemen && (
                  <View style={styles.deptBadge}>
                    <Ionicons name="business-outline" size={11} color="#93c5fd" />
                    <Text style={styles.deptText}>{k.departemen}</Text>
                  </View>
                )}
              </View>

              {/* Info detail */}
              <Text style={styles.sectionLabel}>INFORMASI</Text>
              <View style={styles.card}>
                <InfoRow icon="card-outline"    label="NIP"          value={k?.nip} />
                <InfoRow icon="at-outline"      label="Email Login"  value={u?.email} />
                <InfoRow icon="mail-outline"    label="Email Pribadi" value={k?.email || '—'} />
                <InfoRow icon="call-outline"    label="No. Telp"     value={k?.no_telp || '—'} />
                <InfoRow icon="person-outline"  label="Jenis Kelamin" value={k?.jenis_kelamin} />
                <InfoRow icon="calendar-outline" label="Tanggal Lahir"
                         value={k?.tanggal_lahir
                           ? `${k.tanggal_lahir} (${k.umur} tahun)`
                           : '—'} />
                <InfoRow icon="ribbon-outline"   label="Golongan"     value={k?.golongan || '—'} />
                <InfoRow icon="school-outline"   label="Pendidikan"   value={k?.pendidikan_terakhir || '—'} />
                <InfoRow icon="enter-outline"    label="Tanggal Masuk" value={k?.tanggal_masuk || '—'} />
                <InfoRow icon="location-outline" label="Alamat"       value={k?.alamat || '—'} last />
              </View>

              {k?.bio && (
                <>
                  <Text style={styles.sectionLabel}>BIO</Text>
                  <View style={styles.card}>
                    <Text style={styles.bioText}>{k.bio}</Text>
                  </View>
                </>
              )}

              {/* Aksi */}
              <Text style={styles.sectionLabel}>AKSI</Text>
              <TouchableOpacity style={styles.actionBtn} onPress={pilihFoto} disabled={fotoMut.isPending}>
                <Ionicons name="camera-outline" size={18} color="#3b82f6" />
                <Text style={styles.actionText}>Ganti Foto Profil</Text>
                <Ionicons name="chevron-forward" size={16} color="#6b7280" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => setPwModalOpen(true)}>
                <Ionicons name="key-outline" size={18} color="#f59e0b" />
                <Text style={styles.actionText}>Ganti Password</Text>
                <Ionicons name="chevron-forward" size={16} color="#6b7280" />
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Fullscreen photo viewer (tap avatar utk perbesar) */}
      <ImageViewerModal uri={fotoViewerUri} onClose={() => setFotoViewerUri(null)} />

      {/* Modal Ganti Password */}
      <Modal visible={pwModalOpen} animationType="fade" transparent onRequestClose={() => setPwModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.pwModalOverlay}
        >
          <View style={styles.pwModalContent}>
            <View style={styles.pwModalHeader}>
              <Text style={styles.pwModalTitle}>
                <Ionicons name="key" size={16} color="#f59e0b" /> Ganti Password
              </Text>
              <TouchableOpacity onPress={() => setPwModalOpen(false)}>
                <Ionicons name="close" size={22} color="#8a94a6" />
              </TouchableOpacity>
            </View>

            <Text style={styles.pwLabel}>Password Lama</Text>
            <TextInput
              style={styles.pwInput}
              value={pwLama}
              onChangeText={setPwLama}
              secureTextEntry={!pwShow}
              placeholder="Password saat ini"
              placeholderTextColor="#6b7280"
            />
            <Text style={styles.pwLabel}>Password Baru</Text>
            <TextInput
              style={styles.pwInput}
              value={pwBaru}
              onChangeText={setPwBaru}
              secureTextEntry={!pwShow}
              placeholder="Minimal 6 karakter"
              placeholderTextColor="#6b7280"
            />
            <Text style={styles.pwLabel}>Konfirmasi Password Baru</Text>
            <TextInput
              style={styles.pwInput}
              value={pwKonfirm}
              onChangeText={setPwKonfirm}
              secureTextEntry={!pwShow}
              placeholder="Ulangi password baru"
              placeholderTextColor="#6b7280"
            />

            <TouchableOpacity onPress={() => setPwShow(s => !s)} style={styles.pwShowToggle}>
              <Ionicons name={pwShow ? 'eye-off' : 'eye'} size={14} color="#8a94a6" />
              <Text style={styles.pwShowText}>{pwShow ? 'Sembunyikan' : 'Tampilkan'} password</Text>
            </TouchableOpacity>

            <View style={styles.pwModalActions}>
              <TouchableOpacity
                style={[styles.pwBtn, styles.pwBtnCancel]}
                onPress={() => setPwModalOpen(false)}
              >
                <Text style={styles.pwBtnCancelText}>Batal</Text>
              </TouchableOpacity>
              <SaveButton onPress={submitUbahPw} loading={pwMut.isPending} label="Simpan" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function InfoRow({ icon, label, value, last }: {
  icon: any; label: string; value: any; last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Ionicons name={icon} size={15} color="#8a94a6" style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Glass theme — semi-transparent + bordered + glow ──────────
  backdrop: {
    // Backdrop lebih ringan: 0.5 → konten Home masih terlihat samar di balik panel
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99,
  },
  panel: {
    position: 'absolute', left: 0, right: 0, top: 0,
    // Glass effect: bg sangat transparan + border halus + radius
    backgroundColor: 'rgba(15,20,25,0.72)',
    maxHeight: SCREEN_H * 0.92,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    zIndex: 100,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20,
    elevation: 18,
    overflow: 'hidden',
  },
  handle: {
    width: 44, height: 4, backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 2, alignSelf: 'center', marginTop: 10,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },

  avatarSection: { alignItems: 'center', paddingVertical: 18 },
  avatarWrap: {
    position: 'relative',
    // Glow halo di sekitar avatar
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 16, elevation: 8,
  },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)',
  },
  avatarFb: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.95)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(15,20,25,0.95)',
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 6, elevation: 6,
  },
  name: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 14 },
  subtle: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  deptBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.40)',
  },
  deptText: { color: '#bfdbfe', fontSize: 10, fontWeight: '700' },

  sectionLabel: {
    color: '#8a94a6', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 18, marginBottom: 8, marginLeft: 2,
  },
  card: {
    // Glass card: lebih transparan + border lebih kontras
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  infoLabel: { color: '#9ca3af', fontSize: 11, marginBottom: 2 },
  infoValue: { color: '#fff', fontSize: 13 },
  bioText: { color: '#d1d5db', fontSize: 13, lineHeight: 19, paddingVertical: 10 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '500', flex: 1 },

  // Modal Password — glass theme
  pwModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  pwModalContent: {
    backgroundColor: 'rgba(26,32,48,0.92)',
    borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  pwModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pwModalTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pwLabel: { color: '#8a94a6', fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  pwInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pwShowToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  pwShowText: { color: '#8a94a6', fontSize: 11 },
  pwModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  pwBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  pwBtnCancel: { backgroundColor: 'rgba(255,255,255,0.06)' },
  pwBtnCancelText: { color: '#8a94a6', fontSize: 13, fontWeight: '600' },
});
