import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, FlatList, StyleSheet,
  Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export type PickerOption = {
  id: number | string | null;  // null untuk "Tanpa pilihan"
  label: string;
  sublabel?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  selectedId: number | string | null | undefined;
  onPick: (option: PickerOption) => void;
  /** Aktifkan search bar (cocok untuk list panjang seperti klien) */
  searchable?: boolean;
  searchPlaceholder?: string;
};

export default function PickerSheet({
  visible, onClose, title, options, selectedId, onPick,
  searchable = false, searchPlaceholder = 'Cari...',
}: Props) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  // Manual keyboard listener — KeyboardAvoidingView di Modal Android
  // edge-to-edge tidak push sheet di atas keyboard (tetap di bawah)
  useEffect(() => {
    if (!visible) { setKbHeight(0); return; }
    const showName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showName, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideName, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible]);

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q)
      || (o.sublabel ?? '').toLowerCase().includes(q));
  }, [options, search, searchable]);

  // Sheet harus naik saat keyboard muncul
  const sheetMarginBottom = kbHeight > 0
    ? kbHeight + (Platform.OS === 'android' ? insets.bottom : 0)
    : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { marginBottom: sheetMarginBottom }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#8a94a6" />
            </TouchableOpacity>
          </View>

          {searchable && (
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor="#6b7280"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id ?? 'null')}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[styles.item, selected && styles.itemSelected]}
                  onPress={() => { onPick(item); onClose(); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, selected && styles.itemLabelSelected]}>
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text style={styles.itemSublabel}>{item.sublabel}</Text>
                    ) : null}
                  </View>
                  {selected && <Ionicons name="checkmark" size={18} color="#3b82f6" />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {search ? `Tidak ada hasil untuk "${search}"` : 'Tidak ada pilihan.'}
              </Text>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1c2333',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, marginBottom: 10,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, paddingHorizontal: 12, marginHorizontal: 4, marginBottom: 8,
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
  },
  itemSelected:      { backgroundColor: 'rgba(59,130,246,0.15)' },
  itemLabel:         { color: '#fff', fontSize: 14 },
  itemLabelSelected: { color: '#3b82f6', fontWeight: '700' },
  itemSublabel:      { color: '#8a94a6', fontSize: 11, marginTop: 2 },
  empty: { color: '#8a94a6', fontSize: 13, textAlign: 'center', paddingVertical: 30 },
});
