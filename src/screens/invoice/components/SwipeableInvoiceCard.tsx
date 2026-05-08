import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import InvoiceCard from './InvoiceCard';
import type { Invoice } from '../../../api/invoice';

const ACTION_WIDTH      = 80;
const NUM_ACTIONS       = 2;
const ROW_OPEN_OFFSET   = -ACTION_WIDTH * NUM_ACTIONS;
const SWIPE_THRESHOLD   = -50;

type Props = {
  invoice: Invoice;
  isOpen: boolean;
  isPending: boolean;
  onPress: () => void;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onToggleLunas: () => void;
  onPreview: () => void;
};

export default function SwipeableInvoiceCard({
  invoice, isOpen, isPending,
  onPress, onSwipeOpen, onSwipeClose, onToggleLunas, onPreview,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;

  // Sync animasi dengan state isOpen (untuk close otomatis kalau ada card lain di-swipe)
  useEffect(() => {
    Animated.spring(translateX, {
      toValue: isOpen ? ROW_OPEN_OFFSET : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [isOpen]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        // Hanya izinkan slide ke kiri (negative dx)
        const base = isOpen ? ROW_OPEN_OFFSET : 0;
        const next = Math.min(0, Math.max(ROW_OPEN_OFFSET, base + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const base    = isOpen ? ROW_OPEN_OFFSET : 0;
        const current = base + g.dx;
        if (current < SWIPE_THRESHOLD + ROW_OPEN_OFFSET / 2) {
          // Snap open
          onSwipeOpen();
        } else {
          // Snap close
          onSwipeClose();
        }
      },
    })
  ).current;

  const isLunas = invoice.status_bayar === 'lunas';

  return (
    <View style={styles.wrap}>
      {/* Action buttons di belakang */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, { backgroundColor: isLunas ? '#ef4444' : '#22c55e' }]}
          onPress={onToggleLunas}
          disabled={isPending}
        >
          {isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : (
              <>
                <Ionicons
                  name={isLunas ? 'refresh' : 'checkmark-circle'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.actionText}>
                  {isLunas ? 'Reset' : 'Lunas'}
                </Text>
              </>
            )
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.action, { backgroundColor: '#3b82f6' }]}
          onPress={onPreview}
        >
          <Ionicons name="eye-outline" size={20} color="#fff" />
          <Text style={styles.actionText}>Preview</Text>
        </TouchableOpacity>
      </View>

      {/* Card di atas, geser horizontal */}
      <Animated.View
        style={[styles.cardWrap, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <InvoiceCard invoice={invoice} onPress={isOpen ? onSwipeClose : onPress} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', marginBottom: 8 },
  actions: {
    position: 'absolute', right: 0, top: 0, bottom: 8,
    flexDirection: 'row',
    borderRadius: 12, overflow: 'hidden',
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardWrap: { backgroundColor: '#0d1421' /* tutup background-nya supaya action gak ke-leak */ },
});
