/**
 * AnimatedTabBar — overlay tab bar (position: absolute) yang slide turun
 * berdasarkan state UIVisibility. Saat hidden, area bawah otomatis "fill"
 * oleh content (FB-style).
 *
 * Konsekuensi: screen content extend sampai bottom — FAB di tiap screen
 * harus position di atas tab bar (bottom: ~80 atau pakai insets+tabBarHeight).
 */
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useHideAnim } from '../store/uiVisibility';

export default function AnimatedTabBar(props: BottomTabBarProps) {
  const translate = useHideAnim({ hidden: 120 });

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: translate }] },
      ]}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
  },
});
