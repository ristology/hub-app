/**
 * Update OTA screen — tampilkan status update, changelog, tombol Unduh & Pasang.
 *
 * Flow:
 * 1. Saat masuk: tampil current runtime + manifest message + tombol install
 *    (kalau update available). Kalau tidak available → tampil "App sudah update".
 * 2. Tap tombol "Unduh & Pasang" → fetch bundle (indeterminate spinner) →
 *    `reloadAsync()` → app restart langsung pakai bundle baru.
 * 3. Pull-to-refresh atau tap "Cek Update" → paksa check ulang.
 */
import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOtaUpdate } from '../../hooks/useOtaUpdate';

export default function UpdateScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const ota        = useOtaUpdate();

  const [checking, setChecking] = React.useState(false);

  const onRefresh = async () => {
    setChecking(true);
    await ota.checkNow();
    setChecking(false);
  };

  const onInstall = () => {
    Alert.alert(
      'Pasang Update',
      'Aplikasi akan ditutup sebentar untuk pasang versi baru. Pastikan kamu sudah selesai dengan form yang belum tersimpan.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Pasang', style: 'destructive', onPress: ota.downloadAndApply },
      ],
    );
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Pembaruan Aplikasi</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={checking} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {/* Hero status card */}
        <View style={[
          styles.heroCard,
          { borderColor: ota.available ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)',
            backgroundColor: ota.available ? 'rgba(245,158,11,0.10)' : 'rgba(34,197,94,0.08)' }
        ]}>
          <Ionicons
            name={ota.available ? 'cloud-download-outline' : 'checkmark-circle-outline'}
            size={48}
            color={ota.available ? '#f59e0b' : '#22c55e'}
          />
          <Text style={[
            styles.heroTitle,
            { color: ota.available ? '#fde68a' : '#bbf7d0' }
          ]}>
            {ota.available ? 'Update tersedia' : 'Aplikasi sudah versi terbaru'}
          </Text>
          {!ota.available && (
            <Text style={styles.heroSub}>Tarik ke bawah untuk cek manual.</Text>
          )}
        </View>

        {/* Apa yang baru */}
        {ota.available && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>APA YANG BARU</Text>
            <View style={styles.card}>
              <Text style={styles.body}>
                {ota.message
                  ? ota.message
                  : 'Versi terbaru aplikasi tersedia. Pasang sekarang untuk dapatkan perbaikan & fitur terbaru.'}
              </Text>
              {ota.publishedAt && (
                <Text style={styles.metaText}>Dirilis: {formatDate(ota.publishedAt)}</Text>
              )}
            </View>
          </View>
        )}

        {/* Error */}
        {ota.error && (
          <View style={[styles.card, styles.errorCard]}>
            <Ionicons name="warning-outline" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{ota.error}</Text>
          </View>
        )}

        {/* Action button */}
        {ota.available && (
          <TouchableOpacity
            style={[styles.installBtn, ota.downloading && { opacity: 0.7 }]}
            onPress={onInstall}
            disabled={ota.downloading}
            activeOpacity={0.85}
          >
            {ota.downloading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.installBtnText}>Memasang...</Text>
              </>
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.installBtnText}>Unduh & Pasang Sekarang</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Info teknis (debug-friendly) */}
        <View style={[styles.section, { marginTop: 32 }]}>
          <Text style={styles.sectionLabel}>INFORMASI VERSI</Text>
          <View style={styles.card}>
            <InfoRow label="Versi Runtime" value={ota.runtimeVersion ?? '—'} />
            <InfoRow label="Channel" value={ota.channel ?? '—'} />
            <InfoRow label="Update ID Sekarang" value={ota.updateId?.slice(0, 12) ?? '—'} mono />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && { fontFamily: 'monospace' }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn:  { padding: 4 },
  topTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },

  heroCard: {
    alignItems: 'center', padding: 24,
    borderRadius: 16, borderWidth: 1,
    gap: 12,
  },
  heroTitle: { fontSize: 17, fontWeight: '700' },
  heroSub:   { color: '#a8a29e', fontSize: 12, marginTop: -4 },

  section:      { marginTop: 20 },
  sectionLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  body:      { color: '#e5e7eb', fontSize: 13, lineHeight: 20 },
  metaText:  { color: '#6b7280', fontSize: 11, marginTop: 10 },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.3)',
    marginTop: 16,
  },
  errorText: { color: '#fca5a5', fontSize: 12, flex: 1 },

  installBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14, borderRadius: 12,
    marginTop: 20,
  },
  installBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: { color: '#9ca3af', fontSize: 12 },
  infoValue: { color: '#fff',   fontSize: 12, fontWeight: '500', maxWidth: '60%' },
});
