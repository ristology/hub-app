import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DokumenFolder } from '../../../api/dokumen';

type Props = {
  folders: DokumenFolder[];
  onPress: (folder: DokumenFolder) => void;
  onLongPress?: (folder: DokumenFolder) => void;
};

export default function FolderGrid({ folders, onPress, onLongPress }: Props) {
  if (folders.length === 0) return null;

  return (
    <View style={styles.grid}>
      {folders.map((f) => (
        <TouchableOpacity
          key={f.id}
          style={styles.box}
          onPress={() => onPress(f)}
          onLongPress={onLongPress ? () => onLongPress(f) : undefined}
          activeOpacity={0.75}
          delayLongPress={350}
        >
          <Ionicons name="folder" size={42} color={f.warna} />
          <Text style={styles.name} numberOfLines={2}>{f.nama}</Text>
          <Text style={styles.count}>{f.jumlah_dokumen} dokumen</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingBottom: 6,
  },
  box: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 120,
  },
  name:  { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  count: { color: '#8a94a6', fontSize: 11 },
});
