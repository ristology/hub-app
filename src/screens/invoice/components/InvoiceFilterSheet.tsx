import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
  Animated, Dimensions, BackHandler, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import DatePickerInput from '../../../components/DatePickerInput';

export type InvoiceFilters = {
  /** Rentang tanggal transfer, format YYYY-MM-DD */
  bayar_dari?: string | null;
  bayar_sampai?: string | null;
  /** Nomor rekening penerima, atau REKENING_KOSONG */
  rekening?: string | null;
};

export function hitungFilterAktif(f: InvoiceFilters): number {
  let n = 0;
  if (f.bayar_dari)   n++;
  if (f.bayar_sampai) n++;
  if (f.rekening)     n++;
  return n;
}

type Props = {
  visible: boolean;
  draft: InvoiceFilters;
  /** Label rekening terpilih, disiapkan Screen (sumber datanya ada di sana) */
  rekeningLabel?: string;
  onDraftChange: (d: InvoiceFilters) => void;
  onOpenRekening: () => void;
  onClose: () => void;
  onApply: (f: InvoiceFilters) => void;
  onReset: () => void;
};

/**
 * Filter lanjutan daftar Invoice: rentang tanggal transfer + rekening penerima.
 * Paritas dengan filter yang sama di web.
 *
 * Sheet ini Animated overlay, BUKAN <Modal> — DatePickerInput membuka <Modal>
 * sendiri di iOS, dan Modal di dalam Modal bikin picker tidak muncul. Picker
 * rekening-nya sendiri tetap <Modal> (PickerSheet) dan dirender oleh Screen,
 * sesuai pola yang sama dengan FilterSheet di modul Request.
 */
export default function InvoiceFilterSheet({
  visible, draft, rekeningLabel,
  onDraftChange, onOpenRekening, onClose, onApply, onReset,
}: Props) {
  const insets  = useSafeAreaInsets();
  const screenH = Dimensions.get('window').height;

  const [mounted, setMounted] = useState(visible);
  const slideY    = useRef(new Animated.Value(screenH)).current;
  const backdropO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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

  if (!mounted) return null;

  // Clear tab bar supaya tombol bawah tidak tertutup
  const tabBarH = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);
  const hariIni = new Date();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropO }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { paddingBottom: tabBarH + 12, transform: [{ translateY: slideY }] }]}
      >
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>Filter Invoice</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: screenH * 0.5 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>TANGGAL TRANSFER — DARI</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <DatePickerInput
                value={draft.bayar_dari ?? null}
                onChange={(v) => onDraftChange({ ...draft, bayar_dari: v || null })}
                placeholder="Pilih tanggal awal..."
                maximumDate={hariIni}
              />
            </View>
          </View>

          <Text style={styles.label}>TANGGAL TRANSFER — SAMPAI</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <DatePickerInput
                value={draft.bayar_sampai ?? null}
                onChange={(v) => onDraftChange({ ...draft, bayar_sampai: v || null })}
                placeholder="Pilih tanggal akhir..."
                maximumDate={hariIni}
              />
            </View>
          </View>
          <Text style={styles.hint}>
            Invoice yang belum lunas tidak punya tanggal transfer, jadi ikut
            tersaring keluar begitu rentang diisi.
          </Text>

          <Text style={styles.label}>REKENING PENERIMA</Text>
          <TouchableOpacity style={styles.field} onPress={onOpenRekening} activeOpacity={0.7}>
            <Ionicons name="card-outline" size={16} color="#3b82f6" />
            <Text style={[styles.fieldText, !draft.rekening && styles.fieldEmpty]} numberOfLines={1}>
              {draft.rekening ? (rekeningLabel || 'Rekening terpilih') : 'Semua rekening'}
            </Text>
            {draft.rekening ? (
              <TouchableOpacity
                onPress={() => onDraftChange({ ...draft, rekening: null })}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color="#8a94a6" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#6b7280" />
            )}
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyBtn} onPress={() => onApply(draft)}>
            <Text style={styles.applyText}>Terapkan</Text>
          </TouchableOpacity>
        </View>
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
  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  label: {
    color: '#8a94a6', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, marginTop: 14, marginBottom: 6,
  },
  hint: { color: '#6b7280', fontSize: 11, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  fieldText:  { flex: 1, color: '#fff', fontSize: 14 },
  fieldEmpty: { color: '#6b7280' },

  actions: {
    flexDirection: 'row', gap: 10, paddingTop: 14, marginTop: 4,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  resetBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  resetText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  applyBtn: {
    flex: 2, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#3b82f6',
  },
  applyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
