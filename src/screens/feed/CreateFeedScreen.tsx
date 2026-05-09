import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location    from 'expo-location';
import { feedApi, type Kategori, type KaryawanRingkas } from '../../api/feed';
import KaryawanPicker from '../../components/KaryawanPicker';
import { useToast } from '../../components/Toast';
import SaveButton from '../../components/SaveButton';

const MAX_PHOTOS = 6;

type Foto = { uri: string; name: string; type: string };

export default function CreateFeedScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [konten, setKonten]       = useState('');
  const [lokasi, setLokasi]       = useState('');
  const [latitude, setLatitude]   = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [kategoriId, setKategoriId] = useState<number | null>(null);
  const [fotos, setFotos]         = useState<Foto[]>([]);
  const [tags, setTags]           = useState<KaryawanRingkas[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  // Auto-mention saat ketik "@" di konten
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAt,   setMentionAt]   = useState<number | null>(null);

  const { data: kategoriData } = useQuery({
    queryKey: ['feed-kategori'],
    queryFn:  feedApi.kategori,
  });
  const kategoriList: Kategori[] = kategoriData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => feedApi.create({
      konten,
      lokasi: lokasi || undefined,
      latitude:  latitude  ?? undefined,
      longitude: longitude ?? undefined,
      kategori_kegiatan_id: kategoriId ?? undefined,
      fotos,
      tags: tags.length > 0 ? tags.map((t) => t.id) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.success('Posting berhasil dipublikasikan.');
      navigation.goBack();
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message ?? 'Gagal posting feed.';
      Alert.alert('Error', msg);
    },
  });

  const pickFromGallery = async () => {
    if (fotos.length >= MAX_PHOTOS) {
      Alert.alert('Maksimal', `Maksimal ${MAX_PHOTOS} foto.`);
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Beri izin akses galeri di pengaturan HP.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - fotos.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newFotos: Foto[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName ?? `feed-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      }));
      setFotos((prev) => [...prev, ...newFotos].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (fotos.length >= MAX_PHOTOS) {
      Alert.alert('Maksimal', `Maksimal ${MAX_PHOTOS} foto.`);
      return;
    }

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin ditolak', 'Beri izin akses kamera di pengaturan HP.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setFotos((prev) => [...prev, {
        uri: a.uri,
        name: a.fileName ?? `cam-${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      }].slice(0, MAX_PHOTOS));
    }
  };

  const removeFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const captureLocation = async () => {
    setGpsLoading(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Izin ditolak', 'Beri izin akses lokasi di pengaturan HP.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLatitude(pos.coords.latitude);
      setLongitude(pos.coords.longitude);

      // Reverse geocode → alamat readable
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (places[0]) {
          const p = places[0];
          const parts = [p.name, p.street, p.district, p.city, p.region]
            .filter((x) => x && x !== p.name)
            .filter(Boolean);
          const address = [p.name, ...parts].filter(Boolean).join(', ');
          if (address) setLokasi(address);
        }
      } catch {
        // ignore reverse geocode error — user masih punya lat/lon
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Gagal ambil lokasi.');
    } finally {
      setGpsLoading(false);
    }
  };

  const clearLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setLokasi('');
  };

  const toggleTag = (k: KaryawanRingkas) => {
    setTags((prev) =>
      prev.find((t) => t.id === k.id)
        ? prev.filter((t) => t.id !== k.id)
        : [...prev, k]
    );
  };

  const removeTag = (id: number) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
  };

  /**
   * Deteksi user mengetik "@" → buka picker.
   * `mentionAt` menyimpan posisi karakter "@" supaya bisa di-replace nanti.
   */
  const handleKontenChange = (next: string) => {
    if (next.length > konten.length) {
      const lastChar = next.charAt(next.length - 1);
      if (lastChar === '@') {
        setMentionAt(next.length - 1);
        setMentionOpen(true);
      }
    }
    setKonten(next);
  };

  const pickMention = (k: KaryawanRingkas) => {
    const tag = '@' + k.nama.replace(/\s+/g, '_') + ' ';

    if (mentionAt !== null) {
      const before = konten.substring(0, mentionAt);
      const after  = konten.substring(mentionAt + 1); // skip the "@"
      setKonten(before + tag + after);
    } else {
      setKonten((prev) => (prev ? `${prev} ${tag}` : tag));
    }
    setMentionAt(null);

    // Auto-tambah ke tags supaya backend kirim notif
    setTags((prev) =>
      prev.find((t) => t.id === k.id) ? prev : [...prev, k]
    );
  };

  const handleSubmit = () => {
    if (!konten.trim()) {
      Alert.alert('Error', 'Konten tidak boleh kosong.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Posting Baru</Text>
          <SaveButton
            onPress={handleSubmit}
            loading={createMutation.isPending}
            disabled={!konten.trim()}
            label="Posting"
          />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Konten — ketik "@" untuk mention karyawan */}
          <TextInput
            style={styles.kontenInput}
            placeholder="Apa yang sedang kamu lakukan? Ketik @ untuk tag karyawan."
            placeholderTextColor="#6b7280"
            value={konten}
            onChangeText={handleKontenChange}
            multiline
            maxLength={2000}
          />

          {/* Foto preview */}
          {fotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotoStrip}>
              {fotos.map((foto, idx) => (
                <View key={idx} style={styles.fotoItem}>
                  <Image source={{ uri: foto.uri }} style={styles.fotoImage} />
                  <TouchableOpacity onPress={() => removeFoto(idx)} style={styles.fotoRemove}>
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Tombol media */}
          <View style={styles.mediaRow}>
            <TouchableOpacity onPress={pickFromGallery} style={styles.mediaBtn}>
              <Ionicons name="image-outline" size={20} color="#3b82f6" />
              <Text style={styles.mediaText}>Galeri</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={styles.mediaBtn}>
              <Ionicons name="camera-outline" size={20} color="#3b82f6" />
              <Text style={styles.mediaText}>Kamera</Text>
            </TouchableOpacity>
            <Text style={styles.fotoCount}>{fotos.length}/{MAX_PHOTOS}</Text>
          </View>

          {/* Lokasi (GPS + manual) */}
          <View style={styles.field}>
            <Text style={styles.label}>Lokasi (opsional)</Text>

            {/* Tombol ambil GPS */}
            {!latitude ? (
              <TouchableOpacity
                onPress={captureLocation}
                disabled={gpsLoading}
                style={styles.gpsBtn}
              >
                {gpsLoading
                  ? <ActivityIndicator size="small" color="#3b82f6" />
                  : <Ionicons name="location-outline" size={18} color="#3b82f6" />
                }
                <Text style={styles.gpsBtnText}>
                  {gpsLoading ? 'Mengambil lokasi...' : 'Tag Lokasi GPS Saat Ini'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.gpsActive}>
                <Ionicons name="location" size={18} color="#22c55e" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.gpsActiveLabel}>Lokasi GPS aktif</Text>
                  <Text style={styles.gpsActiveCoord}>
                    {latitude.toFixed(5)}, {longitude?.toFixed(5)}
                  </Text>
                </View>
                <TouchableOpacity onPress={clearLocation}>
                  <Ionicons name="close-circle" size={20} color="#8a94a6" />
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Atau ketik manual: misal Kantor pusat, Bandung"
              placeholderTextColor="#6b7280"
              value={lokasi}
              onChangeText={setLokasi}
            />
          </View>

          {/* Tag Karyawan */}
          <View style={styles.field}>
            <Text style={styles.label}>Tag Karyawan (opsional)</Text>

            <TouchableOpacity
              onPress={() => setTagPickerOpen(true)}
              style={styles.gpsBtn}
            >
              <Ionicons name="people-outline" size={18} color="#3b82f6" />
              <Text style={styles.gpsBtnText}>
                {tags.length === 0
                  ? 'Tag Karyawan'
                  : `${tags.length} karyawan dipilih · tap untuk ubah`}
              </Text>
            </TouchableOpacity>

            {tags.length > 0 && (
              <View style={styles.tagChips}>
                {tags.map((t) => (
                  <View key={t.id} style={styles.tagChip}>
                    {t.foto ? (
                      <Image source={{ uri: t.foto }} style={styles.tagChipAvatar} />
                    ) : (
                      <View style={[styles.tagChipAvatar, styles.tagChipAvatarFallback]}>
                        <Text style={styles.tagChipAvatarText}>
                          {t.nama.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.tagChipText} numberOfLines={1}>{t.nama}</Text>
                    <TouchableOpacity onPress={() => removeTag(t.id)}>
                      <Ionicons name="close-circle" size={16} color="#8a94a6" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Kategori */}
          {kategoriList.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>Kategori (opsional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    onPress={() => setKategoriId(null)}
                    style={[styles.chip, kategoriId === null && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, kategoriId === null && styles.chipTextActive]}>
                      Tanpa Kategori
                    </Text>
                  </TouchableOpacity>
                  {kategoriList.map((k) => (
                    <TouchableOpacity
                      key={k.id}
                      onPress={() => setKategoriId(k.id)}
                      style={[styles.chip, kategoriId === k.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, kategoriId === k.id && styles.chipTextActive]}>
                        {k.nama}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <KaryawanPicker
        visible={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        mode="multiple"
        selectedIds={tags.map((t) => t.id)}
        onPick={toggleTag}
        title="Tag Karyawan"
      />

      <KaryawanPicker
        visible={mentionOpen}
        onClose={() => { setMentionOpen(false); setMentionAt(null); }}
        mode="single"
        onPick={pickMention}
        title="Mention Karyawan"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  topBar:    {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:   { padding: 4 },
  topTitle:  { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  postBtn:   { backgroundColor: '#3b82f6', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontWeight: '600' },
  scroll:    { padding: 16 },
  kontenInput: {
    color: '#fff', fontSize: 16, lineHeight: 22,
    minHeight: 120, padding: 0, marginBottom: 16,
    textAlignVertical: 'top',
  },
  fotoStrip: { marginBottom: 12 },
  fotoItem:  { marginRight: 8, position: 'relative' },
  fotoImage: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#1c2333' },
  fotoRemove:{
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#0d1421', borderRadius: 11,
  },
  mediaRow:  {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 12, marginBottom: 16,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mediaBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mediaText: { color: '#3b82f6', fontWeight: '500', fontSize: 13 },
  fotoCount: { color: '#6b7280', fontSize: 12, marginLeft: 'auto' },
  field:     { marginBottom: 16 },
  label:     { color: '#8a94a6', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input:     {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.30)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  gpsBtnText: { color: '#3b82f6', fontSize: 13, fontWeight: '500' },
  gpsActive: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.30)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  gpsActiveLabel: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  gpsActiveCoord: { color: '#8a94a6', fontSize: 11, marginTop: 2 },
  chipRow:   { flexDirection: 'row', gap: 8 },
  chip:      {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive:{ backgroundColor: 'rgba(59,130,246,0.20)', borderColor: '#3b82f6' },
  chipText:  { color: '#8a94a6', fontSize: 13 },
  chipTextActive: { color: '#3b82f6', fontWeight: '600' },
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.30)',
    borderRadius: 16, paddingLeft: 4, paddingRight: 8, paddingVertical: 4,
    maxWidth: 200,
  },
  tagChipAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1c2333' },
  tagChipAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  tagChipAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tagChipText: { color: '#3b82f6', fontSize: 12, fontWeight: '500', flexShrink: 1 },
});
