import React, { useRef } from 'react';
import {
  Modal, View, Image, TouchableOpacity, ScrollView, StyleSheet,
  Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** URI gambar — null/undefined = modal tertutup */
  uri: string | null | undefined;
  onClose: () => void;
};

/** Fullscreen image viewer dengan pinch-to-zoom native (ScrollView).
 *  Tap area kosong (atau X) untuk tutup. Pinch / double-tap area gambar
 *  untuk zoom in/out — tidak butuh library tambahan. */
export default function ImageViewerModal({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const scrollRef = useRef<ScrollView>(null);

  // Double-tap untuk zoom 2.5x / reset ke 1x
  const lastTapRef = useRef<number>(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      // Cek scale saat ini via ref — ScrollView gak expose currentZoom langsung,
      // jadi kita selalu zoom-in (zoom out via pinch)
      scrollRef.current?.scrollResponderZoomTo?.({
        x: width * 0.25, y: height * 0.25,
        width: width * 0.5, height: height * 0.5,
        animated: true,
      });
    }
    lastTapRef.current = now;
  };

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.backdrop}>
        {uri && (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            pinchGestureEnabled
            bouncesZoom
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
          >
            <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
              <Image
                source={{ uri }}
                style={{ width, height }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Tombol close — di-render di atas ScrollView supaya tidak ikut zoom */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={12}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>

        {/* Tap di tepi atas/bawah (luar gambar landscape) untuk tutup — area
            tap kecil di sisi atas dan bawah supaya tidak ganggu pinch */}
        <TouchableOpacity
          style={[styles.bottomTapArea, { paddingBottom: insets.bottom }]}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  bottomTapArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
  },
});
