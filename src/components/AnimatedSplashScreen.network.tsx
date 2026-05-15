import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// ── Node positions (fixed, computed once) ──────────────────────────────────
const NODES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x:  20 + Math.random() * (width  - 40),
  y:  20 + Math.random() * (height - 40),
}));

// ── Edges: connect nodes within MAX_DIST ───────────────────────────────────
const MAX_DIST = Math.min(width, height) * 0.42;

type Edge = {
  key:    string;
  x1: number; y1: number;
  x2: number; y2: number;
  length: number;
  angle:  number;    // degrees
  cx: number; cy: number;
};

const EDGES: Edge[] = [];
for (let i = 0; i < NODES.length; i++) {
  for (let j = i + 1; j < NODES.length; j++) {
    const dx = NODES[j].x - NODES[i].x;
    const dy = NODES[j].y - NODES[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < MAX_DIST) {
      EDGES.push({
        key:    `${i}-${j}`,
        x1: NODES[i].x, y1: NODES[i].y,
        x2: NODES[j].x, y2: NODES[j].y,
        length: dist,
        angle:  Math.atan2(dy, dx) * (180 / Math.PI),
        cx: (NODES[i].x + NODES[j].x) / 2,
        cy: (NODES[i].y + NODES[j].y) / 2,
      });
    }
  }
}

// ── Signal paths: a dot that travels along an edge ────────────────────────
// Pick a few edges to animate signals on
const SIGNAL_EDGES = EDGES.filter((_, i) => i % 4 === 0).slice(0, 5);

interface Props {
  onFinish: () => void;
}

export default function AnimatedSplashScreen({ onFinish }: Props) {
  // Node pulse animations (staggered)
  const nodeAnims = useRef(NODES.map(() => new Animated.Value(0.3))).current;

  // Edge pulse animations (staggered)
  const edgeAnims = useRef(EDGES.map(() => new Animated.Value(0.1))).current;

  // Signal dots traveling along edges
  const signalAnims = useRef(SIGNAL_EDGES.map(() => new Animated.Value(0))).current;

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

    // Background deferred 80ms
    const timer = setTimeout(() => {
      // Node pulse — staggered so they don't all breathe in sync
      nodeAnims.forEach((anim, i) => {
        const delay = (i / NODES.length) * 3000;
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1,   duration: 1800, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.3, duration: 1800, useNativeDriver: true }),
          ])
        ).start();
      });

      // Edge pulse — offset from nodes
      edgeAnims.forEach((anim, i) => {
        const delay = (i / EDGES.length) * 4000;
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 0.45, duration: 2200, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.1,  duration: 2200, useNativeDriver: true }),
          ])
        ).start();
      });

      // Signal dots travel 0→1 along edge, then reset
      signalAnims.forEach((anim, i) => {
        const baseDelay = i * 700;
        Animated.loop(
          Animated.sequence([
            Animated.delay(baseDelay),
            Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }),
            Animated.delay(1800),
            Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
          ])
        ).start();
      });
    }, 80);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>

      {/* ── Edges ── */}
      {EDGES.map((edge, i) => (
        <Animated.View
          key={edge.key}
          style={{
            position:        'absolute',
            width:           edge.length,
            height:          1,
            backgroundColor: '#4f6af0',
            left:            edge.cx - edge.length / 2,
            top:             edge.cy,
            opacity:         edgeAnims[i],
            transform:       [{ rotate: `${edge.angle}deg` }],
          }}
        />
      ))}

      {/* ── Nodes ── */}
      {NODES.map((node, i) => (
        <Animated.View
          key={node.id}
          style={{
            position:        'absolute',
            width:           5,
            height:          5,
            borderRadius:    2.5,
            backgroundColor: '#6d87f5',
            left:            node.x - 2.5,
            top:             node.y - 2.5,
            opacity:         nodeAnims[i],
          }}
        />
      ))}

      {/* ── Traveling signal dots ── */}
      {SIGNAL_EDGES.map((edge, i) => {
        const x = signalAnims[i].interpolate({
          inputRange:  [0, 1],
          outputRange: [edge.x1, edge.x2],
        });
        const y = signalAnims[i].interpolate({
          inputRange:  [0, 1],
          outputRange: [edge.y1, edge.y2],
        });
        const opacity = signalAnims[i].interpolate({
          inputRange:  [0, 0.05, 0.9, 1],
          outputRange: [0, 1,    1,   0],
        });
        return (
          <Animated.View
            key={`sig-${i}`}
            style={{
              position:        'absolute',
              width:           5,
              height:          5,
              borderRadius:    2.5,
              backgroundColor: '#22C55E',
              opacity,
              transform:       [{ translateX: x }, { translateY: y }],
              left: -2.5,
              top:  -2.5,
            }}
          />
        );
      })}

      {/* ── Content ── */}
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
  logo: {
    width:  width * 0.42,
    height: width * 0.42,
    marginBottom: 20,
  },
  appName: {
    color: '#22C55E',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tagline: {
    color: '#8a94a6',
    fontSize: 12,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  taglineYellow: { color: '#F5A623' },
  taglineGreen:  { color: '#22C55E' },
});
