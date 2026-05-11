import React, { useEffect, useRef } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

type Props = {
  visible: boolean;
  videoUri: string | null;
  onClose:  () => void;
};

/** Full-screen video player modal — pakai expo-video (SDK 53+ replacement
 *  untuk expo-av Video component). Tap area kosong/X untuk tutup. */
export default function VideoPlayerModal({ visible, videoUri, onClose }: Props) {
  const player = useVideoPlayer(videoUri ?? '', (p) => {
    p.loop  = false;
    p.muted = false;
  });

  useEffect(() => {
    if (visible && videoUri) {
      player.play();
    } else {
      player.pause();
    }
  }, [visible, videoUri]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {videoUri ? (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls
            allowsFullscreen
            allowsPictureInPicture
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute', top: 12, right: 12, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  video: { flex: 1, width: '100%', height: '100%' },
});
