import React from 'react';
import {
  Modal, View, Image, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** URI gambar — null/undefined = modal tertutup */
  uri: string | null | undefined;
  onClose: () => void;
};

export default function ImageViewerModal({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        {uri && (
          <Image
            source={{ uri }}
            style={{ width, height }}
            resizeMode="contain"
          />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={onClose}
        hitSlop={12}
        activeOpacity={0.8}
      >
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute', right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
});
