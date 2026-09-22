import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { invoiceApi, type KlienRingkas } from '../../../api/invoice';

type Props = {
  /** Klien yang sedang dipakai sebagai filter (null = semua klien) */
  selected: KlienRingkas | null;
  onSelect: (klien: KlienRingkas | null) => void;
  placeholder?: string;
};

/**
 * Kolom pencarian nama klien bergaya autocomplete — sejajar dengan filter
 * klien di web (input teks + dropdown saran, bukan dropdown statis).
 *
 * Dropdown-nya absolute + zIndex/elevation supaya menimpa stat box & chip
 * filter di bawahnya (Android butuh elevation, zIndex saja tidak cukup).
 */
export default function KlienSearchBar({ selected, onSelect, placeholder }: Props) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<KlienRingkas[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);

  // Input teks selalu ikut klien yang sedang terpilih (mis. saat filter direset
  // dari luar komponen ini).
  useEffect(() => { setQuery(selected?.nama ?? ''); }, [selected]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) { setResults([]); return; }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await invoiceApi.klienList(q);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, open]);

  const pilih = (k: KlienRingkas) => {
    setOpen(false);
    setResults([]);
    setQuery(k.nama);
    onSelect(k);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#6b7280" />
        <TextInput
          style={styles.input}
          placeholder={placeholder ?? 'Cari nama klien...'}
          placeholderTextColor="#6b7280"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setOpen(true);
            // Ngetik ulang = batalkan pilihan sebelumnya sampai user pilih
            // lagi dari dropdown — sama seperti autocomplete di web.
            if (selected) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
          // Dropdown pakai keyboardShouldPersistTaps="handled" → tap item TIDAK
          // memicu blur duluan, jadi menutup di onBlur aman.
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onSubmitEditing={() => setOpen(false)}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clear} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {open && query.trim().length > 0 && (
        <View style={styles.drop}>
          {loading ? (
            <ActivityIndicator color="#3b82f6" style={{ paddingVertical: 14 }} />
          ) : results.length === 0 ? (
            <Text style={styles.empty}>Klien tidak ditemukan.</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
              {results.map((k) => (
                <TouchableOpacity key={k.id} style={styles.item} onPress={() => pilih(k)}>
                  <Ionicons name="business-outline" size={16} color="#3b82f6" />
                  <Text style={styles.itemText} numberOfLines={1}>{k.nama}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16, paddingTop: 10,
    zIndex: 20, elevation: 20,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  input: { flex: 1, color: '#fff', paddingVertical: 9, fontSize: 14 },

  drop: {
    position: 'absolute', top: '100%', left: 16, right: 16,
    marginTop: 4,
    backgroundColor: '#161f33',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 30, elevation: 30,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemText: { flex: 1, color: '#fff', fontSize: 13 },
  empty: { color: '#8a94a6', fontSize: 12, padding: 14, textAlign: 'center' },
});
