import { useRef, useState, useCallback, useEffect } from 'react';
import { findNodeHandle, type ScrollView, type View } from 'react-native';

/**
 * Hook untuk scroll-to-komentar + animasi highlight setelah deep link
 * tap notif.
 *
 * Pakai di detail screen yang punya list komentar:
 *
 * ```tsx
 * const { scrollRef, registerKomRef, highlightedId } =
 *   useKomentarHighlight(route.params.highlightKomentarId);
 *
 * <ScrollView ref={scrollRef}>
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

  // Reset flag saat targetId berubah (mis. user buka detail komentar lain)
  useEffect(() => { scrolled.current = false; }, [targetId]);

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
        scrolled.current = true;
        // -80 supaya komentar tidak nempel di paling atas screen
        sv.scrollTo({ y: Math.max(0, y - 80), animated: true });
        setHighlightedId(targetId);
        // Auto-clear highlight setelah 3 detik
        setTimeout(() => setHighlightedId(null), 3000);
      },
      () => {},
    );
  }, [targetId]);

  const registerKomRef = useCallback(
    (id: number) => (view: View | null) => {
      komRefs.current[id] = view;
      if (view && id === targetId && !scrolled.current) {
        // Delay supaya layout final sudah terhitung (avoid measure 0)
        setTimeout(tryScroll, 250);
      }
    },
    [targetId, tryScroll],
  );

  return { scrollRef, registerKomRef, highlightedId };
}
