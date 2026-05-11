/**
 * UI visibility store — toggle bottom tab bar + FAB based on scroll direction.
 *
 * Single Animated.Value yang di-share antar komponen:
 *  - 0   = visible (tab bar + FAB di posisi normal)
 *  - 100 = hidden (slide turun 100px ke bawah → off-screen)
 *
 * Subscriber pakai useNativeDriver:true supaya animasi mulus di main thread.
 */
import { create } from 'zustand';
import { Animated } from 'react-native';

const ANIM_DURATION = 220;

type UIVisibilityState = {
  /** Shared Animated.Value — pakai untuk transform.translateY di tab bar & FAB */
  translate: Animated.Value;
  show: () => void;
  hide: () => void;
};

const sharedTranslate = new Animated.Value(0);
let visible = true;

export const useUIVisibility = create<UIVisibilityState>(() => ({
  translate: sharedTranslate,

  show: () => {
    if (visible) return;
    visible = true;
    Animated.timing(sharedTranslate, {
      toValue: 0,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start();
  },

  hide: () => {
    if (!visible) return;
    visible = false;
    Animated.timing(sharedTranslate, {
      toValue: 100,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start();
  },
}));
