import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import {
  requestApi,
  type CreateRequestPayload, type UpdateRequestPayload,
  type FileAsset, type KlienRingkas,
} from '../../api/clientRequest';
import DatePickerInput from '../../components/DatePickerInput';
import SaveButton from '../../components/SaveButton';

const MAX_GAMBAR  = 10;
const MAX_DOKUMEN = 5;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function docIcon(name: string): keyof typeof Ionicons.glyphMap {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf')                return 'document-text';
  if (['doc', 'docx'].includes(ext)) return 'document';
  if (['xls', 'xlsx'].includes(ext)) return 'grid';
  if (['ppt', 'pptx'].includes(ext)) return 'easel';
  return 'document-attach';
}

type ExistingGambar  = { id: number; url: string; markedForRemoval: boolean };
type ExistingDokumen = { id: number; nama: string; url: string; ukuran: number; markedForRemoval: boolean };
type RouteParams = { id?: number };

export default function CreateRequestScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const queryClient = useQueryClient();
  const editId = route.params?.id;
  const isEdit = !!editId;

  const [namaKlien, setNamaKlien]     = useState('');
  const [klienId, setKlienId]         = useState<number | null>(null);
  const [tanggalRequest, setTglReq]   = useState(todayISO());
  const [deadline, setDeadline]       = useState('');
  const [keterangan, setKeterangan]   = useState('');
  const [klienOpen, setKlienOpen]     = useState(false);

  // Lampiran baru
  const [newGambar,  setNewGambar]  = useState<FileAsset[]>([]);
  const [newDokumen, setNewDokumen] = useState<FileAsset[]>([]);

  // Lampiran existing (edit mode)
  const [existingGambar,  setExistingGambar]  = useState<ExistingGambar[]>([]);
  const [existingDokumen, setExistingDokumen] = useState<ExistingDokumen[]>([]);

  const [initialized, setInitialized] = useState(false);

  const { data: existingData } = useQuery({
    queryKey: ['request', editId],
    queryFn:  () => requestApi.detail(editId!),
    enabled:  isEdit,
  });

  useEffect(() => {
    if (!isEdit || !existingData || initialized) return;
    const r = existingData.data;
    setNamaKlien(r.nama_klien ?? '');
    setKlienId(r.klien_id ?? null);
    setTglReq(r.tanggal_request ?? todayISO());
    setDeadline(r.deadline ?? '');
    setKeterangan(r.keterangan ?? '');

    const urls = r.gambar_urls ?? [];
    const ids  = r.gambar_ids  ?? [];
    setExistingGambar(urls.map((u, i) => ({
      id: ids[i] ?? 0, url: u, markedForRemoval: false,
    })));

    setExistingDokumen((r.dokumen ?? []).map((d) => ({
      id: d.id, nama: d.nama, url: d.url, ukuran: d.ukuran, markedForRemoval: false,
    })));

    setInitialized(true);
  }, [existingData, initialized, isEdit]);

  const activeExistingGambar  = existingGambar.filter((g) => !g.markedForRemoval).length;
  const activeExistingDokumen = existingDokumen.filter((d) => !d.markedForRemoval).length;
  const totalGambar  = activeExistingGambar  + newGambar.length;
  const totalDokumen = activeExistingDokumen + newDokumen.length;

  const createMutation = useMutation({
    mutationFn: (payload: CreateRequestPayload) => requestApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['request-stats'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal simpan request.'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateRequestPayload) => requestApi.update(editId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['request', editId] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal update request.'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const pickGambar = async () => {
    if (totalGambar >= MAX_GAMBAR) {
      Alert.alert('Maksimal', `Maksimal ${MAX_GAMBAR} gambar.`); return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Izin ditolak', 'Beri izin akses galeri.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_GAMBAR - totalGambar,
      quality: 0.8,
    });
    if (!result.canceled) {
      const added: FileAsset[] = result.assets.map((a) => ({
        uri:  a.uri,
        name: a.fileName ?? `request-${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      }));
      setNewGambar((prev) => [...prev, ...added].slice(0, MAX_GAMBAR - activeExistingGambar));
    }
  };

  const takeGambar = async () => {
    if (totalGambar >= MAX_GAMBAR) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Izin ditolak', 'Beri izin akses kamera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setNewGambar((p) => [...p, {
        uri: a.uri, name: a.fileName ?? `cam-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg',
      }]);
    }
  };

  const pickDokumen = async () => {
    if (totalDokumen >= MAX_DOKUMEN) {
      Alert.alert('Maksimal', `Maksimal ${MAX_DOKUMEN} dokumen.`); return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      const added: FileAsset[] = result.assets.map((a) => ({
        uri:  a.uri,
        name: a.name,
        type: a.mimeType ?? 'application/octet-stream',
      }));
      setNewDokumen((prev) => [...prev, ...added].slice(0, MAX_DOKUMEN - activeExistingDokumen));
    }
  };

  const toggleExistingGambar = (id: number) => {
    setExistingGambar((prev) => prev.map((g) => g.id === id ? { ...g, markedForRemoval: !g.markedForRemoval } : g));
  };

  const toggleExistingDokumen = (id: number) => {
    setExistingDokumen((prev) => prev.map((d) => d.id === id ? { ...d, markedForRemoval: !d.markedForRemoval } : d));
  };

  const removeNewGambar  = (idx: number) => setNewGambar((p)  => p.filter((_, i) => i !== idx));
  const removeNewDokumen = (idx: number) => setNewDokumen((p) => p.filter((_, i) => i !== idx));

  const submit = () => {
    if (!namaKlien.trim())  return Alert.alert('Validasi', 'Nama klien wajib diisi.');
    if (!keterangan.trim()) return Alert.alert('Validasi', 'Keterangan wajib diisi.');
    if (!tanggalRequest)    return Alert.alert('Validasi', 'Tanggal request wajib diisi.');

    if (isEdit) {
      const removeIds = [
        ...existingGambar.filter((g) => g.markedForRemoval).map((g) => g.id),
        ...existingDokumen.filter((d) => d.markedForRemoval).map((d) => d.id),
      ];
      updateMutation.mutate({
        nama_klien:      namaKlien.trim(),
        klien_id:        klienId,
        tanggal_request: tanggalRequest,
        deadline:        deadline || '',
        keterangan:      keterangan.trim(),
        gambar:              newGambar.length  > 0 ? newGambar  : undefined,
        dokumen:             newDokumen.length > 0 ? newDokumen : undefined,
        remove_lampiran_ids: removeIds.length  > 0 ? removeIds  : undefined,
      });
    } else {
      createMutation.mutate({
        nama_klien:      namaKlien.trim(),
        klien_id:        klienId,
        tanggal_request: tanggalRequest,
        deadline:        deadline || undefined,
        keterangan:      keterangan.trim(),
        gambar:  newGambar.length  > 0 ? newGambar  : undefined,
        dokumen: newDokumen.length > 0 ? newDokumen : undefined,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{isEdit ? 'Edit Request' : 'Request Baru'}</Text>
          <SaveButton onPress={submit} loading={isPending} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>Nama Klien <Text style={styles.req}>*</Text></Text>
          <TouchableOpacity style={styles.klienBox} onPress={() => setKlienOpen(true)}>
            <Text style={[styles.klienText, !namaKlien && styles.placeholder]} numberOfLines={1}>
              {namaKlien || 'Cari atau ketik nama klien...'}
            </Text>
            <Ionicons name="search" size={18} color="#8a94a6" />
          </TouchableOpacity>

          <Text style={styles.label}>Tanggal Request <Text style={styles.req}>*</Text></Text>
          <DatePickerInput value={tanggalRequest} onChange={setTglReq} />

          <Text style={styles.label}>Deadline</Text>
          <DatePickerInput value={deadline} onChange={setDeadline} placeholder="Pilih deadline (opsional)" />

          <Text style={styles.label}>Keterangan <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={keterangan}
            onChangeText={setKeterangan}
            placeholder="Detail request dari klien..."
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          {/* Lampiran gambar */}
          <Text style={styles.label}>Lampiran Gambar ({totalGambar}/{MAX_GAMBAR})</Text>
          {(existingGambar.length > 0 || newGambar.length > 0) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {existingGambar.map((g) => (
                <TouchableOpacity key={`ex-${g.id}`} onPress={() => toggleExistingGambar(g.id)} style={styles.fotoItem}>
                  <Image source={{ uri: g.url }} style={[styles.fotoImage, g.markedForRemoval && styles.fotoMarked]} />
                  <View style={styles.fotoRemove}>
                    <Ionicons
                      name={g.markedForRemoval ? 'add-circle' : 'close-circle'}
                      size={22}
                      color={g.markedForRemoval ? '#22c55e' : '#ef4444'}
                    />
                  </View>
                </TouchableOpacity>
              ))}
              {newGambar.map((f, idx) => (
                <View key={`new-${idx}`} style={styles.fotoItem}>
                  <Image source={{ uri: f.uri }} style={styles.fotoImage} />
                  <TouchableOpacity onPress={() => removeNewGambar(idx)} style={styles.fotoRemove}>
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          {existingGambar.some((g) => g.markedForRemoval) && (
            <Text style={styles.removeHint}>Tap gambar merah untuk batalkan penghapusan</Text>
          )}
          <View style={styles.mediaRow}>
            <TouchableOpacity onPress={pickGambar} style={styles.mediaBtn}>
              <Ionicons name="image-outline" size={18} color="#3b82f6" />
              <Text style={styles.mediaText}>Galeri</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takeGambar} style={styles.mediaBtn}>
              <Ionicons name="camera-outline" size={18} color="#3b82f6" />
              <Text style={styles.mediaText}>Kamera</Text>
            </TouchableOpacity>
          </View>

          {/* Lampiran dokumen */}
          <Text style={styles.label}>Lampiran Dokumen ({totalDokumen}/{MAX_DOKUMEN})</Text>
          {existingDokumen.map((d) => (
            <TouchableOpacity
              key={`exd-${d.id}`}
              onPress={() => toggleExistingDokumen(d.id)}
              style={[styles.docItem, d.markedForRemoval && styles.docItemRemoved]}
              activeOpacity={0.6}
            >
              <Ionicons name={docIcon(d.nama)} size={22} color={d.markedForRemoval ? '#ef4444' : '#3b82f6'} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.docName, d.markedForRemoval && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
                  {d.nama}
                </Text>
                <Text style={styles.docMeta}>{formatBytes(d.ukuran)}</Text>
              </View>
              <Ionicons
                name={d.markedForRemoval ? 'add-circle' : 'close-circle'}
                size={20}
                color={d.markedForRemoval ? '#22c55e' : '#ef4444'}
              />
            </TouchableOpacity>
          ))}
          {newDokumen.map((f, idx) => (
            <View key={`newd-${idx}`} style={styles.docItem}>
              <Ionicons name={docIcon(f.name)} size={22} color="#3b82f6" />
              <View style={{ flex: 1 }}>
                <Text style={styles.docName} numberOfLines={1}>{f.name}</Text>
                <Text style={styles.docMeta}>Baru ditambahkan</Text>
              </View>
              <TouchableOpacity onPress={() => removeNewDokumen(idx)} hitSlop={6}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={pickDokumen} style={styles.docPickBtn}>
            <Ionicons name="document-attach-outline" size={18} color="#3b82f6" />
            <Text style={styles.mediaText}>Pilih Dokumen (PDF, Word, Excel, PPT)</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <KlienPicker
        visible={klienOpen}
        onClose={() => setKlienOpen(false)}
        onPick={(k) => {
          setNamaKlien(k.nama);
          setKlienId(k.id);
          setKlienOpen(false);
        }}
        onPickFreeText={(text) => {
          setNamaKlien(text);
          setKlienId(null);
          setKlienOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function KlienPicker({ visible, onClose, onPick, onPickFreeText }: {
  visible: boolean;
  onClose: () => void;
  onPick: (k: KlienRingkas) => void;
  onPickFreeText: (text: string) => void;
}) {
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState<KlienRingkas[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await requestApi.searchKlien(search);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, visible]);

  useEffect(() => { if (visible) setSearch(''); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={pickerStyles.backdrop}
      >
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />

          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>Pilih Klien</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={pickerStyles.searchBox}>
            <Ionicons name="search" size={18} color="#6b7280" />
            <TextInput
              style={pickerStyles.searchInput}
              placeholder="Cari atau ketik nama klien..."
              placeholderTextColor="#6b7280"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="words"
            />
          </View>

          {search.trim() && !results.some(r => r.nama.toLowerCase() === search.trim().toLowerCase()) && (
            <TouchableOpacity
              style={pickerStyles.freeText}
              onPress={() => onPickFreeText(search.trim())}
            >
              <Ionicons name="add-circle-outline" size={18} color="#3b82f6" />
              <Text style={pickerStyles.freeTextLabel}>Pakai "{search.trim()}" (klien tidak terdaftar)</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => onPick(item)} style={pickerStyles.item}>
                  <Ionicons name="business-outline" size={18} color="#3b82f6" />
                  <Text style={pickerStyles.itemText}>{item.nama}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={pickerStyles.empty}>
                  {search ? 'Tidak ada klien terdaftar dengan nama ini.' : 'Mulai ketik untuk mencari.'}
                </Text>
              }
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 8 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 4 },
  scroll:   { padding: 16, paddingBottom: 32 },

  label: {
    color: '#8a94a6', fontSize: 12, fontWeight: '600',
    marginTop: 12, marginBottom: 6, letterSpacing: 0.5,
  },
  req: { color: '#ef4444' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10,
    fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  textArea: { minHeight: 120 },
  klienBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  klienText:   { color: '#fff', fontSize: 14, flex: 1 },
  placeholder: { color: '#6b7280' },

  // Foto strip
  fotoItem:   { marginRight: 8, position: 'relative' },
  fotoImage:  { width: 90, height: 90, borderRadius: 8, backgroundColor: '#1c2333' },
  fotoMarked: { opacity: 0.35 },
  fotoRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#0d1421', borderRadius: 11 },
  removeHint: { color: '#8a94a6', fontSize: 11, fontStyle: 'italic', marginBottom: 8 },

  // Media buttons
  mediaRow:   { flexDirection: 'row', gap: 14, paddingTop: 4 },
  mediaBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  mediaText:  { color: '#3b82f6', fontWeight: '500', fontSize: 13 },

  // Dokumen list item
  docItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, marginBottom: 6,
  },
  docItemRemoved: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderColor:     'rgba(239,68,68,0.25)',
  },
  docName: { color: '#fff', fontSize: 13, fontWeight: '500' },
  docMeta: { color: '#8a94a6', fontSize: 11, marginTop: 2 },
  docPickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.30)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    justifyContent: 'center', marginTop: 4,
  },
});

const pickerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d1421', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 24, maxHeight: '80%', minHeight: '60%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center', marginTop: 8, marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  title:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 8,
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },
  freeText: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 8, marginBottom: 8,
  },
  freeTextLabel: { color: '#3b82f6', fontSize: 13, fontWeight: '500' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8,
  },
  itemText: { color: '#fff', fontSize: 14, flex: 1 },
  empty:    { color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 30 },
});
