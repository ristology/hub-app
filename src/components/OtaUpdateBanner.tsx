/**
 * Banner kuning di atas Home — tampil bila ada update OTA tersedia dan belum
 * di-dismiss user untuk manifest ini. Tap → navigasi ke screen Update.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOtaUpdate } from '../store/otaUpdate';

export default function OtaUpdateBanner() {
  const navigation = useNavigation<any>();
  const available       = useOtaUpdate((s) => s.available);
  const bannerDismissed = useOtaUpdate((s) => s.bannerDismissed);
  const dismissBanner   = useOtaUpdate((s) => s.dismissBanner);

  if (!available || bannerDismissed) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('Update')}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-download-outline" size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Update aplikasi tersedia</Text>
        <Text style={styles.subtitle}>Tap untuk lihat & pasang sekarang</Text>
      </View>
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); dismissBanner(); }}
        hitSlop={10}
        style={styles.closeBtn}
      >
        <Ionicons name="close" size={18} color="#a8a29e" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#b45309',  // amber-700 solid
    borderRadius: 12,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 1 },
  closeBtn: { padding: 4 },
});
