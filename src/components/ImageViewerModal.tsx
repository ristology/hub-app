import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Image, TouchableOpacity, Animated, PanResponder,
  StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** URI gambar — null/undefined = modal tertutup */
  uri: string | null | undefined;
  onClose: () => void;
};

const MIN_SCALE         = 1;
const MAX_SCALE         = 4;
const DOUBLE_TAP_DELAY  = 280;
const DOUBLE_TAP_ZOOM   = 2.5;
const TAP_MOVE_THRESHOLD = 6;

/** Fullscreen image viewer dengan pinch-to-zoom + pan, cross-platform.
 *  Pakai Animated + PanResponder native — bukan ScrollView (yang zoom-nya
 *  iOS-only). Double-tap toggle 1x ↔ 2.5x, pinch dua jari untuk zoom
 *  kontinyu, drag satu jari untuk pan saat zoom-in. */
export default function ImageViewerModal({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');

  const scale      = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Track state antar gesture
  const baseScale      = useRef(1);
  const baseTransX     = useRef(0);
  const baseTransY     = useRef(0);
  const initialPinchD  = useRef(0);   // jarak awal dua jari saat pinch
  const lastTapTime    = useRef(0);   // detect double-tap
  const isPinching     = useRef(false);
  const panOffset      = useRef({ dx: 0, dy: 0 }); // handle transisi pinch → pan

  // Reset transform setiap kali modal dibuka image baru
  useEffect(() => {
    if (uri) {
      scale.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      baseScale.current     = 1;
      baseTransX.current    = 0;
      baseTransY.current    = 0;
      initialPinchD.current = 0;
      isPinching.current    = false;
    }
  }, [uri]);

  const animateReset = () => {
    Animated.parallel([
      Animated.spring(scale,      { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7 }),
    ]).start(() => {
      baseScale.current  = 1;
      baseTransX.current = 0;
      baseTransY.current = 0;
    });
  };

  const animateZoomTo = (target: number) => {
    Animated.spring(scale, { toValue: target, useNativeDriver: true, friction: 7 })
      .start(() => { baseScale.current = target; });
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: () => {
        initialPinchD.current = 0;
        isPinching.current    = false;
        panOffset.current     = { dx: 0, dy: 0 };
      },

      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;

        // Pinch — dua jari
        if (touches.length === 2) {
          isPinching.current = true;
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (initialPinchD.current === 0) {
            initialPinchD.current = dist;
            return;
          }

          const newScale = Math.max(
            MIN_SCALE * 0.6,
            Math.min(MAX_SCALE, baseScale.current * (dist / initialPinchD.current)),
          );
          scale.setValue(newScale);
          return;
        }

        // Pan — satu jari, hanya saat sudah zoom-in
        if (touches.length === 1 && baseScale.current > 1.01) {
          // Transisi pinch → pan: lock scale yg sekarang sebagai base baru,
          // dan catat offset gesture biar pan tidak lompat.
          if (isPinching.current) {
            scale.stopAnimation((v) => { baseScale.current = v; });
            isPinching.current = false;
            panOffset.current = { dx: g.dx, dy: g.dy };
            return;
          }
          translateX.setValue(baseTransX.current + (g.dx - panOffset.current.dx));
          translateY.setValue(baseTransY.current + (g.dy - panOffset.current.dy));
        }
      },

      onPanResponderRelease: (_, g) => {
        // Capture final values
        scale.stopAnimation((v)      => { baseScale.current  = v; });
        translateX.stopAnimation((v) => { baseTransX.current = v; });
        translateY.stopAnimation((v) => { baseTransY.current = v; });

        // Snap balik ke 1x kalau pinch out di bawah MIN_SCALE
        if (baseScale.current < MIN_SCALE) {
          animateReset();
          return;
        }

        // Detect double-tap (no movement, no pinch)
        const moved   = Math.abs(g.dx) > TAP_MOVE_THRESHOLD || Math.abs(g.dy) > TAP_MOVE_THRESHOLD;
        const pinched = isPinching.current || initialPinchD.current > 0;
        if (!moved && !pinched) {
          const now = Date.now();
          if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
            // Double-tap → toggle zoom
            if (baseScale.current > 1.1) animateReset();
            else                          animateZoomTo(DOUBLE_TAP_ZOOM);
            lastTapTime.current = 0;
          } else {
            lastTapTime.current = now;
          }
        }

        initialPinchD.current = 0;
        isPinching.current    = false;
      },

      onPanResponderTerminate: () => {
        scale.stopAnimation((v)      => { baseScale.current  = v; });
        translateX.stopAnimation((v) => { baseTransX.current = v; });
        translateY.stopAnimation((v) => { baseTransY.current = v; });
        initialPinchD.current = 0;
        isPinching.current    = false;
      },
    }),
  ).current;

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
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: 'center',
                justifyContent: 'center',
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                ],
              },
            ]}
            {...responder.panHandlers}
          >
            <Image
              source={{ uri }}
              style={{ width, height }}
              resizeMode="contain"
            />
          </Animated.View>
        )}

        {/* Close button — di luar Animated.View supaya tidak ikut zoom + selalu accessible */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={12}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute', right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
});
