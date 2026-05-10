import React from 'react';
import { TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDrawer } from '../context/AppDrawerContext';

type Props = {
  color?: string;
  size?:  number;
  style?: StyleProp<ViewStyle>;
};

export default function HamburgerButton({ color = '#fff', size = 24, style }: Props) {
  const { open } = useAppDrawer();
  return (
    <TouchableOpacity onPress={open} style={[styles.btn, style]} hitSlop={8}>
      <Ionicons name="menu" size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 6, marginRight: 4 },
});
