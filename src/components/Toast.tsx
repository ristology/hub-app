import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContext = {
  show:    (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error:   (message: string) => void;
  info:    (message: string) => void;
  warning: (message: string) => void;
};

const Ctx = createContext<ToastContext | null>(null);

export function useToast(): ToastContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const TYPE_CONFIG: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  success: { icon: 'checkmark-circle', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  error:   { icon: 'alert-circle',     color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  info:    { icon: 'information-circle', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  warning: { icon: 'warning',          color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const ctx: ToastContext = {
    show,
    success: (m) => show(m, 'success'),
    error:   (m) => show(m, 'error'),
    info:    (m) => show(m, 'info'),
    warning: (m) => show(m, 'warning'),
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <View pointerEvents="box-none" style={styles.container}>
        {toasts.map((t) => <ToastView key={t.id} item={t} onDismiss={() =>
          setToasts((prev) => prev.filter(x => x.id !== t.id))
        } />)}
      </View>
    </Ctx.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const cfg = TYPE_CONFIG[item.type];
  const opacity     = useRef(new Animated.Value(0)).current;
  const translateY  = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.toastInner, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
        <Text style={styles.text} numberOfLines={3}>{item.message}</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color="#8a94a6" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: { width: '100%', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  toastInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(13,20,33,0.95)',
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  text: { color: '#fff', fontSize: 13, flex: 1, lineHeight: 18 },
});
