import { useRef, useState, useCallback, useEffect } from 'react';
import { findNodeHandle, type ScrollView, type View } from 'react-native';

/**
 * Hook untuk scroll-to-komentar + animasi highlight setelah deep link
 * tap notif.
 *
 * Pakai di detail screen yang punya list komentar:
 *
 * ```tsx
 * const { scrollRef, registerKomRef, highlightedId, onContentReady } =
 *   useKomentarHighlight(route.params.highlightKomentarId);
 *
 * <ScrollView ref={scrollRef} onContentSizeChange={onContentReady}>
 *   ...
 *   {komentar.map((k) => (
 *     <View
 *       ref={registerKomRef(k.id)}
 *       style={[styles.kom, highlightedId === k.id && styles.komHighlight]}
 *     >
 *       ...
 *     </View>
 *   ))}
 * </ScrollView>
 * ```
 */
export function useKomentarHighlight(targetId: number | null | undefined) {
  const scrollRef = useRef<ScrollView | null>(null);
  const komRefs   = useRef<Record<number, View | null>>({});
  const scrolled  = useRef(false);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  // Reset saat targetId berubah (mis. user buka detail komentar lain)
  useEffect(() => {
    scrolled.current = false;
    setHighlightedId(null);
  }, [targetId]);

  const tryScroll = useCallback(() => {
    if (!targetId || scrolled.current) return;
    const view = komRefs.current[targetId];
    const sv   = scrollRef.current;
    if (!view || !sv) return;

    const handle = findNodeHandle(sv);
    if (!handle) return;

    view.measureLayout(
      handle,
      (_x: number, y: number) => {
        // Jangan scroll kalau measurement masih 0 (layout belum selesai)
        if (y <= 0 || scrolled.current) return;
        scrolled.current = true;
        sv.scrollTo({ y: Math.max(0, y - 80), animated: true });
        setHighlightedId(targetId);
        setTimeout(() => setHighlightedId(null), 3000);
      },
      () => {},
    );
  }, [targetId]);

  /**
   * Panggil ini di `onContentSizeChange` dari ScrollView. Ini fire setelah
   * layout pass selesai — saat ini barulah measureLayout reliable.
   * Retry beberapa kali untuk handle async loading komentar.
   */
  const onContentReady = useCallback(() => {
    if (!targetId || scrolled.current) return;
    [50, 250, 600, 1200].forEach((delay) => setTimeout(tryScroll, delay));
  }, [targetId, tryScroll]);

  const registerKomRef = useCallback(
    (id: number) => (view: View | null) => {
      if (view) komRefs.current[id] = view;
    },
    [],
  );

  return { scrollRef, registerKomRef, highlightedId, onContentReady };
}
