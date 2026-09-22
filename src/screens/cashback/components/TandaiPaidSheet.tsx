import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
  Animated, Dimensions, BackHandler, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { transcodeHeicIfNeeded } from '../../../utils/transcodeHeicIfNeeded';
import type { MetodeBayar } from '../../../api/cashback';

export type BuktiFile = { uri: string; name: string; type: string };

type Props = {
  visible: boolean;
  judul: string;
  nominal: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { metode: MetodeBayar; bukti?: BuktiFile }) => void;
};

const METODE: { key: MetodeBayar; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    key: 'dibayarkan',
    label: 'Dibayarkan ke Klien',
    desc: 'Transfer ke rekening klien — wajib lampirkan bukti transfer.',
    icon: 'card-outline',
  },
  {
    key: 'dipotong',
    label: 'Dipotong dari Tagihan',
    desc: 'Cashback dipotong langsung dari tagihan invoice — tanpa bukti.',
    icon: 'cut-outline',
  },
];

/**
 * Bottom sheet "Tandai Paid" untuk Cashback.
 *
 * Aturannya ikut web: metode 'dibayarkan' WAJIB melampirkan bukti transfer,
 * metode 'dipotong' tidak. Tombol submit tetap mati sampai syaratnya lengkap,
 * jadi user tidak menabrak error 422 dari server.
 *
 * Animated overlay (bukan <Modal>) supaya konsisten dengan sheet lain dan
 * aman kalau nanti ada picker ber-Modal ditambahkan ke dalamnya.
 */
export default function TandaiPaidSheet({
  visible, judul, nominal, submitting = false, onClose, onSubmit,
}: Props) {
  const insets  = useSafeAreaInsets();
  const screenH = Dimensions.get('window').height;

  const [mounted, setMounted] = useState(visible);
  const [metode, setMetode]   = useState<MetodeBayar | null>(null);
  const [bukti, setBukti]     = useState<BuktiFile | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const slideY    = useRef(new Animated.Value(screenH)).current;
  const backdropO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMetode(null);
      setBukti(null);
      setError(null);
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideY,    { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropO, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideY,    { toValue: screenH, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropO, { toValue: 0,       duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [mounted, onClose]);

  const simpanBukti = async (file: { uri: string; name: string; type: string }) => {
    setPicking(true);
    try {
      const transcoded = await transcodeHeicIfNeeded(file);
      setBukti(transcoded);
      setError(null);
    } finally {
      setPicking(false);
    }
  };

  const pickFoto = async (source: 'camera' | 'gallery') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Aplikasi butuh akses kamera/galeri untuk upload bukti.');
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
        });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    await simpanBukti({
      uri:  a.uri,
      name: a.fileName ?? `bukti_${Date.now()}.jpg`,
      type: a.mimeType ?? 'image/jpeg',
    });
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await simpanBukti({
      uri:  a.uri,
      name: a.name ?? `bukti_${Date.now()}`,
      type: a.mimeType ?? 'application/octet-stream',
    });
  };

  const butuhBukti = metode === 'dibayarkan';
  const canSubmit  = !!metode && (!butuhBukti || !!bukti) && !submitting && !picking;

  const handleSubmit = () => {
    if (!metode)                 { setError('Pilih metode pembayaran dulu.'); return; }
    if (butuhBukti && !bukti)    { setError('Bukti transfer wajib untuk metode "Dibayarkan".'); return; }
    setError(null);
    onSubmit({ metode, bukti: butuhBukti ? bukti! : undefined });
  };

  if (!mounted) return null;

  const tabBarH = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={submitting ? undefined : onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropO }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { paddingBottom: tabBarH + 12, transform: [{ translateY: slideY }] }]}
      >
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Tandai Paid</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{judul} · {nominal}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} disabled={submitting}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: screenH * 0.52 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>METODE PEMBAYARAN *</Text>
          {METODE.map((m) => {
            const active = metode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.metodeCard, active && styles.metodeCardActive]}
                onPress={() => {
                  setMetode(m.key);
                  setError(null);
                  // Pindah ke 'dipotong' → bukti tidak relevan lagi, buang
                  // supaya tidak ikut terkirim.
                  if (m.key === 'dipotong') setBukti(null);
                }}
                disabled={submitting}
              >
                <Ionicons name={m.icon} size={20} color={active ? '#3b82f6' : '#8a94a6'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.metodeLabel, active && { color: '#3b82f6' }]}>{m.label}</Text>
                  <Text style={styles.metodeDesc}>{m.desc}</Text>
                </View>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={active ? '#3b82f6' : '#4b5563'}
                />
              </TouchableOpacity>
            );
          })}

          {butuhBukti && (
            <>
              <Text style={styles.label}>BUKTI TRANSFER *</Text>
              {bukti ? (
                <View style={styles.fileBox}>
                  <Ionicons name="document-attach-outline" size={18} color="#22c55e" />
                  <Text style={styles.fileName} numberOfLines={1}>{bukti.name}</Text>
                  <TouchableOpacity onPress={() => setBukti(null)} hitSlop={8} disabled={submitting}>
                    <Ionicons name="close-circle" size={18} color="#8a94a6" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickRow}>
                  <TouchableOpacity style={styles.pickBtn} onPress={() => pickFoto('camera')} disabled={picking || submitting}>
                    <Ionicons name="camera-outline" size={17} color="#3b82f6" />
                    <Text style={styles.pickText}>Kamera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pickBtn} onPress={() => pickFoto('gallery')} disabled={picking || submitting}>
                    <Ionicons name="images-outline" size={17} color="#3b82f6" />
                    <Text style={styles.pickText}>Galeri</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pickBtn} onPress={pickFile} disabled={picking || submitting}>
                    <Ionicons name="document-outline" size={17} color="#3b82f6" />
                    <Text style={styles.pickText}>File</Text>
                  </TouchableOpacity>
                </View>
              )}
              {picking && <ActivityIndicator color="#3b82f6" style={{ marginTop: 10 }} />}
              <Text style={styles.hint}>Format JPG, JPEG, PNG, atau PDF. Maksimal 5 MB.</Text>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnOff]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Tandai Paid</Text>}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#0d1421',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginTop: 8, marginBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  title:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#8a94a6', fontSize: 12, marginTop: 2 },
  label:    { color: '#8a94a6', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  hint:     { color: '#6b7280', fontSize: 11, marginTop: 6 },

  metodeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  metodeCardActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.5)',
  },
  metodeLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  metodeDesc:  { color: '#8a94a6', fontSize: 11, marginTop: 2 },

  pickRow: { flexDirection: 'row', gap: 8 },
  pickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pickText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  fileBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(34,197,94,0.10)',
    paddingHorizontal: 12, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)',
  },
  fileName: { flex: 1, color: '#fff', fontSize: 13 },

  error: { color: '#ef4444', fontSize: 12, marginTop: 12 },

  submitBtn: {
    marginTop: 16, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#16a34a',
  },
  submitBtnOff: { backgroundColor: 'rgba(255,255,255,0.10)' },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
