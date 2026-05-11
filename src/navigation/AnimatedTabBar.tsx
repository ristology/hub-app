/**
 * AnimatedTabBar — wrap default BottomTabBar dgn Animated.View supaya
 * tab bar bisa slide turun/naik based on scroll direction.
 *
 * Pakai shared Animated.Value dari useUIVisibility store.
 */
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useUIVisibility } from '../store/uiVisibility';

export default function AnimatedTabBar(props: BottomTabBarProps) {
  const translate = useUIVisibility((s) => s.translate);

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
    left: 0,
    right: 0,
    bottom: 0,
  },
});
