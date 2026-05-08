import { useRef, useState, useCallback, useEffect } from 'react';
import { type ScrollView, type View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';

/**
 * Hook untuk scroll-to-komentar + animasi highlight setelah deep link
 * tap notif.
 *
 * Pendekatan: pakai `View.measure()` (coords di window) untuk komentar
 * & ScrollView, lalu hitung Y absolut dgn menambah scrollOffsetY (yg
 * di-track via onScroll). Lebih reliable dari `measureLayout` yg kadang
 * return 0 di RN modern.
 *
 * Pakai di detail screen yang punya list komentar:
 *
 * ```tsx
 * const { scrollRef, onScroll, registerKomRef, highlightedId, onContentReady } =
 *   useKomentarHighlight(route.params.highlightKomentarId);
 *
 * <ScrollView
 *   ref={scrollRef}
 *   onScroll={onScroll}
 *   scrollEventThrottle={16}
 *   onContentSizeChange={onContentReady}
 * >
 *   {komentar.map((k) => (
 *     <View
 *       ref={registerKomRef(k.id)}
 *       style={[styles.kom, highlightedId === k.id && styles.komHighlight]}
 *     >...</View>
 *   ))}
 * </ScrollView>
 * ```
 */
export function useKomentarHighlight(targetId: number | null | undefined) {
  const scrollRef     = useRef<ScrollView | null>(null);
  const komRefs       = useRef<Record<number, View | null>>({});
  const scrolled      = useRef(false);
  const scrollOffsetY = useRef(0);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  // Reset saat targetId berubah
  useEffect(() => {
    scrolled.current = false;
    setHighlightedId(null);
  }, [targetId]);

  const tryScroll = useCallback(() => {
    if (!targetId || scrolled.current) return;
    const view = komRefs.current[targetId];
    const sv   = scrollRef.current as any;
    if (!view || !sv) return;

    // measure() callback: (x, y, width, height, pageX, pageY)
    view.measure((_x: number, _y: number, _w: number, _h: number, _px: number, pageY: number) => {
      sv.measure((_sx: number, _sy: number, _sw: number, _sh: number, _spx: number, scrollPageY: number) => {
        // pageY = posisi komentar di window (Y absolut layar)
        // scrollPageY = posisi top ScrollView di window
        // selisih = posisi komentar di viewport ScrollView
        // tambah scrollOffsetY = posisi komentar di content
        const targetContentY = pageY - scrollPageY + scrollOffsetY.current;

        if (Number.isFinite(targetContentY) && targetContentY >= 0 && !scrolled.current) {
          scrolled.current = true;
          scrollRef.current?.scrollTo({ y: Math.max(0, targetContentY - 80), animated: true });
          setHighlightedId(targetId);
          setTimeout(() => setHighlightedId(null), 3000);
        }
      });
    });
  }, [targetId]);

  /** Pakai di onContentSizeChange — fire setelah layout final, retry beberapa kali. */
  const onContentReady = useCallback(() => {
    if (!targetId || scrolled.current) return;
    [50, 250, 600, 1200, 2000].forEach((delay) => setTimeout(tryScroll, delay));
  }, [targetId, tryScroll]);

  /** Track scroll position. */
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const registerKomRef = useCallback(
    (id: number) => (view: View | null) => {
      if (view) komRefs.current[id] = view;
    },
    [],
  );

  return { scrollRef, onScroll, registerKomRef, highlightedId, onContentReady };
}
