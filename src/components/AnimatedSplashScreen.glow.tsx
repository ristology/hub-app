import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const LOGO_SIZE   = width * 0.42;
const RING_BASE   = LOGO_SIZE * 0.9;   // ring starts just inside logo edge

// 4 rings, each offset in time so they stagger naturally
const RING_DELAYS = [0, 600, 1200, 1800];
const RING_DURATION = 2400;

interface Props {
  onFinish: () => void;
}

export default function AnimatedSplashScreen({ onFinish }: Props) {
  // Each ring: one value drives both scale and opacity via interpolate
  const ringAnims = useRef(RING_DELAYS.map(() => new Animated.Value(0))).current;

  // Logo glow pulse (drop-shadow substitute via opacity of a glow circle)
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const glowScale   = useRef(new Animated.Value(0.9)).current;

  // Content
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const logoScale      = useRef(new Animated.Value(0.82)).current;
  const appNameOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Content sequence — immediate
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(logoScale,   { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
      ]),
      Animated.timing(appNameOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(screenOpacity,  { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onFinish());

    // Rings + glow — deferred 80ms
    const timer = setTimeout(() => {
      // Rings: each loops with its own start delay
      ringAnims.forEach((anim, i) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(RING_DELAYS[i]),
            Animated.timing(anim, {
              toValue:  1,
              duration: RING_DURATION,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue:  0,
              duration: 0,
              useNativeDriver: true,
            }),
            // Pad remaining time so total cycle = RING_DURATION * RING_DELAYS.length
            Animated.delay(RING_DURATION * (RING_DELAYS.length - 1) - RING_DELAYS[i]),
          ])
        ).start();
      });

      // Glow circle behind logo breathes in/out
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowOpacity, { toValue: 0.75, duration: 1800, useNativeDriver: true }),
            Animated.timing(glowScale,   { toValue: 1.15, duration: 1800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(glowOpacity, { toValue: 0.4,  duration: 1800, useNativeDriver: true }),
            Animated.timing(glowScale,   { toValue: 0.9,  duration: 1800, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, 80);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>

      {/* Expanding rings */}
      {ringAnims.map((anim, i) => {
        const scale = anim.interpolate({
          inputRange:  [0, 1],
          outputRange: [1, 2.8],
        });
        const opacity = anim.interpolate({
          inputRange:  [0, 0.15, 0.85, 1],
          outputRange: [0, 0.55, 0.2,  0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              { opacity, transform: [{ scale }] },
            ]}
          />
        );
      })}

      {/* Soft glow behind logo */}
      <Animated.View
        style={[
          styles.glowCircle,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />

      {/* Content */}
      <Animated.Image
        source={require('../../assets/splash-icon.png')}
        style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />
      <Animated.Text style={[styles.appName, { opacity: appNameOpacity }]}>
        Afresto HUB
      </Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Connect{' '}
        <Animated.Text style={styles.taglineYellow}>collaborate</Animated.Text>
        {' '}
        <Animated.Text style={styles.taglineGreen}>grow</Animated.Text>
      </Animated.Text>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#060b18',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    overflow: 'hidden',
  },

  // Ring: same size as logo, positioned center — scale animation expands it outward
  ring: {
    position:        'absolute',
    width:           RING_BASE,
    height:          RING_BASE,
    borderRadius:    RING_BASE / 2,
    borderWidth:     1.5,
    borderColor:     '#22C55E',
    backgroundColor: 'transparent',
  },

  // Soft green glow behind logo
  glowCircle: {
    position:        'absolute',
    width:           LOGO_SIZE * 1.1,
    height:          LOGO_SIZE * 1.1,
    borderRadius:    LOGO_SIZE * 0.55,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },

  logo: {
    width:        LOGO_SIZE,
    height:       LOGO_SIZE,
    marginBottom: 20,
  },
  appName: {
    color:        '#22C55E',
    fontSize:     22,
    fontWeight:   '700',
    letterSpacing: 1.2,
  },
  tagline: {
    color:        '#8a94a6',
    fontSize:     12,
    marginTop:    6,
    letterSpacing: 0.5,
  },
  taglineYellow: { color: '#F5A623' },
  taglineGreen:  { color: '#22C55E' },
});
