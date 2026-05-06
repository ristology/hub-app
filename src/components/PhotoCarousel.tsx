import React, { useState } from 'react';
import {
  View, Text, Image, FlatList, Dimensions, StyleSheet,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';

type Props = {
  fotos: string[];
  height?: number;
  borderRadius?: number;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PhotoCarousel({ fotos, height = 280, borderRadius = 10 }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 32);

  if (!fotos || fotos.length === 0) return null;

  // 1 foto saja → tidak perlu pager
  if (fotos.length === 1) {
    return (
      <Image
        source={{ uri: fotos[0] }}
        style={[styles.single, { height, borderRadius }]}
        resizeMode="cover"
      />
    );
  }

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={{ borderRadius, overflow: 'hidden' }}
    >
      <FlatList
        data={fotos}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width: containerWidth, height }}
            resizeMode="cover"
          />
        )}
      />

      {/* Counter pojok kanan atas */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>{activeIndex + 1}/{fotos.length}</Text>
      </View>

      {/* Dot indicator bawah */}
      <View style={styles.dots}>
        {fotos.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  single: { width: '100%', backgroundColor: '#1c2333' },
  counter: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
  },
  counterText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  dots: {
    position: 'absolute', bottom: 8, alignSelf: 'center',
    flexDirection: 'row', gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: { width: 18, backgroundColor: '#fff' },
});
