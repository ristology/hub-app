import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { errorLogApi } from '../../api/errorLog';
import { useToast } from '../../components/Toast';
import PickerSheet, { type PickerOption } from '../../components/PickerSheet';
import SaveButton from '../../components/SaveButton';
import { pickAndCompressVideo, type PickedVideo, formatDuration } from '../../utils/videoPicker';

const MAX_PHOTOS = 6;
type NewFoto      = { uri: string; name: string; type: string };
type ExistingFoto = { id: number; url: string; markedForRemoval: boolean };
type RouteParams  = { id?: number };

export default function CreateErrorLogScreen() {
  const navigation  = useNavigation();
  const route       = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const queryClient = useQueryClient();
  const toast       = useToast();
  const editId      = route.params?.id;
  const isEdit      = !!editId;

  const [klienId, setKlienId]       = useState<number | null>(null);
  const [kategoriId, setKategoriId] = useState<number | null>(null);
  const [keterangan, setKeterangan] = useState('');
  const [url, setUrl]               = useState('');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [newFotos, setNewFotos]     = useState<NewFoto[]>([]);
  const [existingFotos, setExistingFotos] = useState<ExistingFoto[]>([]);
  const [klienOpen, setKlienOpen]         = useState(false);
  const [kategoriOpen, setKategoriOpen]   = useState(false);
  const [initialized, setInitialized]     = useState(false);

  // Video state — max 1 video per error log
  const [newVideo, setNewVideo]                 = useState<PickedVideo | null>(null);
  const [videoCompressing, setVideoCompressing] = useState(false);
  const [existingVideoUrl, setExistingVideoUrl]       = useState<string | null>(null);
  const [existingVideoThumbnailUrl, setExistingVideoThumbnailUrl] = useState<string | null>(null);
  const [existingVideoDuration, setExistingVideoDuration]         = useState<number | null>(null);
  const [removeExistingVideo, setRemoveExistingVideo] = useState(false);

  const { data: klienData }    = useQuery({ queryKey: ['error-log-klien'],    queryFn: errorLogApi.klien });
  const { data: kategoriData } = useQuery({ queryKey: ['error-log-kategori'], queryFn: errorLogApi.kategori });

  // Load existing data untuk edit mode
  const { data: existingData } = useQuery({
    queryKey: ['error-log', editId],
    queryFn:  () => errorLogApi.detail(editId!),
    enabled:  isEdit,
  });

  useEffect(() => {
    if (!isEdit || !existingData || initialized) return;
    const log = existingData.data;
    setKlienId(log.klien?.id ?? null);
    setKategoriId(log.kategori?.id ?? null);
    setKeterangan(log.keterangan ?? '');
    setUrl(log.url ?? '');
    setUsername(log.username ?? '');
    setPassword(log.password ?? '');
    const urls = log.foto_urls ?? [];
    const ids  = log.foto_ids  ?? [];
    setExistingFotos(urls.map((u, i) => ({ id: ids[i] ?? 0, url: u, markedForRemoval: false })));
    setExistingVideoUrl(log.video_url);
    setExistingVideoThumbnailUrl(log.video_thumbnail_url);
    setExistingVideoDuration(log.video_duration_sec);
    setInitialized(true);
  }, [existingData, initialized, isEdit]);

  const activeExisting = existingFotos.filter((p) => !p.markedForRemoval).length;
  const totalPhotos    = activeExisting + newFotos.length;

  const createMutation = useMutation({
    mutationFn: () => errorLogApi.create({
      klien_id: klienId ?? undefined,
      kategori_error_id: kategoriId!,
      keterangan,
      url:      url      || undefined,
      username: username || undefined,
      password: password || undefined,
      fotos:    newFotos,
      video:              newVideo?.video,
      video_thumbnail:    newVideo?.thumbnail,
      video_duration_sec: newVideo?.video.durationSec,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-log'] });
      queryClient.invalidateQueries({ queryKey: ['error-log-stats'] });
      toast.success('Laporan error berhasil dibuat.');
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal buat laporan.'),
  });

  const updateMutation = useMutation({
    mutationFn: () => errorLogApi.update(editId!, {
      klien_id:          klienId ?? null,
      kategori_error_id: kategoriId ?? undefined,
      keterangan,
      url:               url      || null,
      username:          username || null,
      password:          password || null,
      fotos:             newFotos.length > 0 ? newFotos : undefined,
      remove_photo_ids:  existingFotos.filter((p) => p.markedForRemoval).map((p) => p.id),
      video:              newVideo?.video,
      video_thumbnail:    newVideo?.thumbnail,
      video_duration_sec: newVideo?.video.durationSec,
      remove_video:       removeExistingVideo && !newVideo,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-log'] });
      queryClient.invalidateQueries({ queryKey: ['error-log', editId] });
      queryClient.invalidateQueries({ queryKey: ['error-log-stats'] });
      toast.success('Laporan error berhasil diperbarui.');
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message ?? 'Gagal update laporan.'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const pickImages = async () => {
    if (totalPhotos >= MAX_PHOTOS) { Alert.alert('Maksimal', `Maksimal ${MAX_PHOTOS} foto.`); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Izin ditolak', 'Beri izin akses galeri.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - totalPhotos,
      quality: 0.8,
    });
    if (!result.canceled) {
      const added: NewFoto[] = result.assets.map((a) => ({
        uri:  a.uri,
        name: a.fileName ?? `error-${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      }));
      setNewFotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS - activeExisting));
    }
  };

  const takePhoto = async () => {
    if (totalPhotos >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Izin ditolak', 'Beri izin akses kamera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setNewFotos((p) => [...p, { uri: a.uri, name: a.fileName ?? `cam-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' }]);
    }
  };

  const toggleExistingRemoval = (id: number) => {
    setExistingFotos((prev) => prev.map((p) => p.id === id ? { ...p, markedForRemoval: !p.markedForRemoval } : p));
  };

  const removeNewFoto = (index: number) => setNewFotos((prev) => prev.filter((_, i) => i !== index));

  // Video — max 1 per laporan error
  const pickVideoFromGallery = async () => {
    setVideoCompressing(true);
    try {
      const picked = await pickAndCompressVideo('gallery');
      if (picked) setNewVideo(picked);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Gagal proses video.');
    } finally {
      setVideoCompressing(false);
    }
  };

  const removeNewVideo = () => setNewVideo(null);
  const toggleExistingVideoRemoval = () => setRemoveExistingVideo((v) => !v);
  const hasActiveVideo = !!newVideo || (!!existingVideoUrl && !removeExistingVideo);

  const handleSubmit = () => {
    if (!keterangan.trim()) { Alert.alert('Error', 'Keterangan wajib diisi.'); return; }
    if (!kategoriId)        { Alert.alert('Error', 'Pilih kategori error.'); return; }
    if (isEdit) updateMutation.mutate();
    else        createMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{isEdit ? 'Edit Laporan Error' : 'Laporan Error'}</Text>
          <SaveButton
            onPress={handleSubmit}
            loading={isPending}
            disabled={!keterangan.trim() || !kategoriId}
            label={isEdit ? 'Simpan' : 'Kirim'}
          />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Klien + Kategori */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Klien</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setKlienOpen(true)}>
                <Text style={[styles.pickerText, klienId === null && styles.pickerPlaceholder]} numberOfLines={1}>
                  {klienId === null
                    ? 'Tanpa Klien'
                    : (klienData?.data.find(k => k.id === klienId)?.nama ?? 'Pilih...')}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#8a94a6" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Kategori <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setKategoriOpen(true)}>
                <Text style={[styles.pickerText, !kategoriId && styles.pickerPlaceholder]} numberOfLines={1}>
                  {kategoriId
                    ? (kategoriData?.data.find(k => k.id === kategoriId)?.nama ?? 'Pilih...')
                    : 'Pilih kategori...'}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#8a94a6" />
              </TouchableOpacity>
            </View>
          </View>

          <Field label="Keterangan Error *">
            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder="Jelaskan error yang terjadi..."
              placeholderTextColor="#6b7280"
              value={keterangan}
              onChangeText={setKeterangan}
              multiline
              maxLength={5000}
            />
          </Field>

          {/* Foto — existing (tandai hapus) + new */}
          <Field label={`Foto Error (opsional, ${totalPhotos}/${MAX_PHOTOS})`}>
            {(existingFotos.length > 0 || newFotos.length > 0) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {existingFotos.map((foto) => (
                  <TouchableOpacity key={`ex-${foto.id}`} onPress={() => toggleExistingRemoval(foto.id)} style={styles.fotoItem}>
                    <Image source={{ uri: foto.url }} style={[styles.fotoImage, foto.markedForRemoval && styles.fotoMarked]} />
                    <View style={styles.fotoRemove}>
                      <Ionicons
                        name={foto.markedForRemoval ? 'add-circle' : 'close-circle'}
                        size={22}
                        color={foto.markedForRemoval ? '#22c55e' : '#ef4444'}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
                {newFotos.map((foto, idx) => (
                  <View key={`new-${idx}`} style={styles.fotoItem}>
                    <Image source={{ uri: foto.uri }} style={styles.fotoImage} />
                    <TouchableOpacity onPress={() => removeNewFoto(idx)} style={styles.fotoRemove}>
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            {existingFotos.some((p) => p.markedForRemoval) && (
              <Text style={styles.removeHint}>Tap foto merah untuk batalkan penghapusan</Text>
            )}
            <View style={styles.mediaRow}>
              <TouchableOpacity onPress={pickImages} style={styles.mediaBtn}>
                <Ionicons name="image-outline" size={20} color="#3b82f6" />
                <Text style={styles.mediaText}>Galeri</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={takePhoto} style={styles.mediaBtn}>
                <Ionicons name="camera-outline" size={20} color="#3b82f6" />
                <Text style={styles.mediaText}>Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickVideoFromGallery}
                style={styles.mediaBtn}
                disabled={videoCompressing || hasActiveVideo}
              >
                {videoCompressing
                  ? <ActivityIndicator size="small" color="#a855f7" />
                  : <Ionicons name="videocam-outline" size={20} color={hasActiveVideo ? '#6b7280' : '#a855f7'} />}
                <Text style={[styles.mediaText, { color: hasActiveVideo ? '#6b7280' : '#a855f7' }]}>
                  {videoCompressing ? 'Kompresi...' : 'Video'}
                </Text>
              </TouchableOpacity>
            </View>
          </Field>

          {/* Video preview */}
          {(newVideo || (existingVideoUrl && existingVideoThumbnailUrl)) && (
            <Field label="Video">
              {newVideo ? (
                <View style={styles.videoPreviewWrap}>
                  <Image source={{ uri: newVideo.thumbnail.uri }} style={styles.videoPreview} />
                  <View style={styles.videoOverlay}>
                    <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                  </View>
                  <View style={styles.videoDurationBadge}>
                    <Ionicons name="videocam" size={11} color="#fff" />
                    <Text style={styles.videoDurationText}>{formatDuration(newVideo.video.durationSec)}</Text>
                  </View>
                  <TouchableOpacity onPress={removeNewVideo} style={styles.videoRemoveBtn}>
                    <Ionicons name="close-circle" size={26} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={toggleExistingVideoRemoval} activeOpacity={0.85} style={styles.videoPreviewWrap}>
                  <Image
                    source={{ uri: existingVideoThumbnailUrl! }}
                    style={[styles.videoPreview, removeExistingVideo && { opacity: 0.35 }]}
                  />
                  {!removeExistingVideo && (
                    <View style={styles.videoOverlay}>
                      <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                    </View>
                  )}
                  <View style={styles.videoDurationBadge}>
                    <Ionicons name="videocam" size={11} color="#fff" />
                    <Text style={styles.videoDurationText}>{formatDuration(existingVideoDuration)}</Text>
                  </View>
                  <View style={styles.videoRemoveBtn}>
                    <Ionicons
                      name={removeExistingVideo ? 'add-circle' : 'close-circle'}
                      size={26}
                      color={removeExistingVideo ? '#22c55e' : '#ef4444'}
                    />
                  </View>
                </TouchableOpacity>
              )}
            </Field>
          )}

          <Field label="URL (opsional)">
            <TextInput
              style={styles.input}
              placeholder="https://klien.com/login"
              placeholderTextColor="#6b7280"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          </Field>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Username">
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#6b7280"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Password">
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#6b7280"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
              </Field>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={klienOpen}
        onClose={() => setKlienOpen(false)}
        title="Pilih Klien"
        searchable
        searchPlaceholder="Cari nama klien..."
        selectedId={klienId}
        options={[
          { id: null, label: 'Tanpa Klien' } as PickerOption,
          ...(klienData?.data ?? []).map<PickerOption>((k) => ({ id: k.id, label: k.nama })),
        ]}
        onPick={(opt) => setKlienId(opt.id as number | null)}
      />

      <PickerSheet
        visible={kategoriOpen}
        onClose={() => setKategoriOpen(false)}
        title="Pilih Kategori Error"
        searchable
        searchPlaceholder="Cari kategori..."
        selectedId={kategoriId}
        options={(kategoriData?.data ?? []).map<PickerOption>((k) => ({ id: k.id, label: k.nama }))}
        onPick={(opt) => setKategoriId(opt.id as number)}
      />
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn:  { padding: 4 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  scroll:   { padding: 16 },
  field:    { marginBottom: 16 },
  label:    { color: '#8a94a6', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pickerText:        { color: '#fff', fontSize: 13, flex: 1 },
  pickerPlaceholder: { color: '#6b7280' },
  fotoItem:   { marginRight: 8, position: 'relative' },
  fotoImage:  { width: 90, height: 90, borderRadius: 8, backgroundColor: '#1c2333' },
  fotoMarked: { opacity: 0.35 },
  fotoRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#0d1421', borderRadius: 11 },
  removeHint: { color: '#8a94a6', fontSize: 11, fontStyle: 'italic', marginBottom: 8 },
  mediaRow:   { flexDirection: 'row', gap: 16, paddingTop: 4 },
  mediaBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  videoPreviewWrap: {
    position: 'relative',
    width: '100%', height: 200,
    backgroundColor: '#1c2333',
    borderRadius: 10, overflow: 'hidden',
  },
  videoPreview: { width: '100%', height: '100%' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  videoDurationBadge: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4,
  },
  videoDurationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  videoRemoveBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: '#0d1421', borderRadius: 13 },
  mediaText:  { color: '#3b82f6', fontWeight: '500', fontSize: 13 },
});
