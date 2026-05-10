import React, { useRef } from 'react';
import {
  Animated, PanResponder, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACTION_WIDTH = 90;
const OPEN_THRESHOLD = 35;
const ACTIVATION_DX = 8;

export type SwipeAction = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
};

type Props = {
  children: React.ReactNode;
  rightAction?: SwipeAction;
  /** Margin bawah area aksi — match dengan marginBottom card supaya bg pas */
  cardMarginBottom?: number;
};

export default function SwipeableCard({ children, rightAction, cardMarginBottom = 10 }: Props) {
  const tx = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);

  const close = () => {
    Animated.spring(tx, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }).start();
    offset.current = 0;
  };

  const open = () => {
    Animated.spring(tx, { toValue: -ACTION_WIDTH, useNativeDriver: true, friction: 8, tension: 60 }).start();
    offset.current = -ACTION_WIDTH;
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        if (!rightAction) return false;
        // Hanya intercept saat gerakan horizontal lebih dominan — biarkan scroll vertikal jalan
        return Math.abs(g.dx) > ACTIVATION_DX && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        tx.stopAnimation((value) => { offset.current = value; });
      },
      onPanResponderMove: (_, g) => {
        const next = Math.max(-ACTION_WIDTH - 20, Math.min(0, offset.current + g.dx));
        tx.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const final = offset.current + g.dx;
        if (final < -OPEN_THRESHOLD) open();
        else close();
      },
      onPanResponderTerminate: () => close(),
    })
  ).current;

  if (!rightAction) {
    return <>{children}</>;
  }

  const handleActionPress = () => {
    close();
    rightAction.onPress();
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.actionBg,
          { backgroundColor: rightAction.color, bottom: cardMarginBottom },
        ]}
      >
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleActionPress}
          activeOpacity={0.8}
        >
          <Ionicons name={rightAction.icon} size={22} color="#fff" />
          <Text style={styles.actionText}>{rightAction.label}</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[styles.cardWrap, { transform: [{ translateX: tx }] }]}
        {...responder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  /** Solid bg supaya action di belakang tidak bocor saat card belum digeser */
  cardWrap: { backgroundColor: '#0d1421' },
  actionBg: {
    position: 'absolute',
    top: 0, right: 0,
    width: ACTION_WIDTH,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
