/**
 * ShareToHubScreen — chooser yang muncul ketika user share content (gambar/teks)
 * dari app lain ke Afresto HUB.
 *
 * Flow:
 *   1. User di app lain (mis. Photos / Browser) → Share → pilih "Afresto HUB"
 *   2. expo-share-intent terima content → buka app → navigate ke screen ini
 *   3. User pilih tujuan: Posting Feed / Kirim Chat / Lapor Error
 *   4. Navigate ke create screen tujuan dengan content sebagai initial state
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Image, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useShareIntentContext } from 'expo-share-intent';

type ShareTarget = {
  key: 'feed' | 'chat' | 'errorlog';
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const TARGETS: ShareTarget[] = [
  {
    key: 'feed',
    label: 'Posting ke Feed',
    description: 'Bagikan ke seluruh karyawan',
    icon: 'newspaper-outline',
    color: '#3b82f6',
  },
  {
    key: 'chat',
    label: 'Kirim ke Chat',
    description: 'Pilih grup atau orang',
    icon: 'chatbubbles-outline',
    color: '#10b981',
  },
  {
    key: 'errorlog',
    label: 'Lapor Error',
    description: 'Dokumentasi error sistem klien',
    icon: 'warning-outline',
    color: '#ef4444',
  },
];

export default function ShareToHubScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  // Pakai useShareIntentContext (bukan useShareIntent) karena App.tsx wrap
  // dengan ShareIntentProvider. useShareIntent = standalone hook yg init
  // state sendiri → conflict dgn provider, hasShareIntent stuck false.
  const { isReady, hasShareIntent, shareIntent, resetShareIntent, error } =
    useShareIntentContext();

  // Derive preview URI langsung dari shareIntent — no separate state.
  const previewUri = shareIntent?.files?.[0]?.path ?? null;

  const handlePick = (target: ShareTarget) => {
    if (!shareIntent) {
      navigation.goBack();
      return;
    }
    const files = shareIntent.files ?? [];
    const text  = shareIntent.text ?? '';
    const url   = shareIntent.webUrl ?? '';
    const sharedPayload = {
      sharedFiles: files,
      sharedText:  text || url,
    };

    // Routing ke tab/stack tujuan via MainTabs > <Tab> > <Screen>.
    // NOTE: navigate dgn nested params supaya React Navigation tahu masuk
    // tab dulu, baru screen di dalam stack-nya.
    //
    // Target screens BELUM consume sharedFiles param di iteration ini —
    // PR berikutnya tambah handling. Untuk sekarang: user navigate ke
    // screen tujuan, lalu PILIH foto manual via picker existing (tidak
    // ideal, tapi tidak block flow share).
    if (target.key === 'feed') {
      navigation.navigate('MainTabs', {
        screen: 'Feed',
        params: { screen: 'CreateFeed', params: sharedPayload },
      });
    } else if (target.key === 'errorlog') {
      navigation.navigate('MainTabs', {
        screen: 'ErrorLog',
        params: { screen: 'CreateErrorLog', params: sharedPayload },
      });
    } else if (target.key === 'chat') {
      navigation.navigate('MainTabs', {
        screen: 'Pesan',
        params: { screen: 'ChatList', params: { shareMode: true, ...sharedPayload } },
      });
    }

    // Reset SETELAH navigate, beri delay supaya target screen mount dulu
    // (kalau reset duluan, state berubah → re-render ShareToHub → keburu
    // tampil "Tidak ada konten" sebelum navigate selesai).
    setTimeout(() => resetShareIntent(), 600);
  };

  const handleCancel = () => {
    resetShareIntent();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Bagikan ke...</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Preview konten yg di-share */}
        {previewUri && (
          <View style={styles.previewWrap}>
            <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
            {(shareIntent?.files?.length ?? 0) > 1 && (
              <View style={styles.fileBadge}>
                <Text style={styles.fileBadgeText}>+{(shareIntent?.files?.length ?? 1) - 1}</Text>
              </View>
            )}
          </View>
        )}

        {!previewUri && shareIntent?.text && (
          <View style={styles.textPreview}>
            <Text style={styles.textPreviewLabel}>Teks yang dibagikan:</Text>
            <Text style={styles.textPreviewContent} numberOfLines={4}>
              {shareIntent.text}
            </Text>
          </View>
        )}

        {/* Loading state: provider belum siap atau intent belum delivered */}
        {!isReady && (
          <View style={styles.emptyState}>
            <ActivityIndicator color="#8a94a6" />
            <Text style={styles.emptyText}>Menyiapkan konten share...</Text>
          </View>
        )}

        {/* Error state */}
        {isReady && error && (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={36} color="#ef4444" />
            <Text style={styles.emptyText}>Gagal baca konten share: {error}</Text>
          </View>
        )}

        {/* Ready tapi tidak ada konten — biasanya muncul kalau share extension
            launch tapi konten tidak ter-transfer (mis. App Groups misconfig) */}
        {isReady && !hasShareIntent && !error && (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={36} color="#8a94a6" />
            <Text style={styles.emptyText}>Tidak ada konten share yang terdeteksi.</Text>
          </View>
        )}

        {/* Target chooser */}
        <Text style={styles.sectionLabel}>Pilih tujuan:</Text>
        {TARGETS.map((target) => (
          <TouchableOpacity
            key={target.key}
            style={styles.targetCard}
            activeOpacity={0.7}
            onPress={() => handlePick(target)}
            disabled={!isReady || !hasShareIntent}
          >
            <View style={[styles.targetIcon, { backgroundColor: target.color + '22' }]}>
              <Ionicons name={target.icon} size={26} color={target.color} />
            </View>
            <View style={styles.targetText}>
              <Text style={styles.targetLabel}>{target.label}</Text>
              <Text style={styles.targetDesc}>{target.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#8a94a6" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeBtn: { padding: 4 },
  title:   { color: '#fff', fontSize: 17, fontWeight: '600' },
  content: { padding: 16, gap: 12 },
  previewWrap: {
    alignSelf: 'center', maxWidth: 240, position: 'relative',
    borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  preview: { width: 240, height: 240 },
  fileBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
  },
  fileBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  textPreview: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: 12, gap: 6,
  },
  textPreviewLabel:   { color: '#8a94a6', fontSize: 12, fontWeight: '600' },
  textPreviewContent: { color: '#e2e8f0', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText:  { color: '#8a94a6', fontSize: 14 },
  sectionLabel: {
    color: '#8a94a6', fontSize: 12, fontWeight: '600',
    marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  targetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  targetIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  targetText: { flex: 1, gap: 2 },
  targetLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  targetDesc:  { color: '#8a94a6', fontSize: 12 },
});
