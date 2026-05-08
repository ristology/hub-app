import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Tab bar style yang sama dgn yg dipakai BottomTabNavigator.
 * Diekstrak supaya screen yg perlu hide-then-restore tab bar bisa
 * pakai style asli yang sama.
 */
export function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  const bottomPad    = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);
  const tabBarHeight = 56 + bottomPad;

  return {
    backgroundColor: '#0a0f1a',
    borderTopColor:  'rgba(255,255,255,0.08)',
    borderTopWidth:  1,
    height:          tabBarHeight,
    paddingTop:      6,
    paddingBottom:   bottomPad,
  } as const;
}
