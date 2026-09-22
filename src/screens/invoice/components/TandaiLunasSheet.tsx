import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
  Animated, Dimensions, BackHandler, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import DatePickerInput from '../../../components/DatePickerInput';
import { transcodeHeicIfNeeded } from '../../../utils/transcodeHeicIfNeeded';

export type BuktiFile = { uri: string; name: string; type: string };

type Props = {
  visible: boolean;
  noInvoice: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { bukti: BuktiFile; tanggalBayar: string }) => void;
};

function todayISO(): string {
  // Pakai komponen tanggal LOKAL — toISOString() bergeser ke UTC dan bisa
  // memundurkan tanggal sehari untuk user WIB/WITA/WIT.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Bottom sheet "Tandai Lunas" — tanggal transfer WAJIB diisi sebelum bisa
 * submit, sejajar dengan modal upload bukti transfer di web.
 *
 * Sheet ini sengaja Animated overlay (bukan <Modal>) karena DatePickerInput
 * membuka <Modal> sendiri di iOS — Modal di dalam Modal bikin picker tidak
 * muncul. Pola yang sama dipakai FilterSheet di modul Request.
 */
export default function TandaiLunasSheet({
  visible, noInvoice, submitting = false, onClose, onSubmit,
}: Props) {
  const insets  = useSafeAreaInsets();
  const screenH = Dimensions.get('window').height;

  const [mounted, setMounted] = useState(visible);
  const [tanggal, setTanggal] = useState<string>(todayISO());
  const [bukti, setBukti]     = useState<BuktiFile | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const slideY    = useRef(new Animated.Value(screenH)).current;
  const backdropO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset isian tiap sheet dibuka
      setTanggal(todayISO());
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

  const pickBukti = async (source: 'camera' | 'gallery') => {
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

    const asset = result.assets[0];
    setPicking(true);
    try {
      // Transcode HEIC → JPEG di iPhone sebelum upload
      const transcoded = await transcodeHeicIfNeeded({
        uri:  asset.uri,
        name: asset.fileName ?? `bukti_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      setBukti(transcoded);
      setError(null);
    } finally {
      setPicking(false);
    }
  };

  const handleSubmit = () => {
    if (!tanggal) { setError('Tanggal transfer wajib diisi.'); return; }
    if (!bukti)   { setError('Bukti transfer wajib diupload.'); return; }
    setError(null);
    onSubmit({ bukti, tanggalBayar: tanggal });
  };

  if (!mounted) return null;

  // Clear tab bar supaya tombol submit tidak tertutup
  const tabBarH   = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);
  const canSubmit = !!tanggal && !!bukti && !submitting && !picking;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={submitting ? undefined : onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropO }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: tabBarH + 12, transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Tandai Lunas</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{noInvoice}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} disabled={submitting}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: screenH * 0.5 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>TANGGAL TRANSFER *</Text>
          <DatePickerInput
            value={tanggal}
            onChange={(v) => { setTanggal(v); if (v) setError(null); }}
            placeholder="Pilih tanggal transfer..."
          />
          <Text style={styles.hint}>Tanggal uang benar-benar ditransfer klien.</Text>

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
              <TouchableOpacity
                style={styles.pickBtn}
                onPress={() => pickBukti('camera')}
                disabled={picking || submitting}
              >
                <Ionicons name="camera-outline" size={18} color="#3b82f6" />
                <Text style={styles.pickText}>Foto Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickBtn}
                onPress={() => pickBukti('gallery')}
                disabled={picking || submitting}
              >
                <Ionicons name="images-outline" size={18} color="#3b82f6" />
                <Text style={styles.pickText}>Pilih Galeri</Text>
              </TouchableOpacity>
            </View>
          )}
          {picking && <ActivityIndicator color="#3b82f6" style={{ marginTop: 10 }} />}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnOff]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>Tandai Lunas</Text>}
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

  pickRow: { flexDirection: 'row', gap: 10 },
  pickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pickText: { color: '#fff', fontSize: 13, fontWeight: '600' },

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
