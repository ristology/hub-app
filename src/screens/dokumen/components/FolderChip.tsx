import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DokumenFolder } from '../../../api/dokumen';

type Props = {
  folder: DokumenFolder;
  active?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

export default function FolderChip({ folder, active, onPress, onLongPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        { backgroundColor: folder.warna + '22', borderColor: folder.warna + (active ? 'FF' : '60') },
        active && styles.chipActive,
      ]}
    >
      <Ionicons name="folder" size={16} color={folder.warna} />
      <Text style={[styles.name, { color: '#fff' }]} numberOfLines={1}>{folder.nama}</Text>
      <View style={[styles.count, { backgroundColor: folder.warna + '40' }]}>
        <Text style={styles.countText}>{folder.jumlah_dokumen}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 100,
  },
  chipActive: { borderWidth: 2 },
  name: { fontSize: 12, fontWeight: '600', maxWidth: 120 },
  count: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  countText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
