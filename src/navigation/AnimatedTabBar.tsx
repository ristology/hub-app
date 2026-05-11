/**
 * AnimatedTabBar — wrap default BottomTabBar dgn Animated.View supaya
 * tab bar bisa slide turun/naik berdasarkan state UIVisibility.
 *
 * Penting: TIDAK pakai position absolute → tab bar tetap in-flow di layout
 * navigator. Animasi hanya mengubah visual position via transform, tidak
 * reclaim space. Layout screen lain tetap normal, FAB di modul lain tetap
 * di posisi-nya di atas tab bar.
 */
import React from 'react';
import { Animated } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useHideAnim } from '../store/uiVisibility';

export default function AnimatedTabBar(props: BottomTabBarProps) {
  // Tab bar tinggi ~56-80px; translate 120 utk pastikan hide total
  const translate = useHideAnim({ hidden: 120 });

  return (
    <Animated.View style={{ transform: [{ translateY: translate }] }}>
      <BottomTabBar {...props} />
    </Animated.View>
  );
}
