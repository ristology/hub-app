/**
 * UI visibility store — boolean state untuk hide/show bottom tab bar + top bar + FAB.
 *
 * Pattern: store cuma simpan state boolean. Tiap komponen consumer bikin
 * Animated.Value sendiri (via useHideAnim) yang driven oleh state ini lewat useEffect.
 *
 * Kenapa pattern ini lebih reliable daripada share Animated.Value:
 *  - Setiap Animated.View bisa pakai useNativeDriver tanpa konflik
 *  - Zustand selector untuk boolean re-renders saat berubah, jadi consumer pasti
 *    pick up perubahan walau Animated.Value reference tidak berubah
 *  - Setiap komponen bisa custom durasi / range animasi
 */
import { create } from 'zustand';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

type UIVisibilityState = {
  uiHidden: boolean;
  show: () => void;
  hide: () => void;
};

export const useUIVisibility = create<UIVisibilityState>((set, get) => ({
  uiHidden: false,
  show: () => { if (get().uiHidden) set({ uiHidden: false }); },
  hide: () => { if (!get().uiHidden) set({ uiHidden: true }); },
}));

/** Hook helper — return Animated.Value yang animate antara `visible` (default 0)
 *  dan `hidden` (default 100 px) berdasarkan state global UIVisibility.
 *
 *  Cara pakai di komponen:
 *    const tabTranslate = useHideAnim({ hidden: 100 });
 *    <Animated.View style={{ transform: [{ translateY: tabTranslate }] }}>
 */
export function useHideAnim(opts?: { hidden?: number; visible?: number; duration?: number }): Animated.Value {
  const hidden   = opts?.hidden ?? 100;
  const visible  = opts?.visible ?? 0;
  const duration = opts?.duration ?? 220;

  const isHidden = useUIVisibility((s) => s.uiHidden);
  const anim = useRef(new Animated.Value(isHidden ? hidden : visible)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isHidden ? hidden : visible,
      duration,
      useNativeDriver: true,
    }).start();
  }, [isHidden, hidden, visible, duration, anim]);

  return anim;
}
