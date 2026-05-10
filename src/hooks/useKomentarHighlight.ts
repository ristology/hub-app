import { useRef, useState, useCallback, useEffect } from 'react';
import { type ScrollView, type View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';

/**
 * Hook untuk scroll-to-komentar + animasi highlight.
 *
 * Dua trigger:
 *  1. Deep-link tap notif → kasih `targetId` saat init
 *  2. Setelah post komentar baru → panggil `scrollToKomentar(response.data.id)`
 *     supaya screen scroll ke komentar yang baru diposting (bukan ke ujung
 *     ScrollView, karena urutan komentar bisa baru-di-atas).
 *
 * Pendekatan scroll: pakai `View.measure()` (coords di window) untuk komentar
 * & ScrollView, lalu hitung Y absolut dgn menambah scrollOffsetY (yg
 * di-track via onScroll). Lebih reliable dari `measureLayout` yg kadang
 * return 0 di RN modern.
 */
export function useKomentarHighlight(targetId: number | null | undefined) {
  const scrollRef     = useRef<ScrollView | null>(null);
  const komRefs       = useRef<Record<number, View | null>>({});
  const currentTarget = useRef<number | null>(null);
  const scrolled      = useRef(false);
  const scrollOffsetY = useRef(0);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const tryScroll = useCallback(() => {
    const id = currentTarget.current;
    if (!id || scrolled.current) return;
    const view = komRefs.current[id];
    const sv   = scrollRef.current as any;
    if (!view || !sv) return;

    // measure() callback: (x, y, width, height, pageX, pageY)
    view.measure((_x: number, _y: number, _w: number, _h: number, _px: number, pageY: number) => {
      sv.measure((_sx: number, _sy: number, _sw: number, _sh: number, _spx: number, scrollPageY: number) => {
        const targetContentY = pageY - scrollPageY + scrollOffsetY.current;

        if (Number.isFinite(targetContentY) && targetContentY >= 0 && !scrolled.current) {
          scrolled.current = true;
          scrollRef.current?.scrollTo({ y: Math.max(0, targetContentY - 80), animated: true });
          setHighlightedId(id);
          setTimeout(() => setHighlightedId(null), 3000);
        }
      });
    });
  }, []);

  /**
   * Scroll ke komentar dengan id tertentu + highlight.
   * Pakai setelah post komentar baru (id dari response) atau dipanggil
   * internal saat deep-link target di-set.
   */
  const scrollToKomentar = useCallback((id: number) => {
    currentTarget.current = id;
    scrolled.current = false;
    setHighlightedId(null);
    // Retry dengan interval naik — cover variasi waktu refetch + render
    [120, 350, 750, 1400, 2500, 4000].forEach((d) => setTimeout(tryScroll, d));
  }, [tryScroll]);

  // Deep-link: trigger saat targetId berubah (mount + re-tap notif)
  useEffect(() => {
    if (targetId) scrollToKomentar(targetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  /** Pakai di onContentSizeChange — coba lagi setelah konten settle. */
  const onContentReady = useCallback(() => {
    if (currentTarget.current && !scrolled.current) tryScroll();
  }, [tryScroll]);

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

  return { scrollRef, onScroll, registerKomRef, highlightedId, onContentReady, scrollToKomentar };
}
