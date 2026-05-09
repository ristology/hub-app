import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, type TouchableOpacityProps } from 'react-native';

type Props = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
} & Omit<TouchableOpacityProps, 'onPress' | 'disabled' | 'style'>;

/**
 * Tombol Simpan standar utk semua form mobile (Create/Edit).
 * Sama style di semua modul: solid blue bg, white text, opacity 0.5 saat disabled.
 */
export default function SaveButton({
  onPress, loading = false, disabled = false, label = 'Simpan', ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.btn, isDisabled && styles.btnDisabled]}
      {...rest}
    >
      {loading
        ? <ActivityIndicator size="small" color="#fff" />
        : <Text style={styles.text}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  text:        { color: '#fff', fontWeight: '600', fontSize: 14 },
});
